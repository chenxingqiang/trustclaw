import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AgentDomainScope } from "./agent-domain-scopes.js";
import { isAgentDomainScope } from "./agent-domain-scopes.js";
import { resolveTraAuditDir, type TraPathOverrides } from "./paths.js";

type AgentDomainGrantEntry = {
  granted_at: number;
  scopes: AgentDomainScope[];
};

type AgentDomainGrantFile = {
  grants: Record<string, AgentDomainGrantEntry>;
};

const EMPTY_FILE: AgentDomainGrantFile = { grants: {} };

function resolveGrantPath(auditDir: string): string {
  return path.join(auditDir, "agent-domain-grants.json");
}

function readGrantFile(grantPath: string): AgentDomainGrantFile {
  try {
    const raw = readFileSync(grantPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AgentDomainGrantFile>;
    const grants: Record<string, AgentDomainGrantEntry> = {};
    if (parsed.grants && typeof parsed.grants === "object") {
      for (const [packId, entry] of Object.entries(parsed.grants)) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const scopes = Array.isArray(entry.scopes)
          ? entry.scopes.filter((scope): scope is AgentDomainScope => isAgentDomainScope(scope))
          : [];
        grants[packId] = {
          granted_at: typeof entry.granted_at === "number" ? entry.granted_at : Date.now(),
          scopes,
        };
      }
    }
    return { grants };
  } catch {
    return { ...EMPTY_FILE };
  }
}

function writeGrantFile(grantPath: string, file: AgentDomainGrantFile): void {
  mkdirSync(path.dirname(grantPath), { recursive: true });
  writeFileSync(grantPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function resolveAgentDomainGrantPath(
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const auditDir = overrides?.auditDir?.trim() || resolveTraAuditDir(overrides, env);
  return resolveGrantPath(auditDir);
}

export function listAgentDomainGrants(
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, AgentDomainGrantEntry> {
  const grantPath = resolveAgentDomainGrantPath(overrides, env);
  return { ...readGrantFile(grantPath).grants };
}

export function getAgentDomainGrant(
  agentPackId: string,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): AgentDomainGrantEntry | null {
  const entry = listAgentDomainGrants(overrides, env)[agentPackId.trim()];
  return entry ?? null;
}

export function hasAgentDomainGrant(
  agentPackId: string,
  scope: AgentDomainScope,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const entry = getAgentDomainGrant(agentPackId, overrides, env);
  return entry?.scopes.includes(scope) === true;
}

export function setAgentDomainGrant(
  agentPackId: string,
  scopes: readonly AgentDomainScope[],
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): AgentDomainGrantEntry {
  const packId = agentPackId.trim();
  const grantPath = resolveAgentDomainGrantPath(overrides, env);
  const file = readGrantFile(grantPath);
  const entry: AgentDomainGrantEntry = {
    granted_at: Math.floor(Date.now() / 1000),
    scopes: [...new Set(scopes)],
  };
  if (entry.scopes.length === 0) {
    delete file.grants[packId];
  } else {
    file.grants[packId] = entry;
  }
  writeGrantFile(grantPath, file);
  return entry;
}

export function revokeAgentDomainGrant(
  agentPackId: string,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const packId = agentPackId.trim();
  const grantPath = resolveAgentDomainGrantPath(overrides, env);
  const file = readGrantFile(grantPath);
  delete file.grants[packId];
  writeGrantFile(grantPath, file);
}

export function clearAgentDomainGrants(
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const grantPath = resolveAgentDomainGrantPath(overrides, env);
  writeGrantFile(grantPath, { ...EMPTY_FILE });
}
