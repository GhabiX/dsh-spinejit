declare module "@deepseek-ai/dsh-llm/types" {
    interface LlmRequestPurposeMap {
        compaction: true;
    }
}
import type { Context } from "@deepseek-ai/cordis";
import { CompactionEngine, type CompactionAgentContext, type CompactionResult, type CompactionTrigger, type ManualCompactAgentContext } from "@deepseek-ai/dsh-compaction";
/**
 * Hard cap on summarization requests for one compaction. A history many times
 * the model window is summarized in chunks and merged; past this many requests
 * compaction fails instead of spending without bound.
 */
export declare const MAX_SUMMARY_REQUESTS = 32;
/** Overflow recoveries per agent before a successful reply or idle resets the count. */
export declare const MAX_OVERFLOW_RETRIES = 1;
type CommandId = NonNullable<CompactionResult["sourceCommandId"]>;
/**
 * SpineJIT's DSH compaction service (`ctx.compaction`). Spine owns placement of
 * every source message, so the whole context is summarized into one checkpoint
 * that is also a Spine epoch barrier; resumed, reopened and forked sessions
 * replay that barrier from the log.
 *
 * Agent presets mount their own compaction group in an isolated realm, where
 * this service cannot replace it. For every agent, the engine binds the
 * preset's `ctx.compaction` seam (compactIfNeeded/compactNow/compactRegion)
 * to Spine and stops the preset's tool-result pruner, so no compaction a
 * preset declares can rewrite the surface behind Spine.
 */
export default class SpineCompactionEngine extends CompactionEngine {
    static inject: string[];
    private readonly bound;
    private readonly restore;
    private readonly agentsBySession;
    constructor(ctx: Context);
    /** Spine folds context as it works; only a provider-confirmed overflow compacts. */
    compactIfNeeded(agent: CompactionAgentContext, trigger: CompactionTrigger, signal: AbortSignal): Promise<CompactionResult | null>;
    compactNow(agent: ManualCompactAgentContext, signal: AbortSignal, sourceCommandId?: CommandId): Promise<CompactionResult | null>;
    compactRegion(): Promise<CompactionResult>;
    private compactAgent;
    /** Bind the compaction seam and pruner an agent's preset composes, once per instance. */
    private bindPreset;
    private shadow;
}
export {};
//# sourceMappingURL=compact.d.ts.map