import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function resolveTrustclawRoot(moduleUrl: string = import.meta.url): string {
  const moduleDir = path.dirname(fileURLToPath(moduleUrl));
  const candidates = [
    path.resolve(moduleDir, ".."),
    path.resolve(moduleDir, "..", "..", "..", "trustclaw"),
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "ptds/schema/v1.1.sql"))) {
      return root;
    }
  }
  return path.resolve(moduleDir, "..");
}

const TRUSTCLAW_ROOT = resolveTrustclawRoot();

export const PTDS_SCHEMA_V11_SQL = path.join(TRUSTCLAW_ROOT, "ptds/schema/v1.1.sql");
export const PTDS_COMPLIANCE_STANDARDS_SQL = path.join(
  TRUSTCLAW_ROOT,
  "ptds/schema/compliance-standards.v1.sql",
);
export const PTDS_REFERENCE_SYNC_SQL = path.join(
  TRUSTCLAW_ROOT,
  "ptds/schema/reference-sync.v1.sql",
);
export const PTDS_PRESCRIPTION_CONTEXT_SQL = path.join(
  TRUSTCLAW_ROOT,
  "ptds/schema/prescription-context.v1.sql",
);
export const PTDS_SEED_NRDL_GLP1_SQL = path.join(TRUSTCLAW_ROOT, "ptds/seeds/nrdl-glp1-seed.sql");
export const PTDS_SEED_GLP1_AST_V2_JSON = path.join(
  TRUSTCLAW_ROOT,
  "ptds/seeds/external/glp1-nrdl-ast-handshake-v2.json",
);
export const PTDS_SEED_NRDL_REFERENCE_GLP1_JSON = path.join(
  TRUSTCLAW_ROOT,
  "ptds/seeds/external/nrdl-reference-glp1-v1.json",
);
export const PTDS_TEMPLATE_DB = path.join(TRUSTCLAW_ROOT, "ptds/seeds/local_ptds.template.db");

/** Mirrors OpenClaw `resolveOpenClawStateSqliteDir` without importing core. */
export function resolvePtdsStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.OPENCLAW_STATE_DIR?.trim();
  const root = override
    ? path.resolve(override)
    : env.VITEST || env.NODE_ENV === "test"
      ? path.join(os.tmpdir(), "openclaw-test-state", String(process.pid))
      : path.join(os.homedir(), ".openclaw");
  return path.join(root, "state");
}

export type PtdsPathOverrides = {
  dbPath?: string;
  auditDir?: string;
  evidenceDir?: string;
};

export function resolvePtdsDbPath(
  overrides: PtdsPathOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (overrides.dbPath?.trim()) {
    return path.resolve(overrides.dbPath.trim());
  }
  const envOverride = env.TRUSTCLAW_PTDS_DB?.trim();
  if (envOverride) {
    return path.resolve(envOverride);
  }
  return path.join(resolvePtdsStateDir(env), "local_ptds.db");
}

export function resolvePtdsAuditDir(
  overrides: PtdsPathOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (overrides.auditDir?.trim()) {
    return path.resolve(overrides.auditDir.trim());
  }
  return path.join(resolvePtdsStateDir(env), "ptds-audit");
}

export function resolvePtdsEvidenceDir(
  overrides: PtdsPathOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (overrides.evidenceDir?.trim()) {
    return path.resolve(overrides.evidenceDir.trim());
  }
  return path.join(resolvePtdsStateDir(env), "ptds-evidence");
}
