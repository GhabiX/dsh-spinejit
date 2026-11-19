import { freezeMessage } from "@deepseek-ai/dsh-llm";
import { appendPluginRecord } from "@deepseek-ai/dsh-session";
// The Spine core numbers the messages the user wrote `[U<n>]`, and the model
// must see the number. The user must not: DSH clients draw a user message from
// its logged event, not from what the model is sent. So the logged message
// stays as the user wrote it; the plugin logs each number as it enters a step,
// and a message projection puts it in front of the message the model reads,
// the same way for a live session, a resumed one and a fork.
//
// As for WithoutReasoning, the record is an ignorable plugin record: DSH
// without this plugin skips it and resumes the session without the numbers.
//
// Sessions logged by dsh-spinejit 0.1.1 and earlier carry the number in the
// message text itself. Such a message counts as numbered when its text starts
// with its own number.
export const USER_ANCHORS = "plugin:spinejit/user-anchors";
const ANCHOR = /^\[U(\d+)\]\n/;
/** The user message with `[U<anchor>]` in front of its first text, as the Spine plan shows it. */
export function anchored(message, anchor) {
    const prefix = `[U${anchor}]\n`;
    const content = [...message.content];
    const first = content.findIndex((block) => block.type === "text");
    if (first < 0) {
        content.unshift({ type: "text", text: prefix });
    }
    else {
        const block = content[first];
        content[first] = { type: "text", text: prefix + block.text };
    }
    return freezeMessage({ ...message, content });
}
/** The `[U<n>]` a message's first text starts with, or null. */
export function anchorOf(message) {
    const first = message.content.find((block) => block.type === "text");
    const match = first === undefined ? null : ANCHOR.exec(first.text);
    return match === null ? null : Number(match[1]);
}
/** The text without the `[U<n>]` it starts with. */
export function withoutAnchor(text) {
    return text.replace(ANCHOR, "");
}
export const userAnchorsProjection = {
    type: USER_ANCHORS,
    project(event, context) {
        const anchors = event.data?.anchors;
        if (!Array.isArray(anchors) || anchors.length === 0) {
            throw new Error(`${USER_ANCHORS}: data must name a nonempty anchors array`);
        }
        const nodes = new Set(context.nodes);
        const messages = new Map();
        for (const entry of anchors) {
            const { seq, anchor } = entry ?? {};
            if (typeof seq !== "number" || messages.has(seq))
                throw new Error(`${USER_ANCHORS}: bad or duplicate seq ${seq}`);
            if (!Number.isSafeInteger(anchor) || anchor < 1)
                throw new Error(`${USER_ANCHORS}: bad anchor ${anchor} for seq ${seq}`);
            if (!nodes.has(seq))
                throw new Error(`${USER_ANCHORS}: seq ${seq} is not a current surface node`);
            const source = context.events[seq - context.baseSeq];
            if (source?.type !== "user/message" || source.data.source.kind !== "user") {
                throw new Error(`${USER_ANCHORS}: seq ${seq} must be a user/message the user wrote`);
            }
            messages.set(seq, anchored(context.messages.get(seq) ?? source.data, anchor));
        }
        return messages;
    },
};
/** Log the numbers of the user messages that have none yet. */
export function logAnchors(session, anchors) {
    if (anchors.length > 0)
        appendPluginRecord(session, USER_ANCHORS, { anchors: [...anchors] });
}
//# sourceMappingURL=anchors.js.map