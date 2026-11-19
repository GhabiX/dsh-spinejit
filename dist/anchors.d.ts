import { type Message } from "@deepseek-ai/dsh-llm";
import { type Session, type SessionSeq } from "@deepseek-ai/dsh-session";
import type { SessionMessageProjection } from "@deepseek-ai/dsh-session/surface";
export declare const USER_ANCHORS = "plugin:spinejit/user-anchors";
/** One user message's number: the n-th message the user wrote in the log. */
export interface UserAnchor {
    seq: SessionSeq;
    anchor: number;
}
declare module "@deepseek-ai/dsh-session/types" {
    interface PluginRecordMap {
        /**
         * Show each named user/message to the model with `[U<anchor>]` in front of
         * its first text. The logged message, which clients show, is unchanged.
         */
        "plugin:spinejit/user-anchors": {
            anchors: UserAnchor[];
        };
    }
}
/** The user message with `[U<anchor>]` in front of its first text, as the Spine plan shows it. */
export declare function anchored<M extends Message>(message: M, anchor: number): M;
/** The `[U<n>]` a message's first text starts with, or null. */
export declare function anchorOf(message: Message): number | null;
/** The text without the `[U<n>]` it starts with. */
export declare function withoutAnchor(text: string): string;
export declare const userAnchorsProjection: SessionMessageProjection;
/** Log the numbers of the user messages that have none yet. */
export declare function logAnchors(session: Session, anchors: readonly UserAnchor[]): void;
//# sourceMappingURL=anchors.d.ts.map