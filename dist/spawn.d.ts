import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { SessionId, type SessionEvent } from "@deepseek-ai/dsh-session";
import type { SubagentProvider } from "@deepseek-ai/dsh-subagent";
import type { SpawnArrival, SpawnTask } from "@spinejit/spine-sdk";
import { type SpawnBirth, type SpawnChildren } from "@spinejit/spine-sdk/host";
import type { SpineAgent } from "./agent.js";
/** The subagent provider every Spawn child runs under. */
export declare const SPINE_SUBAGENT_PROVIDER = "spine";
/** The live Spine state of every agent in this world, by agent id. */
export interface SpineWorld {
    ctx: Context;
    agents: ReadonlyMap<string, SpineAgent>;
    children: ReadonlyMap<string, SpawnChildren>;
    /** How to settle an idle Spawn child and release its wait when input arrives. */
    idle: Map<string, {
        settle(aborted: boolean): void;
        input(): void;
    }>;
    /** The seed of each Spawn child being started, by its session id. */
    starting: Map<string, readonly SessionEvent[]>;
}
/** A child's session id: fixed by its parent session and birth, so a restarted parent finds it. */
export declare function childSessionId(parent: string, producer: readonly number[]): SessionId;
/** The birth a session runs, read back from its childSessionId; null for a session that is not a Spawn child. */
export declare function sessionBirth(id: string): number[] | null;
/**
 * Spawn children are DSH subagents: the subagent manager creates each one,
 * holds its capacity slot, joins it for the host and tears it down. This
 * provider only hands over the child's seed.
 */
export declare function spineSubagentProvider(starting: ReadonlyMap<string, readonly SessionEvent[]>): SubagentProvider;
/**
 * One Spawn child: a subagent forked from its parent's log just before the
 * sampling that bore it, given its assignment. It is judged each time it goes
 * idle after a turn of its own: it arrives once its log ends it, its parent
 * cancelled it, or it has every child of its own joined and its log still
 * does not end it. The arrival is handed over on that idle, before the
 * manager can release the child, so a host that waits for its subagents
 * never sees the parent done with an arrival still to come.
 */
export declare function executeChild(world: SpineWorld, parent: Agent, birth: SpawnBirth, peers: readonly SpawnTask[], prefixEnd: number, signal: AbortSignal, arrive: (arrival: SpawnArrival) => void, started: () => void): Promise<SpawnArrival>;
/** Read final results from each child's own log before reporting unfinished children as aborted. */
export declare function recoverChildren(world: SpineWorld, parent: Agent, births: readonly SpawnBirth[], beforeRead: (id: SessionId) => Promise<void>): Promise<SpawnArrival[]>;
//# sourceMappingURL=spawn.d.ts.map