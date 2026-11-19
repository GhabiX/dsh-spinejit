import { prettySpineTreeLineText, spineTreeMarkerTone } from "@spinejit/spine-sdk/view";
import { showsTree, treeWindow } from "./tree.js";
const ROWS = 3;
const TONE_COLOR = { brand: "success", error: "error", warning: "warning" };
export function registerTreeView(ctx, display) {
    ctx.inject(["tuiStatus"], ((tuiCtx) => {
        tuiCtx.tuiStatus.registerView({ key: "spinejit:tree", maxRows: ROWS, component: (props) => treeRows(props, display) }, tuiCtx);
    }));
}
export function treeRows({ React, ui }, display) {
    const tree = React.useSyncExternalStore(display.subscribe, display.shown);
    if (!showsTree(tree))
        return null;
    const h = React.createElement;
    return h(ui.Box, { flexDirection: "column" }, ...treeWindow(tree, ROWS).map((line, index) => h(ui.Text, { key: index, wrap: "truncate" }, ...rowParts(line, h, ui.Text))));
}
function rowParts(line, h, Text) {
    if (line.type !== "node")
        return [h(Text, { dimColor: true }, prettySpineTreeLineText(line))];
    const tone = spineTreeMarkerTone(line.marker);
    const marker = tone === "dim" ? { dimColor: true } : { color: TONE_COLOR[tone], bold: true };
    return [h(Text, { dimColor: true }, line.prefix), h(Text, marker, line.marker), ` ${line.label}`];
}
//# sourceMappingURL=tui.js.map