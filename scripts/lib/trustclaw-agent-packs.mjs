import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const PACK_FILENAME = "agent.pack.json";

/**
 * Copy bundled agent pack directories into operator-owned agentPacksDir when missing.
 * Skips `_`-prefixed scaffolding dirs; never overwrites an existing pack folder.
 */
export function seedBundledAgentPacksIfMissing(bundledAgentsDir, targetAgentsDir) {
  const seeded = [];
  const skipped = [];
  if (!existsSync(bundledAgentsDir)) {
    return { seeded, skipped };
  }
  mkdirSync(targetAgentsDir, { recursive: true });
  for (const entry of readdirSync(bundledAgentsDir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) {
      continue;
    }
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    const packFile = path.join(bundledAgentsDir, entry.name, PACK_FILENAME);
    if (!existsSync(packFile)) {
      continue;
    }
    const targetDir = path.join(targetAgentsDir, entry.name);
    if (existsSync(targetDir)) {
      skipped.push(entry.name);
      continue;
    }
    cpSync(path.join(bundledAgentsDir, entry.name), targetDir, { recursive: true });
    seeded.push(entry.name);
  }
  return { seeded, skipped };
}

export function resolveOperatorAgentPacksDir(stateDir) {
  return path.join(stateDir, "agent-packs");
}
