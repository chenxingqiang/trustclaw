import { existsSync, readFileSync, readdirSync } from "node:fs";
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
    if (!entry.isDirectory() || entry.name.startsWith("_")) {
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
