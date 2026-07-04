import type { IncomingMessage } from "node:http";
import {
  hasAgentDomainGrant,
  type AgentDomainScope,
} from "../../../trustclaw/ptds/agent-domain-grants.js";
import type { TrustclawPluginConfig } from "../../../trustclaw/ptds/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/ptds/config.js";
import {
  getAgentPackRegistry,
  type ResolvedAgentPack,
} from "../../../trustclaw/runtime/agent-pack/index.js";

export type AgentGrantGuardResult =
  | { ok: true; pack: ResolvedAgentPack; paths: ReturnType<typeof resolveTrustclawPaths> }
  | { ok: false; status: number; message: string };

export function readAgentPackIdFromRequest(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  const fromQuery = url.searchParams.get("agentPackId")?.trim();
  if (fromQuery) {
    return fromQuery;
  }
  const fromHeader = req.headers["x-trustclaw-agent-pack"]?.toString().trim();
  return fromHeader || null;
}

export function requireAgentDomainGrant(
  req: IncomingMessage,
  scope: AgentDomainScope,
  pluginConfig: TrustclawPluginConfig | undefined,
): AgentGrantGuardResult {
  const agentPackId = readAgentPackIdFromRequest(req);
  if (!agentPackId) {
    return {
      ok: false,
      status: 400,
      message: "Missing agentPackId query parameter (domain agent authorization).",
    };
  }

  let pack: ResolvedAgentPack;
  try {
    const registry = getAgentPackRegistry({
      agentsDir: pluginConfig?.agentPacksDir,
      defaultPackId: pluginConfig?.defaultAgentPack,
    });
    const resolved = registry.get(agentPackId);
    if (!resolved) {
      return { ok: false, status: 404, message: `Unknown agent pack: ${agentPackId}` };
    }
    pack = resolved;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 500, message };
  }

  const paths = resolveTrustclawPaths(pluginConfig);
  const overrides = { dbPath: paths.dbPath, auditDir: paths.auditDir };
  if (!hasAgentDomainGrant(pack.id, scope, overrides)) {
    return {
      ok: false,
      status: 403,
      message: `Domain agent "${pack.id}" is not granted scope "${scope}". Grant permissions in Panel C.`,
    };
  }

  return { ok: true, pack, paths };
}
