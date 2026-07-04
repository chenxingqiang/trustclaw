#!/usr/bin/env node
// One-command TrustClaw dev loop: enable plugin, start gateway + demo UI dev server.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const children = [];

function runNodeScript(scriptRelPath, args = []) {
  return spawn(process.execPath, [path.join(repoRoot, scriptRelPath), ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[trustclaw:dev] Enabling trustclaw-ptds plugin in local config…");
const setup = spawnSync(process.execPath, [path.join(repoRoot, "scripts/trustclaw-setup.mjs")], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});
if ((setup.status ?? 1) !== 0) {
  process.exit(setup.status ?? 1);
}

console.log("[trustclaw:dev] Starting Gateway (channels skipped) + TrustClaw UI (Vite)…");
console.log("[trustclaw:dev] Open http://127.0.0.1:5174/trustclaw/ or Control UI → PTDS Console");

children.push(
  runNodeScript("scripts/run-with-env.mjs", [
    "OPENCLAW_SKIP_CHANNELS=1",
    "--",
    process.execPath,
    path.join(repoRoot, "scripts/run-node.mjs"),
    "--dev",
    "gateway",
    "--force",
  ]),
);
children.push(runNodeScript("scripts/trustclaw-ui.js", ["dev"]));

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}
