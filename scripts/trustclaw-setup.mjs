#!/usr/bin/env node
// Ensures TrustClaw PTDS plugin is enabled for local fork demos.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const result = spawnSync(
  process.execPath,
  [
    path.join(repoRoot, "scripts/run-node.mjs"),
    "openclaw",
    "config",
    "set",
    "plugins.entries.trustclaw-ptds.enabled",
    "true",
  ],
  { cwd: repoRoot, stdio: "inherit", env: process.env },
);

process.exit(result.status ?? (result.error ? 1 : 0));
