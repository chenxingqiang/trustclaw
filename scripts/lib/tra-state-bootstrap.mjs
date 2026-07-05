#!/usr/bin/env node
/**
 * Bootstrap TRA state for Docker/local: legacy PTDS file renames + optional domain_agents seed.
 * Used by docker init-config.mjs and pull-container-state.sh.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const stateDir = process.env.OPENCLAW_STATE_DIR ?? path.join(process.env.HOME ?? "/tmp", ".openclaw");
const appRoot = process.env.TRUSTCLAW_APP_ROOT ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const trustclawPackageRoot = existsSync(path.join(appRoot, "trustclaw", "tra"))
  ? path.join(appRoot, "trustclaw")
  : appRoot;
const registrySql = path.join(trustclawPackageRoot, "tra/seeds/domain-agents/domain_agents_registry.sql");

function normalizeLegacyTraNaming(content) {
  return content
    .replace(/\bptds_scopes\b/g, "tra_scopes")
    .replace(/\bptds_write\b/g, "tra_write")
    .replace(/\bptds\.read\b/g, "tra.read")
    .replace(/\bptds\.chat\b/g, "tra.chat")
    .replace(/\bptds\.write\b/g, "tra.write")
    .replace(/'ptds-([a-z0-9-]+)'/g, "'tra-$1'")
    .replace(/\bptds-([a-z0-9-]+)\b/g, "tra-$1");
}

function renameIfPresent(dir, fromName, toName) {
  const fromPath = path.join(dir, fromName);
  const toPath = path.join(dir, toName);
  if (!existsSync(fromPath) || existsSync(toPath)) {
    return false;
  }
  renameSync(fromPath, toPath);
  return true;
}

function migratePluginEntry(config) {
  const entries = config.plugins?.entries ?? {};
  const legacy = entries["trustclaw-ptds"];
  if (!legacy) {
    return false;
  }
  const tra = entries["trustclaw-tra"] ?? {};
  delete entries["trustclaw-ptds"];
  entries["trustclaw-tra"] = {
    ...legacy,
    ...tra,
    enabled: tra.enabled ?? legacy.enabled ?? true,
    config: { ...(legacy.config ?? {}), ...(tra.config ?? {}) },
  };
  config.plugins = { ...config.plugins, entries };
  const allow = new Set(config.plugins.allow ?? []);
  if (allow.delete("trustclaw-ptds")) {
    allow.add("trustclaw-tra");
    config.plugins.allow = [...allow];
  }
  return true;
}

function countDomainAgents(db) {
  const table = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='domain_agents'")
    .get();
  if (!table) {
    return 0;
  }
  return db.prepare("SELECT COUNT(*) AS count FROM domain_agents").get().count ?? 0;
}

function main() {
  const statePath = path.join(stateDir, "state");
  mkdirSync(statePath, { recursive: true });

  const dbRenamed = renameIfPresent(statePath, "local_ptds.db", "local_tra.db");
  for (const [fromName, toName] of [
    ["ptds-audit", "tra-audit"],
    ["ptds-evidence", "tra-evidence"],
  ]) {
    renameIfPresent(statePath, fromName, toName);
  }

  const configPath = process.env.OPENCLAW_CONFIG_PATH ?? path.join(stateDir, "openclaw.json");
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    if (migratePluginEntry(config)) {
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
      console.log("[trustclaw:bootstrap] Migrated plugins.entries.trustclaw-ptds → trustclaw-tra");
    }
  }

  const dbPath = path.join(statePath, "local_tra.db");
  if (!existsSync(registrySql)) {
    console.warn(`[trustclaw:bootstrap] Registry SQL missing: ${registrySql}`);
    return;
  }

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  const existing = countDomainAgents(db);
  if (existing >= 1000) {
    console.log(`[trustclaw:bootstrap] domain_agents already has ${existing} rows`);
    db.close();
    return;
  }
  if (existing > 0) {
    db.exec("DROP TABLE IF EXISTS domain_agents");
    db.exec("DROP TABLE IF EXISTS domain_agent_packs");
  }
  db.exec(normalizeLegacyTraNaming(readFileSync(registrySql, "utf8")));
  const total = countDomainAgents(db);
  db.close();
  console.log(
    `[trustclaw:bootstrap] domain_agents registry ${existing > 0 ? `${existing} → ` : ""}${total} rows${dbRenamed ? " (migrated local_ptds.db)" : ""}`,
  );
}

main();
