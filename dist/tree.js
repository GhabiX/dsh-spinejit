import { displayNodesFromProjection, formatNodeId, prettySpineTreeLines, } from "@spinejit/spine-sdk/view";
/** The plugin record that carries a session's tree, written when what it shows changes. */
export const TREE_RECORD = "plugin:spinejit/tree";
/** The session projection clients read the latest tree under. */
export const TREE_PROJECTION = "spinejit";
export function spineTreeOf(projection) {
    return { cursor: formatNodeId(projection.cursor), nodes: displayNodesFromProjection(projection) };
}
/** A tree is shown once the agent has opened a task, as in Pi. */
export function showsTree(tree) {
    return tree?.nodes.some((node) => node.kind === "Task") === true;
}
/**
 * The pretty tree's rows without its header, cut to at most `rows` rows that
 * keep the cursor's row: one row above it where there is one, the rest below.
 * At the root epoch, which the pretty tree never draws, the newest rows.
 */
export function treeWindow(tree, rows) {
    const lines = prettySpineTreeLines(tree.cursor, tree.nodes).slice(1);
    if (lines.length <= rows)
        return lines;
    const current = lines.findIndex((line) => line.type === "node" && line.current);
    const start = current < 0 ? lines.length - rows : Math.min(Math.max(0, current - 1), lines.length - rows);
    return lines.slice(start, start + rows);
}
//# sourceMappingURL=tree.js.map