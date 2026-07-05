#!/usr/bin/env node
/**
 * First-boot OpenClaw config for TrustClaw ARM64 Docker.
 * Merges app.env into ~/.openclaw/openclaw.json and syncs workspace templates.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const stateDir = process.env.OPENCLAW_STATE_DIR ?? "/home/node/.openclaw";
const configPath = process.env.OPENCLAW_CONFIG_PATH ?? path.join(stateDir, "openclaw.json");
const seedPath =
  process.env.TRUSTCLAW_CONFIG_SEED ?? "/opt/trustclaw/config/openclaw.json.seed";
const appRoot = process.env.TRUSTCLAW_APP_ROOT ?? "/app";

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

function applyEnvToConfig(config) {
  const gatewayToken = envTrim("OPENCLAW_GATEWAY_TOKEN");
  const anthropicBaseUrl = envTrim("ANTHROPIC_BASE_URL");
  const anthropicApiKey = envTrim("ANTHROPIC_API_KEY") ?? envTrim("ANTHROPIC_AUTH_TOKEN");
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
  };

  config.plugins = {
    ...config.plugins,
    entries: {
      ...(config.plugins?.entries ?? {}),
      "trustclaw-ptds": {
        ...(config.plugins?.entries?.["trustclaw-ptds"] ?? {}),
        enabled: true,
        config: {
          ...(config.plugins?.entries?.["trustclaw-ptds"]?.config ?? {}),
          agentPacksDir: envTrim("TRUSTCLAW_AGENT_PACKS_DIR") ?? "/app/trustclaw/agents",
          defaultAgentPack: envTrim("TRUSTCLAW_DEFAULT_AGENT_PACK") ?? "glp1-eligibility",
        },
      },
      acpx: {
        ...(config.plugins?.entries?.acpx ?? {}),
        enabled: false,
      },
    },
  };

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
    list: Array.isArray(config.agents?.list) && config.agents.list.length > 0
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

function main() {
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(path.join(stateDir, "agents", "main", "agent"), { recursive: true });

  const seed = loadJson(seedPath, {});
  const existing = existsSync(configPath) ? loadJson(configPath, seed) : seed;
  const merged = applyEnvToConfig(existing);
  saveJson(configPath, merged);
  syncTrustclawWorkspaces();

  console.log(`[trustclaw:docker] Config ready at ${configPath}`);
}

main();
