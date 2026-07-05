import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  TRA_COMPLIANCE_STANDARDS_SQL,
  TRA_PRESCRIPTION_CONTEXT_SQL,
  TRA_REFERENCE_SYNC_SQL,
  TRA_SCHEMA_V11_SQL,
  TRA_SEED_NRDL_GLP1_SQL,
  resolveTraDbPath,
} from "./paths.js";

/** Canonical user_id for the local personal TRA owner (V1 single-user space). */
export const TRA_LOCAL_USER_ID = "local_user";

export function resolvePrimaryUserId(db: DatabaseSync): string | null {
  const row = db
    .prepare("SELECT user_id FROM user_profile ORDER BY created_at ASC LIMIT 1")
    .get() as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

export function openTraDatabase(dbPath = resolveTraDbPath()): DatabaseSync {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  return db;
}

export function isTraSchemaInitialized(db: DatabaseSync): boolean {
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'data_source_registry' LIMIT 1",
    )
    .get() as { ok: number } | undefined;
  return row?.ok === 1;
}

export function applyTraSchema(db: DatabaseSync): void {
  if (isTraSchemaInitialized(db)) {
    return;
  }
  const schemaSql = readFileSync(TRA_SCHEMA_V11_SQL, "utf8");
  db.exec(schemaSql);
}

export function applyComplianceStandardsSchema(db: DatabaseSync): void {
  const schemaSql = readFileSync(TRA_COMPLIANCE_STANDARDS_SQL, "utf8");
  db.exec(schemaSql);
}

export function applyReferenceSyncSchema(db: DatabaseSync): void {
  const schemaSql = readFileSync(TRA_REFERENCE_SYNC_SQL, "utf8");
  db.exec(schemaSql);
}

export function applyPrescriptionContextSchema(db: DatabaseSync): void {
  const schemaSql = readFileSync(TRA_PRESCRIPTION_CONTEXT_SQL, "utf8");
  db.exec(schemaSql);
}

export function seedNrdlGlp1RulesIfEmpty(db: DatabaseSync): void {
  const row = db.prepare("SELECT COUNT(*) AS count FROM nrdl_drug_registry").get() as {
    count: number;
  };
  if (row.count > 0) {
    return;
  }
  const seedSql = readFileSync(TRA_SEED_NRDL_GLP1_SQL, "utf8");
  db.exec(seedSql);
}

export function bootstrapTraDatabase(dbPath = resolveTraDbPath()): DatabaseSync {
  const db = openTraDatabase(dbPath);
  applyTraSchema(db);
  applyComplianceStandardsSchema(db);
  applyReferenceSyncSchema(db);
  applyPrescriptionContextSchema(db);
  seedNrdlGlp1RulesIfEmpty(db);
  return db;
}

/** node:sqlite DatabaseSync has no better-sqlite3-style `.transaction()`; use explicit BEGIN/COMMIT. */
export function runTraImmediateTransactionSync<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original import error when rollback fails.
    }
    throw error;
  }
}
