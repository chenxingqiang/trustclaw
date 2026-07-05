#!/usr/bin/env node
/**
 * Build TrustClaw Windows portable zip (config + runtime + PowerShell launcher).
 * Can be built on macOS; first Windows start runs `npm ci --omit=dev` if node_modules absent.
 */
import { spawnSync } from "node:child_process";
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

function readPkgVersion() {
  return JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).version ?? "0.0.0";
}

function runNode(script, env = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runPnpm(args) {
  const result = spawnSync("pnpm", args, { cwd: repoRoot, stdio: "inherit", shell: true });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function shouldSkipDistEntry(name) {
  return (
    name === "trustclaw-mac-bundle" ||
    name.startsWith("TrustClaw-") ||
    name.startsWith("OpenClaw-") ||
    name.endsWith(".dmg") ||
    name.endsWith(".zip") ||
    name.endsWith(".app")
  );
}

function copyDistArtifacts(stagingRuntime) {
  const srcDist = path.join(repoRoot, "dist");
  const destDist = path.join(stagingRuntime, "dist");
  if (!existsSync(srcDist)) {
    throw new Error("Missing required runtime path: dist");
  }
  mkdirSync(destDist, { recursive: true });
  for (const entry of readdirSync(srcDist, { withFileTypes: true })) {
    if (shouldSkipDistEntry(entry.name)) {
      continue;
    }
    cpSync(path.join(srcDist, entry.name), path.join(destDist, entry.name), {
      recursive: true,
      force: true,
    });
  }
}

function copyRuntimeTree(stagingRuntime) {
  copyDistArtifacts(stagingRuntime);
  const pairs = [
    ["openclaw.mjs", "openclaw.mjs"],
    ["package.json", "package.json"],
    ["npm-shrinkwrap.json", "npm-shrinkwrap.json"],
    ["pnpm-workspace.yaml", "pnpm-workspace.yaml"],
    [".npmrc", ".npmrc"],
    ["patches", "patches"],
    ["extensions/trustclaw-tra", "extensions/trustclaw-tra"],
    ["src/agents/templates", "src/agents/templates"],
  ];
  for (const [srcRel, destRel] of pairs) {
    const src = path.join(repoRoot, srcRel);
    const dest = path.join(stagingRuntime, destRel);
    if (!existsSync(src)) {
      if (srcRel === "openclaw.mjs" || srcRel === "package.json") {
        throw new Error(`Missing required runtime path: ${srcRel}`);
      }
      continue;
    }
    cpSync(src, dest, { recursive: true, force: true });
  }
}

function writeReadme(stagingRoot, version) {
  writeFileSync(
    path.join(stagingRoot, "README.txt"),
    `TrustClaw ${version} (Windows portable)

1. Unzip to any folder (e.g. C:\\TrustClaw)
2. Double-click Start-TrustClaw.cmd
   - First launch runs npm ci --omit=dev (needs network)
   - Config + API keys from build copy to %USERPROFILE%\\.openclaw
   - Browser opens automatically with the default gateway token
3. Or double-click "TrustClaw Connect.url" for one-click Control UI login

Default gateway token: trustclaw-local-default
Control UI: http://127.0.0.1:19001/#token=trustclaw-local-default

Requires Windows 10+ and Node.js 24+.

Native WinUI "Windows Hub" is a separate OpenClaw release; this zip is TrustClaw Gateway + TRA + bundled config.
`,
    "utf8",
  );
}

function writeRootLauncher(stagingRoot) {
  writeFileSync(
    path.join(stagingRoot, "Start-TrustClaw.cmd"),
    `@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\Start-TrustClaw.ps1" %*
exit /b %ERRORLEVEL%
`,
    "utf8",
  );
}

function main() {
  const version = readPkgVersion();
  const arch = process.env.TRUSTCLAW_WIN_ARCH?.trim() || "x64";
  const packageName = `TrustClaw-${version}-win-${arch}`;
  const stagingRoot = path.join(repoRoot, ".tmp", packageName);
  const zipPath = path.join(repoRoot, "dist", `${packageName}.zip`);
  const bundleOut = path.join(stagingRoot, "bundled-state");

  if (process.env.SKIP_TRUSTCLAW_SETUP !== "1") {
    runNode(path.join(repoRoot, "scripts/trustclaw-setup.mjs"));
  }
  if (process.env.SKIP_BUILD !== "1") {
    runPnpm(["build"]);
    runPnpm(["trustclaw:ui:build"]);
  }

  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(path.dirname(stagingRoot), { recursive: true });
  mkdirSync(stagingRoot, { recursive: true });

  runNode(path.join(repoRoot, "scripts/trustclaw-bundle-mac-config.mjs"), {
    TRUSTCLAW_BUNDLE_OUT_DIR: bundleOut,
    TRUSTCLAW_BUNDLE_LOG_TAG: "trustclaw:win:bundle",
    TRUSTCLAW_PACKAGED_DIST: "1",
  });

  const connectUrl = path.join(bundleOut, "trustclaw-connect.url");
  if (existsSync(connectUrl)) {
    cpSync(connectUrl, path.join(stagingRoot, "TrustClaw Connect.url"), { force: true });
  }
  const authTxt = path.join(bundleOut, "TRUSTCLAW-AUTH.txt");
  if (existsSync(authTxt)) {
    cpSync(authTxt, path.join(stagingRoot, "TRUSTCLAW-AUTH.txt"), { force: true });
  }

  mkdirSync(path.join(stagingRoot, "trustclaw"), { recursive: true });
  cpSync(path.join(repoRoot, "trustclaw/agents"), path.join(stagingRoot, "trustclaw/agents"), {
    recursive: true,
    force: true,
  });

  const stagingRuntime = path.join(stagingRoot, "runtime");
  mkdirSync(stagingRuntime, { recursive: true });
  copyRuntimeTree(stagingRuntime);

  mkdirSync(path.join(stagingRoot, "scripts"), { recursive: true });
  for (const name of ["Start-TrustClaw.ps1", "Init-TrustClawConfig.ps1"]) {
    cpSync(path.join(repoRoot, "scripts/windows", name), path.join(stagingRoot, "scripts", name), {
      force: true,
    });
  }
  writeRootLauncher(stagingRoot);
  writeReadme(stagingRoot, version);

  rmSync(zipPath, { force: true });
  if (process.platform === "darwin") {
    execSync(`ditto -c -k --sequesterRsrc --keepParent "${stagingRoot}" "${zipPath}"`, {
      stdio: "inherit",
    });
  } else {
    execSync(`zip -r "${zipPath}" "${path.basename(stagingRoot)}"`, {
      cwd: path.dirname(stagingRoot),
      stdio: "inherit",
    });
  }

  console.log(`[trustclaw:win:dist] ✅ ${zipPath}`);
}

main();
