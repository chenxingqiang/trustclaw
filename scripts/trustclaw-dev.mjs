#!/usr/bin/env node
// One-command TrustClaw dev loop: enable plugin, start gateway + demo UI dev server.
import { execSync, spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const children = [];

const gatewayPort =
  process.env.OPENCLAW_GATEWAY_PORT ?? process.env.TRUSTCLAW_GATEWAY_PORT ?? "19001";
const uiPort = process.env.TRUSTCLAW_UI_PORT ?? "5174";

function listenerPid(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const pid = out.split("\n").find((line) => /^\d+$/.test(line.trim()));
    return pid ? Number(pid) : null;
  } catch {
    return null;
  }
}

function assertDevPortsFree() {
  const conflicts = [];
  for (const [label, port] of [
    ["Gateway", gatewayPort],
    ["TrustClaw UI (Vite)", uiPort],
  ]) {
    const pid = listenerPid(port);
    if (pid != null) {
      conflicts.push({ label, port, pid });
    }
  }
  if (conflicts.length === 0) {
    return;
  }

  console.error(
    "[trustclaw:dev] Dev ports already in use — another dev session may still be running:\n",
  );
  for (const { label, port, pid } of conflicts) {
    console.error(`  ${label}: :${port} (PID ${pid})`);
  }
  console.error(
    `\nIf that session is yours, open:\n` +
      `  http://127.0.0.1:${uiPort}/trustclaw/\n` +
      `  http://127.0.0.1:${gatewayPort}/\n` +
      `\nTo restart, stop the old process first (example: kill ${conflicts[0]?.pid}).\n` +
      `Or use another UI port: TRUSTCLAW_UI_PORT=5175 pnpm trustclaw:dev\n`,
  );
  process.exit(1);
}

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

console.log("[trustclaw:dev] Enabling trustclaw-ptds plugin in local dev config…");
const setup = spawnSync(
  process.execPath,
  [path.join(repoRoot, "scripts/trustclaw-setup.mjs"), "--dev"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  },
);
if ((setup.status ?? 1) !== 0) {
  process.exit(setup.status ?? 1);
}

assertDevPortsFree();

console.log("[trustclaw:dev] Starting Gateway (channels skipped) + TrustClaw UI (Vite)…");
console.log(
  `[trustclaw:dev] Open http://127.0.0.1:${uiPort}/trustclaw/ (API proxied to gateway :${gatewayPort} dev port)`,
);

const devEnv = {
  ...process.env,
  OPENCLAW_SKIP_CHANNELS: "1",
  OPENCLAW_GATEWAY_PORT: gatewayPort,
  TRUSTCLAW_GATEWAY_PORT: gatewayPort,
  TRUSTCLAW_UI_PORT: uiPort,
};

children.push(
  spawn(process.execPath, [path.join(repoRoot, "scripts/run-node.mjs"), "--dev", "gateway"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: devEnv,
  }),
);
children.push(
  spawn(process.execPath, [path.join(repoRoot, "scripts/trustclaw-ui.js"), "dev"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: devEnv,
  }),
);

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}
