import { isAppendSurfaceEvent, pluginRecordOf } from "@deepseek-ai/dsh-session";
import { createHostAdapter, isSpineToolName, operationFromSpineToolCall, spineToolRefusal, spineToolResult, unarrivedBirths, } from "@spinejit/spine-sdk/host";
import { createNodeSpineRuntime } from "@spinejit/spine-sdk/node";
import { anchorOf, logAnchors, USER_ANCHORS } from "./anchors.js";
import { arrivalOf, beginsSampling, emptySlot, endsSampling, eventMessage, isUserSource, samplingSlot, sourceCharacter, SpineDshError, spineText, surfaceRole, } from "./events.js";
import { applySurfaceEdits, planItems, surfaceEdits } from "./projection.js";
import { dropReasoning, hasReasoning } from "./reasoning.js";
import { sessionBirth } from "./spawn.js";
export const SPINE_FEATURES = ["jit", "spawn"];
/**
 * One model response carries at most one Spine operation (the core admits one
 * per sampling). A second call is refused before it runs; the model sees a tool error.
 */
export class SpineToolLimitError extends Error {
    constructor(staged) {
        super(`only one Spine tool call is allowed per model response; ${staged} already ran in this one`);
        this.name = "SpineToolLimitError";
    }
}
/**
 * The Spine state of one DSH agent. One main-loop model request is one Spine
 * sampling: it begins with a marked empty slot in front of the response, and
 * its stretch of the log runs to the next sampling's slot or to the end of its
 * step. The surface follows the plan the core last published, edited when the
 * next step opens.
 *
 * The session log is the only record of this state. A sampling settles from
 * its stretch alone: the sources in it, the Spine call whose logged result is
 * not an error, and its response. Live and resumed agents settle it with the
 * same code, and when it settles does not change the result.
 */
