#!/usr/bin/env node
/**
 * Stage TrustClaw OpenClaw state (config, auth, credentials, workspaces) for macOS DMG.
 * Sources local ~/.openclaw by default — never commit dist/trustclaw-mac-bundle/.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TRUSTCLAW_DEFAULT_GATEWAY_PORT,
  TRUSTCLAW_DEFAULT_GATEWAY_TOKEN,
  buildTrustclawDashboardUrl,
  resolveTrustclawPackagedGatewayToken,
} from "./lib/trustclaw-defaults.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const workspaceRoot = path.join(repoRoot, "trustclaw", "workspace");
const outDir =
  process.env.TRUSTCLAW_BUNDLE_OUT_DIR?.trim() ||
  path.join(repoRoot, "dist", "trustclaw-mac-bundle");
const logTag = process.env.TRUSTCLAW_BUNDLE_LOG_TAG?.trim() || "trustclaw:bundle";

const useDev = process.argv.includes("--dev");
const sourceStateDir =
  process.env.TRUSTCLAW_MAC_CONFIG_SOURCE?.trim() ||
  path.join(homedir(), useDev ? ".openclaw-dev" : ".openclaw");

const CLAUDE_SETTINGS_PATH = path.join(homedir(), ".claude", "settings.json");

function loadJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) {
    return structuredClone(fallback);
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return structuredClone(fallback);
  }
}

function saveJson(filePath, data) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function copyIfExists(src, dest, options = {}) {
  if (!existsSync(src)) {
    return false;
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { force: true, ...options });
  return true;
}

function copyDirIfExists(src, dest) {
  if (!existsSync(src)) {
    return false;
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { force: true, recursive: true });
  return true;
}

function readClaudeModelEnv() {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    return null;
  }
  try {
    const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
    const env = settings?.env ?? {};
    const baseUrl = typeof env.ANTHROPIC_BASE_URL === "string" ? env.ANTHROPIC_BASE_URL.trim() : "";
    const apiKey =
      (typeof env.ANTHROPIC_AUTH_TOKEN === "string" ? env.ANTHROPIC_AUTH_TOKEN.trim() : "") ||
      (typeof env.ANTHROPIC_API_KEY === "string" ? env.ANTHROPIC_API_KEY.trim() : "");
    if (!baseUrl && !apiKey) {
      return null;
    }
    return { baseUrl: baseUrl || undefined, apiKey: apiKey || undefined };
  } catch {
    return null;
  }
}

function applyClaudeModelService(config) {
  const claude = readClaudeModelEnv();
  if (!claude) {
    return config;
  }
  const next = { ...config };
  next.env = { ...(next.env ?? {}) };
  if (claude.baseUrl) {
    next.env.ANTHROPIC_BASE_URL = claude.baseUrl;
  }
  if (claude.apiKey) {
    next.env.ANTHROPIC_API_KEY = claude.apiKey;
  }
  const providers = { ...(next.models?.providers ?? {}) };
  if (claude.baseUrl) {
    providers.anthropic = { ...(providers.anthropic ?? {}), baseUrl: claude.baseUrl };
  }
  if (claude.apiKey && providers["openai-next"]) {
    providers["openai-next"] = {
      ...providers["openai-next"],
      ...(claude.baseUrl ? { baseUrl: claude.baseUrl } : {}),
      apiKey: claude.apiKey,
    };
  }
  next.models = { ...(next.models ?? {}), providers };
  return next;
}

function applyTrustclawPackagedAuth(config, env = process.env) {
  if (env.TRUSTCLAW_PACKAGED_DIST !== "1") {
    return config;
  }
  const next = { ...config };
  next.gateway = {
    ...next.gateway,
    auth: {
      mode: "token",
      token: resolveTrustclawPackagedGatewayToken(env),
    },
  };
  return next;
}

function applyTrustclawDefaults(config) {
  const next = { ...config };
  next.gateway = {
    mode: "local",
    bind: "loopback",
    ...next.gateway,
    port: Number(next.gateway?.port ?? TRUSTCLAW_DEFAULT_GATEWAY_PORT),
  };
  if (!next.gateway.auth?.token || next.gateway.auth?.mode !== "token") {
    next.gateway.auth = {
      mode: "token",
      token: next.gateway.auth?.token ?? TRUSTCLAW_DEFAULT_GATEWAY_TOKEN,
    };
  }
  const plugins = next.plugins ?? {};
  const entries = { ...(plugins.entries ?? {}) };
  const tra = entries["trustclaw-tra"] ?? {};
  entries["trustclaw-tra"] = {
    ...tra,
    enabled: true,
    config: {
      ...(tra.config ?? {}),
      defaultAgentPack: tra.config?.defaultAgentPack ?? "glp1-eligibility",
      // Resolved at first launch to Contents/Resources/trustclaw/agents
      agentPacksDir: "__TRUSTCLAW_BUNDLED_AGENTS_DIR__",
    },
  };
  entries.acpx = { ...(entries.acpx ?? {}), enabled: false };
  next.plugins = { ...plugins, entries };
  return next;
}

function syncWorkspaceTemplate(templateDir, targetDir) {
  if (!existsSync(templateDir)) {
    return;
  }
  mkdirSync(targetDir, { recursive: true });
  for (const name of ["SOUL.md", "IDENTITY.md", "AGENTS.md", "README.md"]) {
    const src = path.join(templateDir, name);
    if (existsSync(src)) {
      cpSync(src, path.join(targetDir, name), { force: true });
    }
  }
  const avatarSrcDir = path.join(templateDir, "avatars");
  if (existsSync(avatarSrcDir)) {
    cpSync(avatarSrcDir, path.join(targetDir, "avatars"), { force: true, recursive: true });
  }
}

function copyAgentTree(sourceStateDir, outStateDir) {
  const agentsSrc = path.join(sourceStateDir, "agents");
  if (!existsSync(agentsSrc)) {
    mkdirSync(path.join(outStateDir, "agents", "main", "agent"), { recursive: true });
    return;
  }
  copyDirIfExists(agentsSrc, path.join(outStateDir, "agents"));
}

function copyOptionalStatePaths(sourceStateDir, outStateDir) {
  const names = [
    "credentials",
    "workspace",
    "workspace-dev",
    "workspace-nrdl-reimburse",
    "workspace-compliance-auditor",
    "state",
  ];
  for (const name of names) {
    copyDirIfExists(path.join(sourceStateDir, name), path.join(outStateDir, name));
  }
  copyIfExists(path.join(sourceStateDir, ".env"), path.join(outStateDir, ".env"));
}

function ensureWorkspaceTemplates(outStateDir) {
  const mappings = [
    { template: "main", target: "workspace" },
    { template: "dev", target: "workspace-dev" },
    { template: "nrdl-reimburse", target: "workspace-nrdl-reimburse" },
    { template: "compliance-auditor", target: "workspace-compliance-auditor" },
  ];
  for (const entry of mappings) {
    syncWorkspaceTemplate(
      path.join(workspaceRoot, entry.template),
      path.join(outStateDir, entry.target),
    );
  }
}

function redactForLog(config) {
  const clone = structuredClone(config);
  if (clone.env?.ANTHROPIC_API_KEY) {
    clone.env.ANTHROPIC_API_KEY = "***";
  }
  if (clone.env?.OPENAI_API_KEY) {
    clone.env.OPENAI_API_KEY = "***";
  }
  if (clone.gateway?.auth?.token) {
    clone.gateway.auth.token = "***";
  }
  for (const provider of Object.values(clone.models?.providers ?? {})) {
    if (provider && typeof provider === "object" && "apiKey" in provider && provider.apiKey) {
      provider.apiKey = "***";
    }
  }
  return clone;
}

function writeTrustclawConnectArtifacts(outDir, config) {
  const port = Number(config.gateway?.port ?? TRUSTCLAW_DEFAULT_GATEWAY_PORT);
  const token = config.gateway?.auth?.token ?? TRUSTCLAW_DEFAULT_GATEWAY_TOKEN;
  const dashboardUrl = buildTrustclawDashboardUrl(port, token);
  writeFileSync(
    path.join(outDir, "trustclaw-connect.url"),
    `[InternetShortcut]\nURL=${dashboardUrl}\n`,
  );
  writeFileSync(
    path.join(outDir, "TRUSTCLAW-AUTH.txt"),
    `TrustClaw Gateway Auth (packaged default)

Gateway: http://127.0.0.1:${port}/
Token: ${token}

One-click (token in URL fragment):
${dashboardUrl}

Double-click trustclaw-connect.url or paste the one-click URL into your browser.
`,
  );
}

function main() {
  mkdirSync(outDir, { recursive: true });

  const sourceConfigPath = path.join(sourceStateDir, "openclaw.json");
  let config = loadJson(sourceConfigPath, {});
  config = applyClaudeModelService(config);
  config = applyTrustclawDefaults(config);
  config = applyTrustclawPackagedAuth(config);

  saveJson(path.join(outDir, "openclaw.json"), config);
  writeTrustclawConnectArtifacts(outDir, config);
  copyAgentTree(sourceStateDir, outDir);
  copyOptionalStatePaths(sourceStateDir, outDir);
  ensureWorkspaceTemplates(outDir);

  const pkgVersion = loadJson(path.join(repoRoot, "package.json"), {}).version ?? "0.0.0";
  saveJson(path.join(outDir, "manifest.json"), {
    bundleVersion: pkgVersion,
    builtAt: new Date().toISOString(),
    sourceStateDir,
    hasAuthProfiles: existsSync(path.join(outDir, "agents", "main", "agent", "auth-profiles.json")),
    hasCredentials: existsSync(path.join(outDir, "credentials")),
    hasEnvFile: existsSync(path.join(outDir, ".env")),
  });

  console.log(`[${logTag}] Staged → ${outDir}`);
  console.log(`[${logTag}] Source: ${sourceStateDir}`);
  console.log(`[${logTag}] Config summary: ${JSON.stringify(redactForLog(config))}`);

  if (!existsSync(path.join(outDir, "agents", "main", "agent", "auth-profiles.json"))) {
    console.warn(
      `[${logTag}] WARN: auth-profiles.json missing — run \`pnpm openclaw models auth paste-api-key\` first`,
    );
  }
}

main();
