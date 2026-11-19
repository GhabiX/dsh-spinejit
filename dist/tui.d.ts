import type { Context } from "@deepseek-ai/cordis";
import type { TreeDisplay } from "./display.js";
type CreateElement = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => unknown;
/** What a dsh-tui status view receives: the host's React and its UI kit. */
export interface TreeViewProps {
    React: {
        createElement: CreateElement;
        useSyncExternalStore<T>(subscribe: (listener: () => void) => () => void, snapshot: () => T): T;
    };
    ui: {
        Box: unknown;
        Text: unknown;
    };
}
export declare function registerTreeView(ctx: Context, display: TreeDisplay): void;
export declare function treeRows({ React, ui }: TreeViewProps, display: TreeDisplay): unknown;
export {};
//# sourceMappingURL=tui.d.ts.map