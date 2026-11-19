import { spineBirthText, spineMemoryText, spineNodeText, } from "@spinejit/spine-sdk/host";
import { emptySlot, SpineDshError, spineMessage } from "./events.js";
/** The plan's items. A reply stays its original assistant event. */
export function planItems(context, seqOf) {
    const plan = context.contextPlan;
    if (plan === null)
        throw new SpineDshError("Spine published no context plan");
    return plan.cells.map((cell) => planItem(cell, seqOf));
}
function planItem(cell, seqOf) {
    if (cell.type === "source") {
        const anchors = cell.labels.flatMap((label) => (label === "WithoutReasoning" ? [] : [label.UserAnchor]));
        if (anchors.length > 1)
            throw new SpineDshError(`source ${seqOf(cell.source_id)} has ${anchors.length} user anchors`);
        return {
            type: "source",
            seq: seqOf(cell.source_id),
            anchor: anchors[0] ?? null,
            withoutReasoning: cell.labels.includes("WithoutReasoning"),
        };
    }
    const item = cell.item;
    if ("SyntheticNode" in item) {
        const { node_id: nodeId, summary, status } = item.SyntheticNode;
        return { type: "spine", text: spineNodeText(nodeId, summary, status) };
    }
    if ("MemorySlot" in item) {
        const slot = item.MemorySlot;
        if ("Summary" in slot)
            return { type: "spine", text: spineMemoryText(slot.Summary.owner_node, slot.Summary.body) };
        if ("Birth" in slot)
            return { type: "spine", text: spineBirthText(slot.Birth.owner_node, slot.Birth.task) };
    }
    throw new SpineDshError(`DSH cannot show Spine plan item ${JSON.stringify(item).slice(0, 80)}`);
}
/**
 * The surface edits that make the surface show the plan.
 *
 * The plan's sources are anchors: they must appear on the surface in plan
 * order. Between two anchors, the surface is split at host nodes into runs;
 * the plan's spine items between those anchors belong to the last run and
 * every other run must show nothing. A run already showing its items is left
 * alone. Otherwise a run with no items becomes one empty slot, and a run with
 * k items gives its last k-1 nodes one item each and the first item the rest.
 * Items after the last anchor with no run to hold them are appended.
 */
export function surfaceEdits(surface, plan) {
    const cuts = [];
    const groups = [[]];
    let at = 0;
    for (const item of plan) {
        if (item.type === "spine") {
            groups.at(-1).push(item.text);
            continue;
        }
        while (at < surface.length && surface[at].seq !== item.seq)
            at += 1;
        if (at === surface.length || surface[at].role !== "source") {
            throw new SpineDshError(`Spine plan source ${item.seq} is not on the session surface in plan order`);
        }
        cuts.push(at);
        groups.push([]);
        at += 1;
    }
    return groups.flatMap((texts, index) => {
        const from = index === 0 ? 0 : cuts[index - 1] + 1;
        const to = index < cuts.length ? cuts[index] : surface.length;
        return segmentEdits(surface.slice(from, to), texts, index === cuts.length);
    });
}
function segmentEdits(nodes, texts, last) {
    const runs = [];
    let run = [];
    for (const node of nodes) {
        if (node.role !== "host") {
            run.push(node);
        }
        else if (run.length > 0) {
            runs.push(run);
            run = [];
        }
    }
    if (run.length > 0)
        runs.push(run);
    if (runs.length === 0) {
        if (texts.length === 0)
            return [];
        if (last)
            return texts.map((text) => ({ type: "append", text }));
        throw new SpineDshError(`${texts.length} Spine items have no surface nodes to occupy`);
    }
    return runs.flatMap((nodes, index) => runEdits(nodes, index === runs.length - 1 ? texts : []));
}
function runEdits(run, texts) {
    const visible = run.filter((node) => node.role !== "spine" || node.text !== null);
    if (visible.length === texts.length && visible.every((node, index) => shows(node, texts[index])))
        return [];
    if (texts.length === 0)
        return [replace(run, null)];
    if (run.length < texts.length) {
        throw new SpineDshError(`${texts.length} Spine items do not fit ${run.length} surface nodes`);
    }
    const head = run.length - texts.length + 1;
    const parts = [run.slice(0, head), ...run.slice(head).map((node) => [node])];
    return parts.flatMap((part, index) => part.length === 1 && shows(part[0], texts[index]) ? [] : [replace(part, texts[index])]);
}
function shows(node, text) {
    return node.role === "spine" && node.text === text;
}
function replace(nodes, text) {
    return {
        type: "replace",
        startSeq: nodes[0].seq,
        endSeq: nodes.at(-1).seq,
        shadowed: nodes.map((node) => node.seq),
        text,
    };
}
/** Log the edits in the open step. A replaced range shows one slot or one item. */
export function applySurfaceEdits(session, edits, turn, step) {
    for (const edit of edits) {
        if (edit.type === "append") {
            session.append("user/message", spineMessage(edit.text), { surfaceOp: "append" });
            continue;
        }
        const placement = {
            surfaceOp: { op: "replace", startSeq: edit.startSeq, endSeq: edit.endSeq },
            sourceEventSeqs: edit.shadowed,
        };
        if (edit.text === null) {
            session.append("developer/message", { turn, step, message: emptySlot() }, placement);
        }
        else {
            session.append("user/message", spineMessage(edit.text), placement);
        }
    }
}
//# sourceMappingURL=projection.js.map