import type { SpineProjection } from "@spinejit/spine-sdk";
import { type DisplayNode, type PrettySpineTreeLine } from "@spinejit/spine-sdk/view";
/** The plugin record that carries a session's tree, written when what it shows changes. */
export declare const TREE_RECORD = "plugin:spinejit/tree";
/** The session projection clients read the latest tree under. */
export declare const TREE_PROJECTION = "spinejit";
/** What the tree shows: the cursor and the nodes the pretty tree is drawn from. */
export interface SpineTree {
    cursor: string;
    nodes: DisplayNode[];
}
export declare function spineTreeOf(projection: SpineProjection): SpineTree;
/** A tree is shown once the agent has opened a task, as in Pi. */
export declare function showsTree(tree: SpineTree | null | undefined): tree is SpineTree;
/**
 * The pretty tree's rows without its header, cut to at most `rows` rows that
 * keep the cursor's row: one row above it where there is one, the rest below.
 * At the root epoch, which the pretty tree never draws, the newest rows.
 */
export declare function treeWindow(tree: SpineTree, rows: number): PrettySpineTreeLine[];
//# sourceMappingURL=tree.d.ts.map