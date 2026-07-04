import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  PTDS_COMPLIANCE_STANDARDS_SQL,
  PTDS_PRESCRIPTION_CONTEXT_SQL,
  PTDS_REFERENCE_SYNC_SQL,
  PTDS_SCHEMA_V11_SQL,
  PTDS_SEED_NRDL_GLP1_SQL,
  resolvePtdsDbPath,
} from "./paths.js";

/** Canonical user_id for the local personal PTDS owner (V1 single-user space). */
export const PTDS_LOCAL_USER_ID = "local_user";

export function resolvePrimaryUserId(db: DatabaseSync): string | null {
  const row = db
    .prepare("SELECT user_id FROM user_profile ORDER BY created_at ASC LIMIT 1")
    .get() as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

export function openPtdsDatabase(dbPath = resolvePtdsDbPath()): DatabaseSync {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  return db;
}

export function isPtdsSchemaInitialized(db: DatabaseSync): boolean {
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'data_source_registry' LIMIT 1",
    )
    .get() as { ok: number } | undefined;
  return row?.ok === 1;
}

export function applyPtdsSchema(db: DatabaseSync): void {
  if (isPtdsSchemaInitialized(db)) {
    return;
  }
  const schemaSql = readFileSync(PTDS_SCHEMA_V11_SQL, "utf8");
  db.exec(schemaSql);
}

export function applyComplianceStandardsSchema(db: DatabaseSync): void {
  const schemaSql = readFileSync(PTDS_COMPLIANCE_STANDARDS_SQL, "utf8");
  db.exec(schemaSql);
}

export function applyReferenceSyncSchema(db: DatabaseSync): void {
  const schemaSql = readFileSync(PTDS_REFERENCE_SYNC_SQL, "utf8");
  db.exec(schemaSql);
}

export function applyPrescriptionContextSchema(db: DatabaseSync): void {
  const schemaSql = readFileSync(PTDS_PRESCRIPTION_CONTEXT_SQL, "utf8");
  db.exec(schemaSql);
}

export function seedNrdlGlp1RulesIfEmpty(db: DatabaseSync): void {
  const row = db.prepare("SELECT COUNT(*) AS count FROM nrdl_drug_registry").get() as {
    count: number;
  };
  if (row.count > 0) {
    return;
  }
  const seedSql = readFileSync(PTDS_SEED_NRDL_GLP1_SQL, "utf8");
  db.exec(seedSql);
}

export function bootstrapPtdsDatabase(dbPath = resolvePtdsDbPath()): DatabaseSync {
  const db = openPtdsDatabase(dbPath);
  applyPtdsSchema(db);
  applyComplianceStandardsSchema(db);
  applyReferenceSyncSchema(db);
  applyPrescriptionContextSchema(db);
  seedNrdlGlp1RulesIfEmpty(db);
  return db;
}

/** node:sqlite DatabaseSync has no better-sqlite3-style `.transaction()`; use explicit BEGIN/COMMIT. */
export function runPtdsImmediateTransactionSync<T>(db: DatabaseSync, operation: () => T): T {
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
