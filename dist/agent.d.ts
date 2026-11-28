import type { Message } from "@deepseek-ai/dsh-llm";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { SessionSeq, type SessionEvent } from "@deepseek-ai/dsh-session";
import type { FeatureFlag, SpineProjection } from "@spinejit/spine-sdk";
import { type SpawnBirth, type SpineToolName } from "@spinejit/spine-sdk/host";
import { SpineDshError, type CompactSummary } from "./events.js";
export declare const SPINE_FEATURES: FeatureFlag[];
/**
 * Hands over the births a live commit made and where their sampling began in
 * the log. Resolves once the children are started, or receive non-waking abort
 * arrivals if the user stopped the turn while the Spawn was still queued.
 */
export type BirthHandler = (births: readonly SpawnBirth[], prefixEnd: number, stopped: boolean) => Promise<void>;
/** Hears each projection the agent publishes or commits live; the recovered one is `projection` once `create` returns. */
export type ProjectionHandler = (projection: SpineProjection) => void;
/**
 * One model response carries at most one Spine operation (the core admits one
 * per sampling). A second call is refused before it runs; the model sees a tool error.
 */
export declare class SpineToolLimitError extends Error {
    constructor(staged: SpineToolName);
}
/** The checkpoint is durable, but the live Spine state could not follow it. */
export declare class SpineCompactCommitError extends SpineDshError {
}
/** Compaction cannot run now (parallel branches are still out); nothing changed. */
export declare class SpineCompactBusyError extends SpineDshError {
}
export interface SpineCompactOptions {
    /** manual: idle `/compact`; auto: provider-confirmed overflow inside a turn. */
    readonly mode: "manual" | "auto";
    readonly summarize: (messages: readonly Message[]) => Promise<CompactSummary>;
    /** Make the checkpoint durable before Spine changes epochs. */
    readonly flush: () => Promise<void>;
    readonly signal: AbortSignal;
}
export interface SpineCompactResult {
    /** The compaction/prune record that prices the shadowed node. */
    readonly pruneSeq: SessionSeq;
    /** The checkpoint user message that carries the barrier. */
    readonly seq: SessionSeq;
    readonly shadowedSeq: SessionSeq;
    readonly shadowedTokenCount: number;
    readonly summary: string;
}
/** How the compaction engine reaches the Spine state of an agent. */
export interface SpineAttachment {
    ensure(agent: Agent): Promise<SpineAgent>;
    readonly signal: AbortSignal;
}
/** The live plugin publishes its attachment; the returned disposer withdraws it. */
export declare function provideSpineAttachment(value: SpineAttachment): () => void;
export declare function spineAttachment(): SpineAttachment | undefined;
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
export declare class SpineAgent {
    #private;
    readonly agent: Agent;
    private constructor();
    static create(agent: Agent, configToml: string, born: BirthHandler, changed: ProjectionHandler): Promise<SpineAgent>;
    get projection(): SpineProjection | null;
    get fault(): unknown;
    /** Index one event of this agent's session; a new source waits for observation. */
    accept(event: SessionEvent): void;
    /** Births still pending whose arrival is not in the log yet. */
    openBirths(): SpawnBirth[];
    /** A step opened: bring the surface to the published plan. */
    enterStep(turn: number, step: number): Promise<void>;
    /** A main-loop request is about to stream. Its messages must be the plan; it begins a sampling. */
    beginSampling(): Promise<void>;
    /**
     * Admit one Spine tool call of the current sampling and return its result
     * text, or throw the tool error the model sees. The sampling stages it when
     * it settles, if its logged result is not an error.
     */
    admit(name: SpineToolName, args: Record<string, unknown>): string;
    /** Settle the open sampling, if any, over its stretch of the log so far. */
    settle(): Promise<void>;
    /**
     * Replace the live context with one durable checkpoint and move Spine to a
     * new epoch behind it. Manual compaction runs under DSH's idle maintenance
     * lock; automatic compaction runs between a failed request and its retry,
     * where the next request re-enters the step and applies the new plan.
     */
    compact(options: SpineCompactOptions): Promise<SpineCompactResult | null>;
    dispose(): void;
}
//# sourceMappingURL=agent.d.ts.map