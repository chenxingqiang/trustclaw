#!/usr/bin/env node
import { spawnSync } from "node:child_process";
// Ensures TrustClaw PTDS plugin is enabled for local fork demos.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const workspaceTemplateDir = path.join(repoRoot, "trustclaw", "workspace", "dev");

const devArgs = process.argv.includes("--dev") ? ["--dev"] : [];

function enablePlugin(extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts/run-node.mjs"),
      ...extraArgs,
      "config",
      "set",
      "plugins.entries.trustclaw-ptds.enabled",
      "true",
    ],
    { cwd: repoRoot, stdio: "inherit", env: process.env },
  );
  return result.status ?? (result.error ? 1 : 0);
}

function syncDevWorkspace() {
  if (!existsSync(workspaceTemplateDir)) {
    return;
  }
  const targetDir = path.join(homedir(), ".openclaw", "workspace-dev");
  mkdirSync(targetDir, { recursive: true });
  for (const name of ["SOUL.md", "IDENTITY.md", "AGENTS.md"]) {
    const src = path.join(workspaceTemplateDir, name);
    if (existsSync(src)) {
      cpSync(src, path.join(targetDir, name), { force: true });
    }
  }
  console.log(`[trustclaw:setup] Synced PTDS workspace prompts → ${targetDir}`);
}

// Enable for default + dev profiles so Control UI (:18789) and trustclaw:dev (:19001) both work.
const profiles = devArgs.length > 0 ? [devArgs] : [[], ["--dev"]];
let exitCode = 0;
for (const profileArgs of profiles) {
  exitCode = enablePlugin(profileArgs);
  if (exitCode !== 0) {
    break;
  }
}

if (exitCode === 0) {
  syncDevWorkspace();
}

process.exit(exitCode);
