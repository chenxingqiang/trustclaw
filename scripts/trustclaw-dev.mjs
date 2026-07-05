#!/usr/bin/env node
// One-command TrustClaw dev loop: enable plugin, start gateway + demo UI dev server.
import { execSync, spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TRUSTCLAW_DEFAULT_UI_PORT,
  resolveTrustclawGatewayPort,
} from "./lib/trustclaw-defaults.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const children = [];

const gatewayPort = resolveTrustclawGatewayPort();
const uiPort = process.env.TRUSTCLAW_UI_PORT ?? TRUSTCLAW_DEFAULT_UI_PORT;

function listenerPids(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out
      .split("\n")
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

function listenerPid(port) {
  return listenerPids(port)[0] ?? null;
}

function stopPortListeners(port) {
  for (const pid of listenerPids(port)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore stale PID
    }
  }
}

async function waitForPortFree(port, timeoutMs = 5_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (listenerPid(port) == null) {
      return true;
    }
    await sleep(200);
  }
  return listenerPid(port) == null;
}

async function resolveDevPorts() {
  const gatewayPid = listenerPid(gatewayPort);
  const uiPid = listenerPid(uiPort);
  const restartRequested =
    process.env.TRUSTCLAW_DEV_RESTART === "1" || process.argv.includes("--restart");

  if (gatewayPid == null && uiPid == null) {
    return;
  }

  if (restartRequested) {
    console.log("[trustclaw:dev] Restart requested — stopping existing listeners…");
    if (gatewayPid != null) {
      stopPortListeners(gatewayPort);
    }
    if (uiPid != null) {
      stopPortListeners(uiPort);
    }
    const gatewayFree = gatewayPid == null || (await waitForPortFree(gatewayPort));
    const uiFree = uiPid == null || (await waitForPortFree(uiPort));
    if (!gatewayFree || !uiFree) {
      console.error(
        `[trustclaw:dev] Could not free dev ports after SIGTERM. Try: kill ${gatewayPid ?? uiPid}`,
      );
      process.exit(1);
    }
    return;
  }

  if (gatewayPid != null && uiPid != null) {
    console.log("[trustclaw:dev] Dev stack already running — reusing existing session:\n");
    console.log(`  TrustClaw UI: http://127.0.0.1:${uiPort}/trustclaw/`);
    console.log(`  Gateway:      http://127.0.0.1:${gatewayPort}/`);
    console.log(`  PIDs: gateway ${gatewayPid}, UI ${uiPid}`);
    console.log(
      `\nTo restart: TRUSTCLAW_DEV_RESTART=1 pnpm trustclaw:dev\n` +
        `Or another UI port: TRUSTCLAW_UI_PORT=5175 pnpm trustclaw:dev\n`,
    );
    process.exit(0);
  }

  const conflicts = [];
  if (gatewayPid != null) {
    conflicts.push({ label: "Gateway", port: gatewayPort, pid: gatewayPid });
  }
  if (uiPid != null) {
    conflicts.push({ label: "TrustClaw UI (Vite)", port: uiPort, pid: uiPid });
  }

  console.error(
    "[trustclaw:dev] Dev ports partially in use — stop the old session or restart cleanly:\n",
  );
  for (const { label, port, pid } of conflicts) {
    console.error(`  ${label}: :${port} (PID ${pid})`);
  }
  console.error(
    `\nRestart everything: TRUSTCLAW_DEV_RESTART=1 pnpm trustclaw:dev\n` +
      `Or use another UI port: TRUSTCLAW_UI_PORT=5175 pnpm trustclaw:dev\n`,
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Gateway rebuild on cold start can take 15–90s; Vite must not proxy until listen. */
async function waitForGatewayListen(port, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (listenerPid(port) != null) {
      return;
    }
    await sleep(500);
  }
  throw new Error(
    `[trustclaw:dev] Gateway did not listen on :${port} within ${Math.round(timeoutMs / 1000)}s`,
  );
}

async function assertDevPortsReady() {
  await resolveDevPorts();
}

function ensureControlUiPublicAssets() {
  const distUiDir = path.join(repoRoot, "dist", "control-ui");
  const publicUiDir = path.join(repoRoot, "ui", "public");
  const marker = path.join(distUiDir, "favicon.svg");
  if (existsSync(marker)) {
    return;
  }
  if (!existsSync(publicUiDir)) {
    console.warn(
      "[trustclaw:dev] ui/public missing; chat logos may not load until `pnpm ui:build`.",
    );
    return;
  }
  mkdirSync(distUiDir, { recursive: true });
  for (const name of [
    "favicon.svg",
    "apple-touch-icon.png",
    "favicon-32.png",
    "favicon.ico",
    "manifest.webmanifest",
  ]) {
    const src = path.join(publicUiDir, name);
    if (existsSync(src)) {
      cpSync(src, path.join(distUiDir, name), { force: true });
    }
  }
  console.log("[trustclaw:dev] Copied Control UI public icons → dist/control-ui/");
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

console.log("[trustclaw:dev] Enabling trustclaw-tra plugin in local dev config…");
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

ensureControlUiPublicAssets();

await assertDevPortsReady();

console.log("[trustclaw:dev] Starting Gateway (channels skipped)…");
console.log(`[trustclaw:dev] Waiting for gateway :${gatewayPort} before TrustClaw UI (Vite)…`);

const devEnv = {
  ...process.env,
  OPENCLAW_SKIP_CHANNELS: "1",
  OPENCLAW_GATEWAY_PORT: gatewayPort,
  TRUSTCLAW_GATEWAY_PORT: gatewayPort,
  TRUSTCLAW_UI_PORT: uiPort,
};

const gatewayChild = spawn(
  process.execPath,
  [path.join(repoRoot, "scripts/run-node.mjs"), "--dev", "gateway"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: devEnv,
  },
);
children.push(gatewayChild);

gatewayChild.on("exit", (code) => {
  if (code && code !== 0) {
    shutdown(code);
  }
});

try {
  await waitForGatewayListen(gatewayPort);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}

console.log(
  `[trustclaw:dev] Gateway ready. Open http://127.0.0.1:${uiPort}/trustclaw/ (API proxied to :${gatewayPort})`,
);

const uiChild = spawn(process.execPath, [path.join(repoRoot, "scripts/trustclaw-ui.js"), "dev"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: devEnv,
});
children.push(uiChild);

uiChild.on("exit", (code) => {
  if (code && code !== 0) {
    shutdown(code);
  }
});
