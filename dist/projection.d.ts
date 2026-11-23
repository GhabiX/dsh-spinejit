import { type Session, type SessionSeq } from "@deepseek-ai/dsh-session";
import type { EpochOrdinalId } from "@spinejit/spine-sdk";
import { type PublishedContext } from "@spinejit/spine-sdk/host";
import { type SurfaceRole } from "./events.js";
/** One model-visible item of a Spine plan in DSH terms. */
export type PlanItem = 
/**
 * A logged source event shown as it is; `anchor` is its `[U<n>]`, if any;
 * `withoutReasoning`, a model output shown without its reasoning.
 */
{
    type: "source";
    seq: SessionSeq;
    anchor: number | null;
    withoutReasoning: boolean;
}
/** Text this plugin writes as a user message. */
 | {
    type: "spine";
    text: string;
};
/** One surface node as the projection sees it. `text` is a spine node's visible text. */
export interface SurfaceNode {
    seq: SessionSeq;
    role: SurfaceRole;
    text: string | null;
}
export type SurfaceEdit = {
    type: "replace";
    startSeq: SessionSeq;
    endSeq: SessionSeq;
    shadowed: SessionSeq[];
    text: string | null;
} | {
    type: "append";
    text: string;
};
/** The plan's items. A reply stays its original assistant event. */
export declare function planItems(context: PublishedContext, seqOf: (id: EpochOrdinalId) => SessionSeq): PlanItem[];
/**
 * The surface edits that make the surface show the plan.
 *
 * The plan's sources are anchors: they must appear on the surface in plan
 * order. Between two anchors, the surface is split at host nodes into runs;
 * the plan's spine items between those anchors belong to the last run and
 * every other run must show nothing. A run already showing its items is left
 * alone. Otherwise each item occupies one node, and unused nodes become
 * invisible slots. Keeping the run's positions lets a later fold put more
 * items in the same gap between anchors without inserting into the surface.
 * Items after the last anchor with no run to hold them are appended.
 */
export declare function surfaceEdits(surface: readonly SurfaceNode[], plan: readonly PlanItem[]): SurfaceEdit[];
/** Log the edits in the open step. Each replacement preserves its position. */
export declare function applySurfaceEdits(session: Session, edits: readonly SurfaceEdit[], turn: number, step: number): void;
//# sourceMappingURL=projection.d.ts.map