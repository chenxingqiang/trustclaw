import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_AGENT_PACK_ID } from "../runtime/agent-pack/schema.js";
import { resolveTraAuditDir, type TraPathOverrides } from "./paths.js";

type PackGrantEntry = {
  allow_always: boolean;
  session_keys: string[];
};

type ConsentGrantFileV2 = {
  version: 2;
  packs: Record<string, PackGrantEntry>;
};

/** Legacy single-pack shape (pre domain-agent decoupling). */
type ConsentGrantFileV1 = {
  allow_always?: boolean;
  session_keys?: string[];
};

const EMPTY_V2: ConsentGrantFileV2 = { version: 2, packs: {} };

function resolveConsentGrantPath(auditDir: string): string {
  return path.join(auditDir, "consent-grants.json");
}

function emptyPackEntry(): PackGrantEntry {
  return { allow_always: false, session_keys: [] };
}

function readGrantFile(grantPath: string): ConsentGrantFileV2 {
  try {
    const raw = readFileSync(grantPath, "utf8");
    const parsed = JSON.parse(raw) as ConsentGrantFileV1 & Partial<ConsentGrantFileV2>;
    if (parsed.version === 2 && parsed.packs && typeof parsed.packs === "object") {
      const packs: Record<string, PackGrantEntry> = {};
      for (const [packId, entry] of Object.entries(parsed.packs)) {
        packs[packId] = {
          allow_always: entry?.allow_always === true,
          session_keys: Array.isArray(entry?.session_keys)
            ? entry.session_keys.filter((value): value is string => typeof value === "string")
            : [],
        };
      }
      return { version: 2, packs };
    }
    // Migrate v1 global grant to default pack only.
    return {
      version: 2,
      packs: {
        [DEFAULT_AGENT_PACK_ID]: {
          allow_always: parsed.allow_always === true,
          session_keys: Array.isArray(parsed.session_keys)
            ? parsed.session_keys.filter((value): value is string => typeof value === "string")
            : [],
        },
      },
    };
  } catch {
    return { ...EMPTY_V2, packs: {} };
  }
}

function writeGrantFile(grantPath: string, grants: ConsentGrantFileV2): void {
  mkdirSync(path.dirname(grantPath), { recursive: true });
  writeFileSync(grantPath, `${JSON.stringify(grants, null, 2)}\n`, "utf8");
}

function resolvePackEntry(file: ConsentGrantFileV2, agentPackId: string): PackGrantEntry {
  return file.packs[agentPackId] ?? emptyPackEntry();
}

export function resolveTraConsentGrantPath(
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const auditDir = overrides?.auditDir?.trim() || resolveTraAuditDir(overrides, env);
  return resolveConsentGrantPath(auditDir);
}

export function hasTraDataAccessGrant(
  sessionKey: string,
  agentPackId: string,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const grantPath = resolveTraConsentGrantPath(overrides, env);
  const file = readGrantFile(grantPath);
  const entry = resolvePackEntry(file, agentPackId.trim());
  if (entry.allow_always) {
    return true;
  }
  return entry.session_keys.includes(sessionKey);
}

export function grantTraDataAccess(
  sessionKey: string,
  agentPackId: string,
  mode: "allow-once" | "allow-always",
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (mode === "allow-once") {
    return;
  }
  const packId = agentPackId.trim();
  const grantPath = resolveTraConsentGrantPath(overrides, env);
  const file = readGrantFile(grantPath);
  const entry = resolvePackEntry(file, packId);
  entry.allow_always = true;
  if (!entry.session_keys.includes(sessionKey)) {
    entry.session_keys.push(sessionKey);
  }
  file.packs[packId] = entry;
  writeGrantFile(grantPath, file);
}

export function clearTraDataAccessGrants(
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const grantPath = resolveTraConsentGrantPath(overrides, env);
  writeGrantFile(grantPath, { version: 2, packs: {} });
}
