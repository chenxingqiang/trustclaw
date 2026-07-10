#!/usr/bin/env node
/**
 * Normalize legacy PTDS domain agent packs (ptds-*) into TRA domain packs (tra-*).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const LEGACY_DOMAIN_PACK_FOLDER_MAP = {
  "ptds-outpatient": "tra-outpatient",
  "ptds-inpatient": "tra-inpatient",
  "ptds-pharmacy": "tra-pharmacy",
  "ptds-cross-region": "tra-cross-region",
  "ptds-audit": "tra-audit",
  "ptds-drg": "tra-drg",
  "ptds-maternity": "tra-maternity",
  "ptds-catastrophic": "tra-catastrophic",
  "ptds-medical-assistance": "tra-medical-assistance",
  "ptds-tcm": "tra-tcm",
};

export const DOMAIN_AGENT_PACK_IDS = Object.values(LEGACY_DOMAIN_PACK_FOLDER_MAP);

export function normalizeLegacyPackText(content) {
  return content
    .replace(/\bptds_scopes\b/g, "tra_scopes")
    .replace(/\bptds_write\b/g, "tra_write")
    .replace(/\bptds\.read\b/g, "tra.read")
    .replace(/\bptds\.chat\b/g, "tra.chat")
    .replace(/\bptds\.write\b/g, "tra.write")
    .replace(/\btrustclaw_ptds_query\b/g, "trustclaw_tra_query")
    .replace(/\btrustclaw_ptds_write\b/g, "trustclaw_tra_write")
    .replace(/\bPTDS Console\b/g, "TRA Console")
    .replace(/\bPTDS Agent\b/g, "TRA Agent")
    .replace(/\bPTDS SQLite\b/g, "TRA SQLite")
    .replace(/\b个人可信数据空间 \(PTDS\)/g, "Trust Runtime for Agent (TRA)")
    .replace(/\bPTDS\b/g, "TRA")
    .replace(/\bptds-([a-z0-9-]+)\b/g, "tra-$1");
}

export function normalizeLegacyPackManifest(raw, targetPackId) {
  const text = normalizeLegacyPackText(
    typeof raw === "string" ? raw : JSON.stringify(raw, null, 2),
  );
  const pack = JSON.parse(text);
  pack.id = targetPackId;
  if (pack.openclaw && typeof pack.openclaw === "object") {
    pack.openclaw.agentId = targetPackId;
  }
  return pack;
}

export function resolveTargetPackId(sourceFolderName) {
  if (LEGACY_DOMAIN_PACK_FOLDER_MAP[sourceFolderName]) {
    return LEGACY_DOMAIN_PACK_FOLDER_MAP[sourceFolderName];
  }
  if (sourceFolderName.startsWith("tra-")) {
    return sourceFolderName;
  }
  return null;
}

export function normalizePackDirectory(packDir, targetPackId) {
  const packFile = path.join(packDir, "agent.pack.json");
  const pack = normalizeLegacyPackManifest(readFileSync(packFile, "utf8"), targetPackId);
  writeFileSync(packFile, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  const promptsDir = path.join(packDir, "prompts");
  for (const name of ["system.v1.md", "text2sql.v1.md", "personal-write-sql.v1.md"]) {
    const filePath = path.join(promptsDir, name);
    if (existsSync(filePath)) {
      writeFileSync(filePath, normalizeLegacyPackText(readFileSync(filePath, "utf8")), "utf8");
    }
  }
  return pack;
}

/** Migrate legacy workspace/trustclaw-agents/ptds-* trees into tra-* when needed. */
export function migrateLegacyWorkspaceDomainPacks(workspaceAgentsDir) {
  const migrated = [];
  const skipped = [];
  mkdirSync(workspaceAgentsDir, { recursive: true });
  for (const [legacyFolder, targetPackId] of Object.entries(LEGACY_DOMAIN_PACK_FOLDER_MAP)) {
    const legacyDir = path.join(workspaceAgentsDir, legacyFolder);
    const targetDir = path.join(workspaceAgentsDir, targetPackId);
    if (existsSync(targetDir)) {
      skipped.push(targetPackId);
      continue;
    }
    if (!existsSync(path.join(legacyDir, "agent.pack.json"))) {
      continue;
    }
    cpSync(legacyDir, targetDir, { recursive: true });
    normalizePackDirectory(targetDir, targetPackId);
    migrated.push(`${legacyFolder}→${targetPackId}`);
  }
  return { migrated, skipped };
}

export function resolveLegacyAgentId(agentId) {
  const trimmed = agentId?.trim();
  if (!trimmed) {
    return null;
  }
  if (LEGACY_DOMAIN_PACK_FOLDER_MAP[trimmed]) {
    return LEGACY_DOMAIN_PACK_FOLDER_MAP[trimmed];
  }
  if (trimmed.startsWith("ptds-")) {
    return trimmed.replace(/^ptds-/, "tra-");
  }
  return null;
}

/** Rename ptds-* OpenClaw agent ids in agents.list to tra-* and dedupe. */
export function migrateLegacyAgentsList(agentsList, stateDir = "") {
  if (!Array.isArray(agentsList)) {
    return { agentsList: [], migrated: [], changed: false };
  }
  const migrated = [];
  const seen = new Set();
  const next = [];
  for (const entry of agentsList) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const updated = { ...entry };
    const currentId = typeof updated.id === "string" ? updated.id.trim() : "";
    const targetId = resolveLegacyAgentId(currentId);
    if (targetId) {
      migrated.push(`${currentId}→${targetId}`);
      updated.id = targetId;
    }
    for (const key of ["workspace", "agentDir"]) {
      if (typeof updated[key] === "string") {
        updated[key] = normalizeLegacyPackText(updated[key]);
      }
    }
    const finalId = typeof updated.id === "string" ? updated.id.trim() : "";
    if (!finalId || seen.has(finalId)) {
      continue;
    }
    if (
      stateDir &&
      DOMAIN_AGENT_PACK_IDS.includes(finalId) &&
      typeof updated.workspace !== "string"
    ) {
      updated.workspace = path.join(stateDir, "workspace", "trustclaw-agents", finalId);
    }
    seen.add(finalId);
    next.push(updated);
  }
  return { agentsList: next, migrated, changed: migrated.length > 0 };
}
