import type { TrustclawPluginConfig } from "../../tra/config.js";
import { resolveTrustclawPaths } from "../../tra/config.js";
import { getSessionAgentPackId, getSessionAgentPackLock } from "../../tra/session-agent-pack.js";
import { resolveCoordinatorAgentPack, type CoordinatorPackSource } from "../coordinator/index.js";

/** @deprecated Prefer resolveCoordinatorAgentPack; read-only preview without lock binding. */
export type SessionAgentPackSource = Exclude<CoordinatorPackSource, "lock" | "request">;

export function resolveSessionAgentPack(params: {
  sessionKey: string;
  openclawAgentId?: string;
  pluginConfig?: TrustclawPluginConfig;
}): {
  pack: ReturnType<typeof resolveCoordinatorAgentPack>["pack"];
  source: SessionAgentPackSource;
} {
  const resolved = resolveCoordinatorAgentPack({
    ...params,
    bindLock: false,
  });
  const source: SessionAgentPackSource =
    resolved.source === "lock" || resolved.source === "request" ? "session" : resolved.source;
  return { pack: resolved.pack, source };
}

export {
  resolveCoordinatorAgentPack,
  type CoordinatorPackResolution,
} from "../coordinator/index.js";

export function resolveBoundAgentPack(params: {
  sessionKey: string;
  openclawAgentId?: string;
  requestedPackId?: string;
  pluginConfig?: TrustclawPluginConfig;
}) {
  return resolveCoordinatorAgentPack({
    ...params,
    bindLock: true,
  });
}

export function readSessionPackOverrides(
  sessionKey: string,
  pluginConfig?: TrustclawPluginConfig,
): { sessionOverride: string | null; lockPackId: string | null } {
  const paths = resolveTrustclawPaths(pluginConfig);
  const overrides = { dbPath: paths.dbPath, auditDir: paths.auditDir };
  return {
    sessionOverride: getSessionAgentPackId(sessionKey, overrides) ?? null,
    lockPackId: getSessionAgentPackLock(sessionKey, overrides) ?? null,
  };
}
