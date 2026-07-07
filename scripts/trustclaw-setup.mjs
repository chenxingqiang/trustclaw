#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
// Ensures TrustClaw TRA plugin is enabled for local fork demos.
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveOperatorAgentPacksDir,
  seedBundledAgentPacksIfMissing,
} from "./lib/trustclaw-agent-packs.mjs";
import {
  TRUSTCLAW_DEFAULT_GATEWAY_PORT,
  migrateTrustclawPluginEntry,
  resolveTrustclawProfileStateDir,
} from "./lib/trustclaw-defaults.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const workspaceRoot = path.join(repoRoot, "trustclaw", "workspace");
const bundledAgentsDir = path.join(repoRoot, "trustclaw", "agents");
const ACPX_DIST_MANIFEST = path.join(
  repoRoot,
  "dist",
  "extensions",
  "acpx",
  "openclaw.plugin.json",
);

/** Repo-relative workspace templates synced into OpenClaw agent workspaces. */
const TRUSTCLAW_AGENT_WORKSPACES = [
  {
    agentId: "main",
    templateDir: path.join(workspaceRoot, "dev"),
    syncTargetName: "workspace-dev",
  },
  {
    agentId: "nrdl-reimburse",
    templateDir: path.join(workspaceRoot, "nrdl-reimburse"),
    syncTargetName: "workspace-nrdl-reimburse",
  },
  {
    agentId: "compliance-auditor",
    templateDir: path.join(workspaceRoot, "compliance-auditor"),
    syncTargetName: "workspace-compliance-auditor",
  },
];

const devArgs = process.argv.includes("--dev") ? ["--dev"] : [];

function resolveProfileStateDir(profileArgs) {
  return resolveTrustclawProfileStateDir(homedir(), profileArgs);
}

function resolveProfileConfigPath(profileArgs) {
  return path.join(resolveProfileStateDir(profileArgs), "openclaw.json");
}

function loadProfileConfig(profileArgs) {
  const configPath = resolveProfileConfigPath(profileArgs);
  if (!existsSync(configPath)) {
    return { configPath, config: {} };
  }
  try {
    return {
      configPath,
      config: JSON.parse(readFileSync(configPath, "utf8")),
    };
  } catch {
    return { configPath, config: {} };
  }
}

