import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveTraAuditDir, type TraPathOverrides } from "./paths.js";

type SessionAgentPackFile = {
  sessions: Record<string, string>;
  locks: Record<string, string>;
};

const EMPTY_FILE: SessionAgentPackFile = {
  sessions: {},
  locks: {},
};

function resolveSessionAgentPackPath(auditDir: string): string {
  return path.join(auditDir, "session-agent-packs.json");
}

function readStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" &&
        entry[0].trim().length > 0 &&
        typeof entry[1] === "string" &&
        entry[1].trim().length > 0,
    ),
  );
}

function readSessionAgentPackFile(filePath: string): SessionAgentPackFile {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SessionAgentPackFile>;
    return {
      sessions: readStringMap(parsed.sessions),
      locks: readStringMap(parsed.locks),
    };
  } catch {
    return { ...EMPTY_FILE };
  }
}

function writeSessionAgentPackFile(filePath: string, data: SessionAgentPackFile): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function pathOverrides(overrides?: TraPathOverrides, env: NodeJS.ProcessEnv = process.env) {
  const auditDir = overrides?.auditDir?.trim() || resolveTraAuditDir(overrides, env);
  return { auditDir, filePath: resolveSessionAgentPackPath(auditDir) };
}

export function resolveTraSessionAgentPackPath(
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return pathOverrides(overrides, env).filePath;
}

export function getSessionAgentPackId(
  sessionKey: string,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const key = sessionKey.trim();
  if (!key) {
    return undefined;
  }
  const { filePath } = pathOverrides(overrides, env);
  const file = readSessionAgentPackFile(filePath);
  return file.sessions[key]?.trim() || undefined;
}

export function getSessionAgentPackLock(
  sessionKey: string,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const key = sessionKey.trim();
  if (!key) {
    return undefined;
  }
  const { filePath } = pathOverrides(overrides, env);
  const file = readSessionAgentPackFile(filePath);
  return file.locks[key]?.trim() || undefined;
}

export function setSessionAgentPackLock(
  sessionKey: string,
  packId: string,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const key = sessionKey.trim();
  const id = packId.trim();
  if (!key || !id) {
    throw new Error("sessionKey and packId are required.");
  }
  const { filePath } = pathOverrides(overrides, env);
  const file = readSessionAgentPackFile(filePath);
  file.locks[key] = id;
  writeSessionAgentPackFile(filePath, file);
}

/** Explicit Panel C selection: binds session override and coordinator lock together. */
export function setSessionAgentPackBinding(
  sessionKey: string,
  packId: string,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const key = sessionKey.trim();
  const id = packId.trim();
  if (!key || !id) {
    throw new Error("sessionKey and packId are required.");
  }
  const { filePath } = pathOverrides(overrides, env);
  const file = readSessionAgentPackFile(filePath);
  file.sessions[key] = id;
  file.locks[key] = id;
  writeSessionAgentPackFile(filePath, file);
}

/** @deprecated Use setSessionAgentPackBinding for coordinator-aware writes. */
export function setSessionAgentPackId(
  sessionKey: string,
  packId: string,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  setSessionAgentPackBinding(sessionKey, packId, overrides, env);
}

export function clearSessionAgentPackBinding(
  sessionKey: string,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const key = sessionKey.trim();
  if (!key) {
    return;
  }
  const { filePath } = pathOverrides(overrides, env);
  const file = readSessionAgentPackFile(filePath);
  let changed = false;
  if (key in file.sessions) {
    delete file.sessions[key];
    changed = true;
  }
  if (key in file.locks) {
    delete file.locks[key];
    changed = true;
  }
  if (changed) {
    writeSessionAgentPackFile(filePath, file);
  }
}

/** @deprecated Use clearSessionAgentPackBinding. */
export function clearSessionAgentPackId(
  sessionKey: string,
  overrides?: TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): void {
  clearSessionAgentPackBinding(sessionKey, overrides, env);
}
