#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * First-boot OpenClaw config for TrustClaw ARM64 Docker.
 * Merges app.env into ~/.openclaw/openclaw.json and syncs workspace templates.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  resolveTrustclawTraPluginConfig,
  seedBundledAgentPacksIfMissing,
} from "/app/scripts/lib/trustclaw-agent-packs.mjs";
import { migrateTrustclawPluginEntry } from "/app/scripts/lib/trustclaw-defaults.mjs";
import { syncWorkspaceTemplate } from "/app/scripts/lib/trustclaw-workspace-sync.mjs";

const stateDir = process.env.OPENCLAW_STATE_DIR ?? "/home/node/.openclaw";
const configPath = process.env.OPENCLAW_CONFIG_PATH ?? path.join(stateDir, "openclaw.json");
const seedPath = process.env.TRUSTCLAW_CONFIG_SEED ?? "/opt/trustclaw/config/openclaw.json.seed";
const appRoot = process.env.TRUSTCLAW_APP_ROOT ?? "/app";
const bundledAgentsDir = path.join(appRoot, "trustclaw", "agents");

function envTrim(key) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function loadJson(filePath, fallback) {
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

function syncTrustclawWorkspaces() {
  const workspaceRoot = path.join(appRoot, "trustclaw", "workspace");
  const mappings = [
    { template: "dev", target: path.join(stateDir, "workspace") },
    { template: "nrdl-reimburse", target: path.join(stateDir, "workspace-nrdl-reimburse") },
    { template: "compliance-auditor", target: path.join(stateDir, "workspace-compliance-auditor") },
  ];
  for (const entry of mappings) {
    syncWorkspaceTemplate(path.join(workspaceRoot, entry.template), entry.target);
  }
}

function buildControlUiOrigins() {
  const explicit = envTrim("TRUSTCLAW_CONTROL_UI_ORIGINS");
  if (explicit) {
    return explicit
      .split(/[,\s]+/)
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  const hostPorts = [envTrim("APP_PORT") ?? "8080", envTrim("TRUSTCLAW_UI_PORT") ?? "15174"];
  const origins = new Set();
  for (const port of hostPorts) {
    origins.add(`http://127.0.0.1:${port}`);
    origins.add(`http://localhost:${port}`);
  }
  return [...origins];
}

function resolveTrustclawTraEntry(existingEntries) {
  const migrated = migrateTrustclawPluginEntry({ ...existingEntries });
  const traEntry = resolveTrustclawTraPluginConfig(migrated["trustclaw-tra"], stateDir);
  const envPacksDir = envTrim("TRUSTCLAW_AGENT_PACKS_DIR");
  if (envPacksDir) {
    traEntry.config = { ...(traEntry.config ?? {}), agentPacksDir: envPacksDir };
  }
  const envDefaultPack = envTrim("TRUSTCLAW_DEFAULT_AGENT_PACK");
  if (envDefaultPack) {
    traEntry.config = { ...(traEntry.config ?? {}), defaultAgentPack: envDefaultPack };
  }
  return traEntry;
}

function applyEnvToConfig(config) {
  const gatewayToken = envTrim("OPENCLAW_GATEWAY_TOKEN");
  const anthropicBaseUrl = envTrim("ANTHROPIC_BASE_URL");
  const anthropicApiKey = resolveAnthropicApiKey();
  const openaiApiKey = envTrim("OPENAI_API_KEY");
  const primaryModel = envTrim("OPENCLAW_PRIMARY_MODEL") ?? "anthropic/claude-sonnet-4-6";
  const gatewayPort = Number(envTrim("OPENCLAW_GATEWAY_PORT") ?? "19001");

  config.gateway = {
    mode: "local",
    bind: "lan",
    ...config.gateway,
    port: Number.isFinite(gatewayPort) ? gatewayPort : 19001,
    auth: {
      mode: "token",
      token: gatewayToken ?? config.gateway?.auth?.token ?? "trustclaw-docker-demo",
    },
    controlUi: {
      ...(config.gateway?.controlUi ?? {}),
      allowInsecureAuth: true,
      allowedOrigins: buildControlUiOrigins(),
    },
  };

  const rawEntries = { ...(config.plugins?.entries ?? {}) };
  const traEntry = resolveTrustclawTraEntry(rawEntries);

  config.plugins = {
    ...config.plugins,
    entries: {
      ...migrateTrustclawPluginEntry(rawEntries),
      "trustclaw-tra": traEntry,
      acpx: {
        ...(config.plugins?.entries?.acpx ?? {}),
        enabled: false,
      },
      workboard: {
        ...(config.plugins?.entries?.workboard ?? {}),
        enabled: true,
      },
    },
  };
  delete config.plugins.entries["trustclaw-ptds"];

  config.env = { ...(config.env ?? {}) };
  if (anthropicBaseUrl) {
    config.env.ANTHROPIC_BASE_URL = anthropicBaseUrl;
    config.models = {
      ...(config.models ?? {}),
      providers: {
        ...(config.models?.providers ?? {}),
        anthropic: {
          ...(config.models?.providers?.anthropic ?? {}),
          baseUrl: anthropicBaseUrl,
        },
      },
    };
  }
  if (anthropicApiKey) {
    config.env.ANTHROPIC_API_KEY = anthropicApiKey;
  }
  if (openaiApiKey) {
    config.env.OPENAI_API_KEY = openaiApiKey;
  }

  config.agents = {
    ...(config.agents ?? {}),
    defaults: {
      ...(config.agents?.defaults ?? {}),
      workspace: path.join(stateDir, "workspace"),
      model: {
        primary: primaryModel,
        fallbacks: [],
      },
      models: {
        ...(config.agents?.defaults?.models ?? {}),
        [primaryModel]: { alias: "sonnet" },
      },
    },
    list:
      Array.isArray(config.agents?.list) && config.agents.list.length > 0
        ? config.agents.list
        : [
            {
              id: "main",
              default: true,
              workspace: path.join(stateDir, "workspace"),
              agentDir: path.join(stateDir, "agents", "main", "agent"),
            },
          ],
  };

  return config;
}

function resolveAnthropicApiKey() {
  return envTrim("ANTHROPIC_API_KEY") ?? envTrim("ANTHROPIC_AUTH_TOKEN");
}

function warnMissingModelAuth(config) {
  const primary =
    envTrim("OPENCLAW_PRIMARY_MODEL") ??
    config.agents?.defaults?.model?.primary ??
    "anthropic/claude-sonnet-4-6";
  if (!primary.startsWith("anthropic/")) {
    return;
  }
  const anthropicKey = resolveAnthropicApiKey();
  const configKey =
    typeof config.env?.ANTHROPIC_API_KEY === "string" ? config.env.ANTHROPIC_API_KEY.trim() : "";
  if (anthropicKey || configKey) {
    return;
  }
  console.warn(
    [
      "[trustclaw:docker] WARN: Anthropic model auth is missing.",
      "Set ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) in docker/trustclaw-arm64/app.env,",
      "then restart: docker compose up -d --force-recreate",
      "Local ~/.openclaw auth is NOT copied into the container automatically.",
    ].join(" "),
  );
}

function seedOperatorAgentPacks(traEntry) {
  const targetDir = traEntry.config?.agentPacksDir;
  if (!targetDir) {
    return;
  }
  const { seeded, skipped } = seedBundledAgentPacksIfMissing(bundledAgentsDir, targetDir);
  if (seeded.length > 0) {
    console.log(`[trustclaw:docker] Seeded agent packs → ${targetDir}: ${seeded.join(", ")}`);
  }
  if (skipped.length > 0) {
    console.log(`[trustclaw:docker] Kept existing agent packs: ${skipped.join(", ")}`);
  }
}

function main() {
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(path.join(stateDir, "agents", "main", "agent"), { recursive: true });

  const seed = loadJson(seedPath, {});
  const existing = existsSync(configPath) ? loadJson(configPath, seed) : seed;
  const merged = applyEnvToConfig(existing);
  saveJson(configPath, merged);
  syncTrustclawWorkspaces();
  seedOperatorAgentPacks(merged.plugins.entries["trustclaw-tra"]);
  warnMissingModelAuth(merged);

  const bootstrapScript = path.join(appRoot, "scripts/lib/tra-state-bootstrap.mjs");
  if (existsSync(bootstrapScript)) {
    const result = spawnSync(process.execPath, [bootstrapScript], {
      env: { ...process.env, OPENCLAW_STATE_DIR: stateDir, TRUSTCLAW_APP_ROOT: appRoot },
      stdio: "inherit",
    });
    if ((result.status ?? 1) !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  console.log(`[trustclaw:docker] Config ready at ${configPath}`);
}

main();
