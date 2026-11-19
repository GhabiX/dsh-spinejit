import { TREE_PROJECTION, type SpineTree } from "./tree.js";
/** The dock seat's props the entry reads. */
export interface SpineDockProps {
    useProjection(key: typeof TREE_PROJECTION): SpineTree | null | undefined;
}
/** The part of the client's slot service the entry uses. */
interface Slots {
    inject(name: "conversation.input.dock", register: () => unknown): unknown;
    register(entry: {
        name: "conversation.input.dock";
        id: string;
        order: number;
        registrant: string;
    }, component: (props: SpineDockProps) => unknown): unknown;
}
/** The part of the Conversation plugin's user-text registry the entry uses. */
interface UserTextRegistry {
    register(rule: typeof userAnchorRule): () => void;
}
export declare const inject: string[];
export declare function apply(ctx: {
    slots: Slots;
    uiConversation: {
        userText: UserTextRegistry;
    };
    effect(execute: () => () => void, label?: string): unknown;
}): void;
/** Hides the `[U<n>]` line a user message starts with; the Conversation plugin applies it to every user bubble. */
export declare const userAnchorRule: {
    id: string;
    order: number;
    match(text: string, from: number): {
        id: "text";
        start: number;
        end: number;
        data: {
            text: string;
            display: string;
        };
    } | undefined;
};
/** Hook-free but for `useProjection`, so the dock can also call it as a plain function. */
export declare function SpineDock({ useProjection }: SpineDockProps): unknown;
export {};
//# sourceMappingURL=client.d.ts.map