export class SpineAgent {
    agent;
    #nodePrompt;
    #born;
    #changed;
    #adapter;
    /** Every session event seen, by seq. */
    #events = new Map();
    /** Logged sources the core has not observed yet, in log order. */
    #unobserved = [];
    #sourceSeqs = new Map();
    /** Each user message's number, by seq: the n-th the user wrote in the log. */
    #userNumbers = new Map();
    /** User messages numbered for the model: in a user-anchors record, or (0.1.1 and earlier) in their text. */
    #anchored = new Set();
    #anchorInText = new Set();
    #plan = null;
    #projection = null;
    /** Births whose arrival is in the log, by producer. */
    #entered = new Set();
    #recovering = false;
    #sampling = null;
    #turn = 0;
    #step = 0;
    #fault = null;
    constructor(agent, nodePrompt, born, changed) {
        this.agent = agent;
        this.#nodePrompt = nodePrompt;
        this.#born = born;
        this.#changed = changed;
    }
    static async create(agent, configToml, born, changed) {
        const events = agent.session.snapshotEvents();
        // A forked session's inherited prefix is its parent's namespace.
        const thread = inheritedCut(events) === undefined ? agent.id : agent.session.header.parentSession;
        const runtime = createNodeSpineRuntime({ thread, features: SPINE_FEATURES, configToml });
        const spine = new SpineAgent(agent, runtime.nodePrompt(), born, changed);
        spine.#adapter = await createHostAdapter({
            runtime: runtime.client,
            host: {
                // DSH has no ownership registry. Another writer that rewrites conversation
                // context moves a plan source off the surface, and the projection faults.
                claimOwnership: async () => { },
                // Every fact a commit derives from is already in the session log.
                persistArchive: async () => { },
                context: {
                    materialize: async (context) => planItems(context, (id) => spine.#seqOf(id)),
                    publishAtomic: async (context) => {
                        spine.#plan = [...context.messages];
                        spine.#project(context.projection);
                    },
                },
            },
            dispose: () => runtime.dispose(),
        });
        // A resumed session brings its log as seed events, which are never published.
        await spine.#recover(events);
        return spine;
    }
    get projection() {
        return this.#projection;
    }
    get fault() {
        return this.#fault ?? this.#adapter.fault;
    }
    /** Index one event of this agent's session; a new source waits for observation. */
    accept(event) {
        if (this.#events.has(event.seq))
            return;
        this.#events.set(event.seq, event);
        if (isAppendSurfaceEvent(event) && surfaceRole(event) === "source")
            this.#unobserved.push(event);
        if (isUserSource(event)) {
            const number = this.#userNumbers.size + 1;
            this.#userNumbers.set(event.seq, number);
            if (anchorOf(eventMessage(event)) === number) {
                this.#anchored.add(event.seq);
                this.#anchorInText.add(event.seq);
            }
        }
        const record = pluginRecordOf(event);
        if (record?.type === USER_ANCHORS) {
            for (const { seq } of record.data.anchors)
                this.#anchored.add(seq);
        }
        const arrival = arrivalOf(event);
        if (arrival !== null)
            this.#entered.add(arrival.producer.join("."));
    }
    /** Births still pending whose arrival is not in the log yet. */
    openBirths() {
        if (this.#projection === null)
            return [];
        return unarrivedBirths(this.#projection).filter((birth) => !this.#entered.has(birth.producer.join(".")));
    }
    /** A step opened: bring the surface to the published plan. */
    async enterStep(turn, step) {
        this.#turn = turn;
        this.#step = step;
        await this.#guard(async () => {
            if (this.#plan === null)
                return;
            applySurfaceEdits(this.agent.session, surfaceEdits(this.#surface(), this.#plan), turn, step);
            dropReasoning(this.agent.session, this.#plan.flatMap((item) => item.type === "source" && item.withoutReasoning ? [item.seq] : []));
        });
    }
    /** A main-loop request is about to stream. Its messages must be the plan; it begins a sampling. */
    async beginSampling() {
        // A request retried in the same step ends the failed one's stretch.
        await this.settle();
        await this.#guard(async () => {
            await this.#prepare();
            this.#assertSurfaceShowsPlan();
            const session = this.agent.session;
            // The user messages this request is the first to carry, numbered for
            // every later request. DSH built this one from the log right after
            // logging them, with no point between, so it carries them as the user
            // wrote them; the logged messages, which clients show, stay so.
            const anchors = [...this.#userNumbers]
                .filter(([seq]) => !this.#anchored.has(seq))
                .map(([seq, anchor]) => ({ seq, anchor }));
            logAnchors(session, anchors);
            for (const { seq } of anchors)
                this.#anchored.add(seq);
            await this.#begin(session.seq);
            // Two empty slots before the response: room for what this sampling
            // puts in front of it (a Next: the closed node's memory). Nothing
            // follows it: a node it opens is described in the call's result.
            // The first marks in the log where the sampling began.
            for (const message of [samplingSlot(), emptySlot()]) {
                session.append("developer/message", { turn: this.#turn, step: this.#step, message }, { surfaceOp: "append" });
            }
        });
    }
    /**
     * Admit one Spine tool call of the current sampling and return its result
     * text, or throw the tool error the model sees. The sampling stages it when
     * it settles, if its logged result is not an error.
     */
    admit(name, args) {
        if (this.fault !== null)
            throw new SpineDshError("Spine context is faulted", { cause: this.fault });
        operationFromSpineToolCall(name, args);
        const sampling = this.#sampling;
        if (sampling === null)
            throw new SpineDshError(`${name} ran outside a Spine sampling`);
        if (sampling.called !== null)
            throw new SpineToolLimitError(sampling.called);
        // What the core would refuse at commit is a tool error now, not a fault later.
        const refusal = spineToolRefusal(this.#projection, name, this.#entered, sessionBirth(this.agent.id), this.#responseCalls(sampling.from));
        if (refusal !== null)
            throw new SpineDshError(refusal);
        sampling.called = name;
        return spineToolResult(this.#projection, name, args, this.#nodePrompt);
    }
    /** Settle the open sampling, if any, over its stretch of the log so far. */
    async settle() {
        if (this.#sampling !== null)
            await this.#settle(this.#end(this.#sampling.from));
    }
    dispose() {
        this.#adapter.dispose();
    }
    /**
     * Run the sampling lifecycle over a logged session, in log order: each
     * sampling begins at its marked slot and settles where its stretch ends,
     * or at the end of the log. A forked session continues in its own
     * namespace where its inherited prefix ends.
     */
    async #recover(events) {
        const cut = inheritedCut(events);
        this.#recovering = true;
        for (const event of events) {
            if (endsSampling(event) || event.seq === cut)
                await this.#settle(event.seq);
            if (event.seq === cut)
                await this.#guard(() => this.#continueNamespace(event.seq));
            this.accept(event);
            // With Spine, a user message is numbered before the model answers it.
            if (event.type === "assistant/message" && [...this.#userNumbers.keys()].some((seq) => !this.#anchored.has(seq))) {
                throw new SpineDshError(`session ${this.agent.id} started without Spine: its user messages carry no [U#]`);
            }
            if (beginsSampling(event)) {
                await this.#guard(async () => {
                    await this.#prepare();
                    await this.#begin(event.seq);
                });
            }
        }
        await this.settle();
        this.#recovering = false;
    }
    #project(projection) {
        this.#projection = projection;
        if (!this.#recovering)
            this.#changed(projection);
    }
    /**
     * Observe the inherited sources and continue in this session's namespace.
     * Births the parent made stay its own to join.
     */
    async #continueNamespace(cut) {
        await this.#observe(cut);
        const source = await this.#adapter.continueNamespace(this.agent.id);
        for (const cell of source.cells)
            this.#sourceSeqs.set(sourceKey(cell.source_id), cell.boundary);
        await this.#adapter.previewAndPublish();
    }
    /** Observe every logged source and make sure a plan is published for it. */
    async #prepare() {
        if ((await this.#observe(Infinity)) > 0 || this.#plan === null)
            await this.#adapter.previewAndPublish();
    }
    async #begin(from) {
        await this.#adapter.beginSampling();
        this.#sampling = { from, called: null };
    }
    /** Where the stretch of the sampling that began at `from` ends, as logged so far. */
    #end(from) {
        const next = this.agent.session.seq;
        for (let seq = from + 1; seq < next; seq += 1) {
            if (endsSampling(this.#event(seq)))
                return seq;
        }
        return next;
    }
    /** Settle the open sampling with its stretch of the log, which ends before `to`. */
    async #settle(to) {
        const sampling = this.#sampling;
        if (sampling === null)
            return;
        await this.#guard(async () => {
            const call = this.#spineCall(sampling.from, to);
            if (call !== null) {
                const operation = operationFromSpineToolCall(call.name, JSON.parse(call.args));
                await this.#adapter.registerExecution(call.callId);
                await this.#adapter.stageExecution(call.callId, call.callId, operation);
                await this.#adapter.finishExecution(call.callId, true);
            }
            await this.#observe(to);
            const outcome = this.#outcome(sampling.from, to);
            const result = await this.#adapter.finishSampling(outcome.terminal, outcome.inputTokens);
            this.#sampling = null;
            if (result.type !== "committed")
                return;
            this.#project(result.projection);
            // The children a live Spawn bore start from the log before its sampling.
            if (!this.#recovering && call?.name === "spine_spawn")
                await this.#born(this.openBirths(), sampling.from);
        });
    }
    /** Observe the unobserved sources logged before `to`. */
    async #observe(to) {
        const count = this.#unobserved.findIndex((event) => event.seq >= to);
        const events = this.#unobserved.splice(0, count < 0 ? this.#unobserved.length : count);
        if (events.length === 0)
            return 0;
        const ids = await this.#adapter.observeSources(events.map((event) => sourceCharacter(event, this.#anchorInText.has(event.seq))));
        if (ids.length !== events.length) {
            throw new SpineDshError(`Spine admitted ${ids.length} sources for ${events.length} events`);
        }
        ids.forEach((id, index) => this.#sourceSeqs.set(sourceKey(id), events[index].seq));
        return events.length;
    }
    /** Tool calls in the model response logged since `from`, the sampling's start. */
    #responseCalls(from) {
        for (let seq = this.agent.session.seq - 1; seq >= from; seq -= 1) {
            const event = this.#events.get(seq);
            if (event?.type === "assistant/message") {
                return event.data.message.content.filter((block) => block.type === "tool-call").length;
            }
        }
        return 1;
    }
    #seqOf(id) {
        const seq = this.#sourceSeqs.get(sourceKey(id));
        if (seq === undefined)
            throw new SpineDshError(`Spine plan names unknown source ${sourceKey(id)}`);
        return seq;
    }
    #surface() {
        return this.agent.session.surface.nodes.map((seq) => {
            const event = this.#event(seq);
            const role = surfaceRole(event);
            return { seq, role, text: role === "spine" ? spineText(eventMessage(event)) : null };
        });
    }
    /**
     * The request DSH just built is the published plan: no edit pending, and
     * every user message numbered as the plan numbers it, but those it is the
     * first to carry, which it shows as the user wrote them.
     */
    #assertSurfaceShowsPlan() {
        const plan = this.#plan;
        const edits = surfaceEdits(this.#surface(), plan);
        if (edits.length > 0) {
            throw new SpineDshError(`the model request differs from the Spine plan by ${edits.length} surface edits`);
        }
        for (const item of plan) {
            if (item.type !== "source")
                continue;
            if (item.withoutReasoning) {
                const shown = this.agent.session.deriveEventMessage(this.#event(item.seq));
                if (shown !== null && hasReasoning(shown)) {
                    throw new SpineDshError(`source ${item.seq} still shows its reasoning, which the Spine plan leaves out`);
                }
            }
            if (item.anchor === null)
                continue;
            const shown = this.agent.session.deriveEventMessage(this.#event(item.seq));
            const numbered = shown === null ? null : anchorOf(shown);
            const expected = this.#anchored.has(item.seq) ? item.anchor : null;
            if (numbered !== expected) {
                throw new SpineDshError(`source ${item.seq} is U${item.anchor} in the Spine plan; the model should see U${expected} but sees U${numbered}`);
            }
        }
    }
    #event(seq) {
        const event = this.#events.get(seq);
        if (event === undefined)
            throw new SpineDshError(`session event ${seq} was never seen`);
        return event;
    }
    /** The Spine call in the stretch [from, to) whose logged result is not an error, if any. */
    #spineCall(from, to) {
        const calls = new Map();
        for (let seq = from; seq < to; seq += 1) {
            const event = this.#event(seq);
            if (event.type === "tool/call" && isSpineToolName(event.data.name)) {
                calls.set(event.data.callId, { name: event.data.name, callId: event.data.callId, args: event.data.arguments });
            }
            else if (event.type === "tool/result" && event.data.message.isError !== true) {
                const call = calls.get(event.data.message.toolCallId);
                if (call !== undefined)
                    return call;
            }
        }
        return null;
    }
    /**
     * A sampling ends as its response did: completed when it was logged whole,
     * cancelled when it was interrupted, failed when none was logged.
     */
    #outcome(from, to) {
        for (let seq = from; seq < to; seq += 1) {
            const event = this.#event(seq);
            if (event.type !== "assistant/message")
                continue;
            const terminal = event.data.interrupted === true ? "cancelled" : "completed";
            const inputTokens = event.data.usage?.inputTokens;
            return inputTokens === undefined ? { terminal } : { terminal, inputTokens };
        }
        return { terminal: "failed" };
    }
    async #guard(operation) {
        if (this.fault !== null)
            throw new SpineDshError("Spine context is faulted", { cause: this.fault });
        try {
            return await operation();
        }
        catch (cause) {
            this.#fault ??= cause;
            throw new SpineDshError("Spine context fault", { cause });
        }
    }
}
/** Where a forked session's inherited prefix ends: its last inherited seed marker. */
function inheritedCut(events) {
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event.type === "session/end-seed" && event.data.inherited === true)
            return event.seq;
    }
    return undefined;
}
function sourceKey(id) {
    return `${id.thread}\u0000${id.epoch}\u0000${id.ordinal}`;
}
//# sourceMappingURL=agent.js.map