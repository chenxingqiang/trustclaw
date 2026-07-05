import { existsSync, renameSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { resolveTraStateDir } from "./paths.js";

const LEGACY_DB_FILE = "local_ptds.db";
const CANONICAL_DB_FILE = "local_tra.db";

const LEGACY_STATE_DIR_RENAMES: Array<[string, string]> = [
  ["ptds-audit", "tra-audit"],
  ["ptds-evidence", "tra-evidence"],
];

/** Rewrite legacy PTDS identifiers in SQL/text payloads to TRA naming. */
export function normalizeLegacyTraNaming(content: string): string {
  return content
    .replace(/\bptds_scopes\b/g, "tra_scopes")
    .replace(/\bptds_write\b/g, "tra_write")
    .replace(/\bptds\.read\b/g, "tra.read")
    .replace(/\bptds\.chat\b/g, "tra.chat")
    .replace(/\bptds\.write\b/g, "tra.write")
    .replace(/\bpack_id\s*=\s*'ptds-/g, "pack_id = 'tra-")
    .replace(/'ptds-([a-z0-9-]+)'/g, "'tra-$1'")
    .replace(/\bptds-([a-z0-9-]+)\b/g, "tra-$1");
}

function renameIfPresent(stateDir: string, fromName: string, toName: string): boolean {
  const fromPath = path.join(stateDir, fromName);
  const toPath = path.join(stateDir, toName);
  if (!existsSync(fromPath) || existsSync(toPath)) {
    return false;
  }
  renameSync(fromPath, toPath);
  return true;
}

/** Rename legacy TRA state files/dirs under ~/.openclaw/state (idempotent). */
export function migrateLegacyTraStateFiles(
  stateDir = resolveTraStateDir(),
): { dbRenamed: boolean; dirsRenamed: string[] } {
  const dirsRenamed: string[] = [];
  const dbRenamed = renameIfPresent(stateDir, LEGACY_DB_FILE, CANONICAL_DB_FILE);
  for (const [fromName, toName] of LEGACY_STATE_DIR_RENAMES) {
    if (renameIfPresent(stateDir, fromName, toName)) {
      dirsRenamed.push(`${fromName}→${toName}`);
    }
  }
  return { dbRenamed, dirsRenamed };
}

function readColumnNames(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

/** Upgrade domain_agents rows/columns from PTDS-era schema to TRA naming. */
export function migrateLegacyDomainAgentsTable(db: DatabaseSync): boolean {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'domain_agents'")
    .all() as Array<{ name: string }>;
  if (tables.length === 0) {
    return false;
  }

  const columns = readColumnNames(db, "domain_agents");
  const hasLegacyScopes = columns.includes("ptds_scopes");
  const hasLegacyWrite = columns.includes("ptds_write");
  if (!hasLegacyScopes && !hasLegacyWrite) {
    if (columns.includes("tra_scopes")) {
      const hasPackId = columns.includes("pack_id");
      const setClauses = [
        "tra_scopes = REPLACE(REPLACE(tra_scopes, 'ptds.read', 'tra.read'), 'ptds.chat', 'tra.chat')",
      ];
      const whereClauses = ["tra_scopes LIKE '%ptds.%'"];
      if (hasPackId) {
        setClauses.push("pack_id = REPLACE(pack_id, 'ptds-', 'tra-')");
        whereClauses.push("pack_id LIKE 'ptds-%'");
      }
      db.prepare(
        `UPDATE domain_agents SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" OR ")}`,
      ).run();
    }
    return false;
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE domain_agents__tra_migrate (
        agent_id        TEXT PRIMARY KEY,
        agent_name      TEXT NOT NULL,
        domain          TEXT NOT NULL,
        subdomain       TEXT,
        region          TEXT,
        insurance_type  TEXT,
        enabled         TEXT,
        tra_scopes      TEXT,
        tra_write       INTEGER,
        pack_id         TEXT,
        pack_version    TEXT,
        registered_at   TEXT
      );
    `);
    const legacyScopes = hasLegacyScopes ? "ptds_scopes" : "tra_scopes";
    const legacyWrite = hasLegacyWrite ? "ptds_write" : "tra_write";
    db.prepare(
      `INSERT INTO domain_agents__tra_migrate (
         agent_id, agent_name, domain, subdomain, region, insurance_type, enabled,
         tra_scopes, tra_write, pack_id, pack_version, registered_at
       )
       SELECT
         agent_id, agent_name, domain, subdomain, region, insurance_type, enabled,
         REPLACE(REPLACE(${legacyScopes}, 'ptds.read', 'tra.read'), 'ptds.chat', 'tra.chat'),
         ${legacyWrite},
         REPLACE(pack_id, 'ptds-', 'tra-'),
         pack_version,
         registered_at
       FROM domain_agents`,
    ).run();
    db.exec("DROP TABLE domain_agents");
    db.exec("ALTER TABLE domain_agents__tra_migrate RENAME TO domain_agents");
    db.exec("COMMIT");
    return true;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // preserve original error
    }
    throw error;
  }
}
