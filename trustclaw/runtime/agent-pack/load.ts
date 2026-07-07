import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  agentPackDocumentSchema,
  type AgentPackDocument,
  type ResolvedAgentPack,
} from "./schema.js";

const PACK_FILENAME = "agent.pack.json";
const GLP1_PACK_MARKER = path.join("glp1", PACK_FILENAME);

function resolveTrustclawAgentsDir(moduleUrl: string = import.meta.url): string {
  const moduleDir = path.dirname(fileURLToPath(moduleUrl));
  const candidates = [
    path.resolve(moduleDir, "..", "..", "agents"),
    path.resolve(moduleDir, "..", "..", "..", "trustclaw", "agents"),
  ];
  for (const agentsDir of candidates) {
    if (existsSync(path.join(agentsDir, GLP1_PACK_MARKER))) {
      return agentsDir;
    }
  }
  return candidates[0]!;
}

export function resolveDefaultAgentsDir(): string {
  return resolveTrustclawAgentsDir();
}

export function resolvePackAssetPath(packDir: string, relativePath: string): string {
  const normalized = relativePath.replace(/^\.\//, "");
  const resolved = path.resolve(packDir, normalized);
  const packRoot = path.resolve(packDir);
  if (!resolved.startsWith(packRoot + path.sep) && resolved !== packRoot) {
    throw new Error(`Agent pack asset escapes pack directory: ${relativePath}`);
  }
  return resolved;
}

export function readPackAsset(packDir: string, relativePath: string): string {
  const assetPath = resolvePackAssetPath(packDir, relativePath);
  return readFileSync(assetPath, "utf8").trim();
}

export function loadAgentPackFromFile(packFile: string): ResolvedAgentPack {
  const packDir = path.dirname(packFile);
  const raw = JSON.parse(readFileSync(packFile, "utf8")) as unknown;
  const parsed = agentPackDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid agent pack ${packFile}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  return {
    ...parsed.data,
    packDir,
    packFile,
  };
}

export function discoverAgentPackFiles(agentsDir: string): string[] {
  if (!existsSync(agentsDir)) {
    return [];
  }
  const entries = readdirSync(agentsDir, { withFileTypes: true });
  const packFiles: string[] = [];
  for (const entry of entries) {
    // Skip `_schema`, `_template`, and other non-runtime pack scaffolding.
    if (entry.name.startsWith("_")) {
      continue;
    }
    // Symlinked pack dirs (e.g. merged agents dir) are not isDirectory() but still ship agent.pack.json.
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    const packFile = path.join(agentsDir, entry.name, PACK_FILENAME);
    if (existsSync(packFile)) {
      packFiles.push(packFile);
    }
  }
  return packFiles.sort();
}

export function loadAgentPacksFromDir(agentsDir: string): ResolvedAgentPack[] {
  return discoverAgentPackFiles(agentsDir).map((packFile) => loadAgentPackFromFile(packFile));
}

export function validateAgentPackDocument(raw: unknown): AgentPackDocument {
  const parsed = agentPackDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}

export type AgentPackValidationIssue = {
  path: string;
  message: string;
};

export type AgentPackValidationResult =
  | { ok: true; pack: AgentPackDocument }
  | { ok: false; issues: AgentPackValidationIssue[] };

/** Structured pack manifest validation for Phase 4 authoring (no filesystem write). */
export function inspectAgentPackDocument(raw: unknown): AgentPackValidationResult {
  const parsed = agentPackDocumentSchema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, pack: parsed.data };
  }
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
      message: issue.message,
    })),
  };
}

function assertPackDirUnderAgentsRoot(agentsDir: string, packId: string): string {
  const agentsRoot = path.resolve(agentsDir);
  const packDir = path.resolve(agentsDir, packId);
  if (!packDir.startsWith(agentsRoot + path.sep) && packDir !== agentsRoot) {
    throw new Error(`Agent pack directory escapes agents dir: ${packId}`);
  }
  return packDir;
}

/** Persist a validated pack manifest under `packDir/agent.pack.json`. */
export function writeAgentPackDocument(
  agentsDir: string,
  pack: AgentPackDocument,
  options?: { packDir?: string },
): { packDir: string; packFile: string } {
  const agentsRoot = path.resolve(agentsDir);
  const packDir = options?.packDir?.trim()
    ? path.resolve(options.packDir)
    : assertPackDirUnderAgentsRoot(agentsDir, pack.id);
  if (!packDir.startsWith(agentsRoot + path.sep) && packDir !== agentsRoot) {
    throw new Error(`Refusing to write pack outside agents dir: ${pack.id}`);
  }
  mkdirSync(packDir, { recursive: true });
  const packFile = path.join(packDir, PACK_FILENAME);
  writeFileSync(packFile, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  return { packDir, packFile };
}

/** Remove a pack directory tree; caller must ensure `packDir` stays under `agentsDir`. */
export function deleteAgentPackDirectory(agentsDir: string, packDir: string): void {
  const agentsRoot = path.resolve(agentsDir);
  const resolved = path.resolve(packDir);
  if (!resolved.startsWith(agentsRoot + path.sep) && resolved !== agentsRoot) {
    throw new Error("Refusing to delete pack outside agents dir");
  }
  rmSync(resolved, { recursive: true, force: true });
}