function saveProfileConfig(configPath, config) {
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

const CLAUDE_SETTINGS_PATH = path.join(homedir(), ".claude", "settings.json");

/** Read Anthropic proxy + API key from Claude Code settings (never log secrets). */
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

/** Mirror Claude Code model proxy into OpenClaw config.env + models.providers. */
function syncClaudeModelService(profileArgs) {
  const claude = readClaudeModelEnv();
  if (!claude) {
    return 0;
  }

  const { configPath, config } = loadProfileConfig(profileArgs);
  let changed = false;
  const profileLabel = profileArgs.includes("--dev") ? "dev" : "default";

  config.env = { ...(config.env ?? {}) };
  if (claude.baseUrl && config.env.ANTHROPIC_BASE_URL !== claude.baseUrl) {
    config.env.ANTHROPIC_BASE_URL = claude.baseUrl;
    changed = true;
  }
  if (claude.apiKey && config.env.ANTHROPIC_API_KEY !== claude.apiKey) {
    config.env.ANTHROPIC_API_KEY = claude.apiKey;
    changed = true;
  }

  const providers = { ...(config.models?.providers ?? {}) };
  if (claude.baseUrl) {
    const anthropic = { ...(providers.anthropic ?? {}) };
    if (anthropic.baseUrl !== claude.baseUrl) {
      providers.anthropic = { ...anthropic, baseUrl: claude.baseUrl };
      changed = true;
    }
  }
  if (claude.apiKey && providers["openai-next"]) {
    const openaiNext = { ...providers["openai-next"] };
    let providerChanged = false;
    if (claude.baseUrl && openaiNext.baseUrl !== claude.baseUrl) {
      openaiNext.baseUrl = claude.baseUrl;
      providerChanged = true;
    }
    if (openaiNext.apiKey !== claude.apiKey) {
      openaiNext.apiKey = claude.apiKey;
      providerChanged = true;
    }
    if (providerChanged) {
      providers["openai-next"] = openaiNext;
      changed = true;
    }
  }
  if (changed) {
    config.models = { ...(config.models ?? {}), providers };
    saveProfileConfig(configPath, config);
    console.log(
      `[trustclaw:setup] Synced Claude model service → ${profileLabel} profile (${configPath})`,
    );
  }
  return 0;
}

/** Writes TrustClaw defaults directly to openclaw.json (avoids repeated dev rebuilds). */
function applyTrustclawConfig(profileArgs) {
  const { configPath, config } = loadProfileConfig(profileArgs);
  const stateDir = resolveProfileStateDir(profileArgs);
  const plugins = config.plugins ?? {};
  const entries = migrateTrustclawPluginEntry({ ...(plugins.entries ?? {}) });
  const existing = entries["trustclaw-tra"] ?? {};
  const hadLegacyPtds = Boolean(plugins.entries?.["trustclaw-ptds"]);
  const agentPacksDir =
    typeof existing.config?.agentPacksDir === "string" && existing.config.agentPacksDir.trim()
      ? existing.config.agentPacksDir.trim()
      : resolveOperatorAgentPacksDir(stateDir);

  config.plugins = {
    ...plugins,
    entries: {
      ...entries,
      "trustclaw-tra": {
        ...existing,
        enabled: true,
        config: {
          ...(existing.config ?? {}),
          agentPacksDir,
          defaultAgentPack: existing.config?.defaultAgentPack ?? "glp1-eligibility",
        },
      },
    },
  };
  config.gateway = {
    ...config.gateway,
    port: Number(TRUSTCLAW_DEFAULT_GATEWAY_PORT),
  };

  saveProfileConfig(configPath, config);
  if (hadLegacyPtds) {
    const profileLabel = profileArgs.includes("--dev") ? "dev" : "default";
    console.log(
      `[trustclaw:setup] Migrated plugins.entries.trustclaw-ptds → trustclaw-tra (${profileLabel} profile)`,
    );
  }
  return 0;
}

function seedOperatorAgentPacks(profileArgs) {
  const stateDir = resolveProfileStateDir(profileArgs);
  const { config } = loadProfileConfig(profileArgs);
  const configuredDir =
    typeof config.plugins?.entries?.["trustclaw-tra"]?.config?.agentPacksDir === "string"
      ? config.plugins.entries["trustclaw-tra"].config.agentPacksDir.trim()
      : resolveOperatorAgentPacksDir(stateDir);
  const { seeded, skipped } = seedBundledAgentPacksIfMissing(bundledAgentsDir, configuredDir);
  if (seeded.length > 0) {
    console.log(`[trustclaw:setup] Seeded agent packs → ${configuredDir}: ${seeded.join(", ")}`);
  }
  if (skipped.length > 0) {
    console.log(`[trustclaw:setup] Kept existing agent packs: ${skipped.join(", ")}`);
  }
  return 0;
}

/** TrustClaw dev builds exclude some upstream dist plugins (e.g. acpx); disable missing manifests. */
function pruneBrokenDistPlugins(profileArgs) {
  if (existsSync(ACPX_DIST_MANIFEST)) {
    return 0;
  }
  const { configPath, config } = loadProfileConfig(profileArgs);
  const plugins = config.plugins ?? {};
  const entries = { ...(plugins.entries ?? {}) };
  if (entries.acpx?.enabled === false) {
    return 0;
  }
  entries.acpx = { ...(entries.acpx ?? {}), enabled: false };
  config.plugins = { ...plugins, entries };
  saveProfileConfig(configPath, config);
  console.log(
    "[trustclaw:setup] Disabled plugins.entries.acpx (dist manifest missing; run full build to enable)",
  );
  return 0;
}

function ensureTrustclawAgents(profileArgs) {
  const { configPath, config } = loadProfileConfig(profileArgs);
  const stateDir = resolveProfileStateDir(profileArgs);
  const list = Array.isArray(config.agents?.list) ? [...config.agents.list] : [];
  let changed = false;

  for (const entry of TRUSTCLAW_AGENT_WORKSPACES) {
    if (entry.agentId === "main") {
      continue;
    }
    if (list.some((agent) => agent?.id === entry.agentId)) {
      continue;
    }
    list.push({
      id: entry.agentId,
      name: entry.agentId,
      workspace: entry.templateDir,
      agentDir: path.join(stateDir, "agents", entry.agentId, "agent"),
    });
    changed = true;
  }

  if (changed) {
    config.agents = {
      ...(config.agents ?? {}),
      list,
    };
    saveProfileConfig(configPath, config);
  }

  return 0;
}

function syncWorkspaceTemplate(templateDir, targetDir) {
  if (!existsSync(templateDir)) {
    return;
  }
  mkdirSync(targetDir, { recursive: true });
  for (const name of ["SOUL.md", "IDENTITY.md", "AGENTS.md"]) {
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

function syncWorkspacesForProfile(profileArgs) {
  const stateDir = resolveProfileStateDir(profileArgs);
  const profileLabel = profileArgs.includes("--dev") ? "dev" : "default";
  for (const entry of TRUSTCLAW_AGENT_WORKSPACES) {
    const targetDir = path.join(stateDir, entry.syncTargetName);
    syncWorkspaceTemplate(entry.templateDir, targetDir);
    console.log(
      `[trustclaw:setup] Synced ${entry.agentId} workspace → ${targetDir} (${profileLabel} profile)`,
    );
  }
  return 0;
}

// Enable for default + dev profiles
const profiles = devArgs.length > 0 ? [devArgs] : [[], ["--dev"]];
let exitCode = 0;
for (const profileArgs of profiles) {
  exitCode = syncClaudeModelService(profileArgs);
  if (exitCode !== 0) {
    break;
  }
  exitCode = applyTrustclawConfig(profileArgs);
  if (exitCode !== 0) {
    break;
  }
  exitCode = seedOperatorAgentPacks(profileArgs);
  if (exitCode !== 0) {
    break;
  }
  exitCode = pruneBrokenDistPlugins(profileArgs);
  if (exitCode !== 0) {
    break;
  }
  exitCode = ensureTrustclawAgents(profileArgs);
  if (exitCode !== 0) {
    break;
  }
  exitCode = syncWorkspacesForProfile(profileArgs);
  if (exitCode !== 0) {
    break;
  }
}

if (exitCode === 0) {
  console.log(
    `[trustclaw:setup] gateway.port → ${TRUSTCLAW_DEFAULT_GATEWAY_PORT} (default + dev profiles)`,
  );
  console.log(
    "[trustclaw:setup] agents: main (dev), nrdl-reimburse, compliance-auditor — use TRA Console agent selector or switch OpenClaw agent",
  );
}

process.exit(exitCode);
