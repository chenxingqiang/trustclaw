import type { TrustclawPluginConfig } from "../../tra/config.js";
import { resolveTrustclawPaths } from "../../tra/config.js";
import {
  getSessionAgentPackId,
  getSessionAgentPackLock,
  setSessionAgentPackBinding,
  setSessionAgentPackLock,
} from "../../tra/session-agent-pack.js";
import { getAgentPackRegistry } from "../agent-pack/registry.js";
import type { ResolvedAgentPack } from "../agent-pack/schema.js";

export type CoordinatorPackSource = "session" | "lock" | "openclaw_agent" | "default" | "request";

export type CoordinatorPackResolution = {
  pack: ResolvedAgentPack;
  source: CoordinatorPackSource;
  locked: boolean;
  lock_pack_id: string | null;
  openclaw_suggested_pack_id: string | null;
  agent_pack_mismatch: boolean;
};

function resolveOpenClawSuggestedPack(
  registry: ReturnType<typeof getAgentPackRegistry>,
  openclawAgentId?: string,
): { pack: ResolvedAgentPack; source: "openclaw_agent" | "default" } {
  const agentId = openclawAgentId?.trim();
  if (agentId) {
    const byAgent = registry.resolve({ openclawAgentId: agentId });
    const defaultPack = registry.getDefault();
    if (byAgent.id !== defaultPack.id) {
      return { pack: byAgent, source: "openclaw_agent" };
    }
  }
  return { pack: registry.getDefault(), source: "default" };
}

export function resolveCoordinatorAgentPack(params: {
  sessionKey: string;
  openclawAgentId?: string;
  requestedPackId?: string;
  pluginConfig?: TrustclawPluginConfig;
  /** When true, persist coordinator lock for this session (prompt/tool hot paths). */
  bindLock?: boolean;
}): CoordinatorPackResolution {
  const paths = resolveTrustclawPaths(params.pluginConfig);
  const overrides = { dbPath: paths.dbPath, auditDir: paths.auditDir };
  const registry = getAgentPackRegistry({
    agentsDir: params.pluginConfig?.agentPacksDir,
    defaultPackId: params.pluginConfig?.defaultAgentPack,
  });
  const sessionKey = params.sessionKey.trim();
  const bindLock = params.bindLock === true;
  const suggested = resolveOpenClawSuggestedPack(registry, params.openclawAgentId);

  const requestedPackId = params.requestedPackId?.trim();
  if (requestedPackId) {
    const pack = registry.resolve({ packId: requestedPackId });
    if (bindLock && sessionKey) {
      setSessionAgentPackBinding(sessionKey, pack.id, overrides);
    }
    return {
      pack,
      source: "request",
      locked: bindLock,
      lock_pack_id: bindLock ? pack.id : (getSessionAgentPackLock(sessionKey, overrides) ?? null),
      openclaw_suggested_pack_id: suggested.pack.id,
      agent_pack_mismatch: suggested.pack.id !== pack.id,
    };
  }

  const sessionOverride = sessionKey ? getSessionAgentPackId(sessionKey, overrides) : undefined;
  if (sessionOverride) {
    const pack = registry.resolve({ packId: sessionOverride });
    if (bindLock && sessionKey) {
      setSessionAgentPackBinding(sessionKey, pack.id, overrides);
    }
    return {
      pack,
      source: "session",
      locked: !!getSessionAgentPackLock(sessionKey, overrides) || bindLock,
      lock_pack_id: getSessionAgentPackLock(sessionKey, overrides) ?? (bindLock ? pack.id : null),
      openclaw_suggested_pack_id: suggested.pack.id,
      agent_pack_mismatch: suggested.pack.id !== pack.id,
    };
  }

  const lockPackId = sessionKey ? getSessionAgentPackLock(sessionKey, overrides) : undefined;
  if (lockPackId) {
    const pack = registry.resolve({ packId: lockPackId });
    return {
      pack,
      source: "lock",
      locked: true,
      lock_pack_id: lockPackId,
      openclaw_suggested_pack_id: suggested.pack.id,
      agent_pack_mismatch: suggested.pack.id !== pack.id,
    };
  }

  const pack = suggested.pack;
  if (bindLock && sessionKey) {
    setSessionAgentPackLock(sessionKey, pack.id, overrides);
  }
  return {
    pack,
    source: suggested.source,
    locked: bindLock,
    lock_pack_id: bindLock ? pack.id : null,
    openclaw_suggested_pack_id: suggested.pack.id,
    agent_pack_mismatch: false,
  };
}
