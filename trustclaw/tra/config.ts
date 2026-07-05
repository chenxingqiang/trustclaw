import type { TraPathOverrides } from "./paths.js";
import { resolveTraAuditDir, resolveTraDbPath, resolveTraEvidenceDir } from "./paths.js";

export type TrustclawPluginConfig = {
  dbPath?: string;
  auditDir?: string;
  evidenceDir?: string;
  /** Directory tree containing per-agent `agent.pack.json` files. */
  agentPacksDir?: string;
  /** Default pack id when OpenClaw agentId is not mapped (default: glp1-eligibility). */
  defaultAgentPack?: string;
};

export function resolveTrustclawPaths(
  pluginConfig: TrustclawPluginConfig | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Required<TraPathOverrides> & { dbPath: string; auditDir: string; evidenceDir: string } {
  const overrides: TraPathOverrides = {
    dbPath: typeof pluginConfig?.dbPath === "string" ? pluginConfig.dbPath : undefined,
    auditDir: typeof pluginConfig?.auditDir === "string" ? pluginConfig.auditDir : undefined,
    evidenceDir:
      typeof pluginConfig?.evidenceDir === "string" ? pluginConfig.evidenceDir : undefined,
  };
  return {
    ...overrides,
    dbPath: resolveTraDbPath(overrides, env),
    auditDir: resolveTraAuditDir(overrides, env),
    evidenceDir: resolveTraEvidenceDir(overrides, env),
  };
}
