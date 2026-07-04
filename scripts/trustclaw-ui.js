#!/usr/bin/env node
// Routes TrustClaw demo UI package commands through repo wrappers.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePnpmRunner } from "./pnpm-runner.mjs";
import { buildCmdExeCommandLine, resolveWindowsCmdExePath } from "./windows-cmd-helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const uiDir = path.join(repoRoot, "trustclaw", "ui");

const WINDOWS_CMD_EXE_EXTENSIONS = new Set([".cmd", ".bat"]);

function usage() {
  process.stderr.write("Usage: node scripts/trustclaw-ui.js <install|dev|build|test> [...args]\n");
}

function shouldUseCmdExeForCommand(cmd, platform = process.platform) {
  if (platform !== "win32") {
    return false;
  }
  return WINDOWS_CMD_EXE_EXTENSIONS.has(path.extname(cmd).toLowerCase());
}

function resolveSpawnCall(cmd, args, envOverride, params = {}) {
  const platform = params.platform ?? process.platform;
  const options = {
    cwd: params.cwd ?? uiDir,
    stdio: "inherit",
    env: envOverride ?? process.env,
    shell: false,
  };
  if (shouldUseCmdExeForCommand(cmd, platform)) {
    const comSpec = params.comSpec ?? resolveWindowsCmdExePath(options.env);
    return {
      command: comSpec,
      args: ["/d", "/s", "/c", buildCmdExeCommandLine(cmd, args)],
      options: { ...options, windowsVerbatimArguments: true },
    };
  }
  return { command: cmd, args, options };
}

function resolvePnpmSpawnCall(pnpmArgs, envOverride, params = {}) {
  const env = envOverride ?? process.env;
  const cwd = params.cwd ?? uiDir;
  const runner = resolvePnpmRunner({
    cwd,
    env,
    pnpmArgs,
    nodeExecPath: params.nodeExecPath ?? process.execPath,
    npmExecPath: params.npmExecPath ?? env.npm_execpath,
    comSpec: params.comSpec,
    platform: params.platform ?? process.platform,
  });
  return {
    command: runner.command,
    args: runner.args,
    options: {
      cwd,
      stdio: "inherit",
      env,
      shell: runner.shell,
      windowsVerbatimArguments: runner.windowsVerbatimArguments,
    },
  };
}

function runSpawnCall(spawnCall) {
  const { command, args, options } = spawnCall;
  const child = spawn(command, args, options);
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    if (code !== 0) {
      process.exit(code ?? 1);
    }
  });
}

function runPnpm(args) {
  runSpawnCall(resolvePnpmSpawnCall(args));
}

function runPnpmSync(args) {
  const { command, args: spawnArgs, options } = resolvePnpmSpawnCall(args);
  const result = spawnSync(command, spawnArgs, options);
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function depsInstalled(kind) {
  try {
    const require = createRequire(path.join(uiDir, "package.json"));
    require.resolve("vite");
    if (kind === "test") {
      require.resolve("vitest");
    }
    return true;
  } catch {
    return false;
  }
}

function resolveViteBin() {
  const fromUi = path.join(repoRoot, "ui", "node_modules", "vite", "bin", "vite.js");
  if (fs.existsSync(fromUi)) {
    return fromUi;
  }
  const fromTrustclawUi = path.join(uiDir, "node_modules", "vite", "bin", "vite.js");
  if (fs.existsSync(fromTrustclawUi)) {
    return fromTrustclawUi;
  }
  throw new Error("vite not found; run pnpm install in repo root (ui package provides vite).");
}

function main(argv = process.argv.slice(2)) {
  const [action, ...rest] = argv;
  if (!action) {
    usage();
    process.exit(2);
  }
  if (action === "install") {
    runPnpm(["install", ...rest]);
    return;
  }
  const script =
    action === "dev" ? "dev" : action === "build" ? "build" : action === "test" ? "test" : null;
  if (!script) {
    usage();
    process.exit(2);
  }
  if (script === "dev" || script === "build") {
    runSpawnCall(
      resolveSpawnCall(process.execPath, [
        resolveViteBin(),
        script,
        "--config",
        path.join(uiDir, "vite.config.ts"),
        ...rest,
      ]),
    );
    return;
  }
  if (!depsInstalled("test")) {
    runPnpmSync(["install"]);
  }
  runPnpm(["run", script, ...rest]);
}

if (
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))
) {
  main();
}
