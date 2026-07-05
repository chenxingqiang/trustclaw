import { readFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openTraDatabase, bootstrapTraDatabase, runTraImmediateTransactionSync } from "./db.js";
import {
  migrateLegacyDomainAgentsTable,
  migrateLegacyTraStateFiles,
  normalizeLegacyTraNaming,
} from "./legacy-state-migration.js";
import {
  TRA_DOMAIN_AGENTS_MIGRATION_SQL,
  TRA_DOMAIN_AGENTS_REGISTRY_SQL,
  resolveTraDbPath,
  type TraPathOverrides,
} from "./paths.js";

export const DOMAIN_AGENTS_FULL_REGISTRY_TARGET = 1000;

export type DomainAgentsImportResult = {
  status: "success" | "error" | "skipped";
  message: string;
  imported_count?: number;
  total_count?: number;
};

function domainAgentsTableExists(db: DatabaseSync): boolean {
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'domain_agents' LIMIT 1",
    )
    .get() as { ok: number } | undefined;
  return row?.ok === 1;
}

export function countDomainAgents(db: DatabaseSync): number {
  if (!domainAgentsTableExists(db)) {
    return 0;
  }
  const row = db.prepare("SELECT COUNT(*) AS count FROM domain_agents").get() as { count: number };
  return row.count ?? 0;
}

export function importDomainAgentsRegistrySql(
  db: DatabaseSync,
  sql: string,
  options: { replace?: boolean } = {},
): number {
  const normalized = sql.trim();
  if (!normalized) {
    throw new Error("Domain agent registry SQL is empty.");
  }
  if (options.replace && domainAgentsTableExists(db)) {
    db.exec("DROP TABLE IF EXISTS domain_agents");
    db.exec("DROP TABLE IF EXISTS domain_agent_packs");
  }
  db.exec(normalizeLegacyTraNaming(normalized));
  migrateLegacyDomainAgentsTable(db);
  return countDomainAgents(db);
}

export function importDomainAgentsRegistryFromFile(
  db: DatabaseSync,
  sqlFilePath: string,
  options: { replace?: boolean } = {},
): number {
  const sql = readFileSync(sqlFilePath, "utf8");
  return importDomainAgentsRegistrySql(db, sql, options);
}

export function seedDomainAgentsRegistryIfEmpty(
  dbPathOrOverrides: string | TraPathOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
  options: { minCount?: number } = {},
): DomainAgentsImportResult {
  const dbPath =
    typeof dbPathOrOverrides === "string"
      ? dbPathOrOverrides
      : resolveTraDbPath(dbPathOrOverrides, env);
  try {
    const db = bootstrapTraDatabase(dbPath);
    try {
      const total = countDomainAgents(db);
      const minCount = options.minCount ?? DOMAIN_AGENTS_FULL_REGISTRY_TARGET;
      if (total >= minCount) {
        return {
          status: "skipped",
          message: `domain_agents already has ${total} rows (>= ${minCount}).`,
          total_count: total,
        };
      }
      return {
        status: "success",
        message: `domain_agents registry ready (${total} rows).`,
        total_count: total,
      };
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }
}

export function importBundledDomainAgentsMigration(
  dbPathOrOverrides: string | TraPathOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
): DomainAgentsImportResult {
  const dbPath =
    typeof dbPathOrOverrides === "string"
      ? dbPathOrOverrides
      : resolveTraDbPath(dbPathOrOverrides, env);
  bootstrapTraDatabase(dbPath);
  const db = openTraDatabase(dbPath);
  try {
    const before = countDomainAgents(db);
    const total = runTraImmediateTransactionSync(db, () =>
      importDomainAgentsRegistryFromFile(db, TRA_DOMAIN_AGENTS_MIGRATION_SQL, { replace: false }),
    );
    return {
      status: "success",
      message: `Applied bundled domain agent pack migration (${before} → ${total} rows).`,
      imported_count: total - before,
      total_count: total,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  } finally {
    db.close();
  }
}

export function importDomainAgentsRegistryPackage(
  dbPathOrOverrides: string | TraPathOverrides,
  sql: string,
  env: NodeJS.ProcessEnv = process.env,
): DomainAgentsImportResult {
  const dbPath =
    typeof dbPathOrOverrides === "string"
      ? dbPathOrOverrides
      : resolveTraDbPath(dbPathOrOverrides, env);
  const db = openTraDatabase(dbPath);
  try {
    bootstrapTraDatabase(dbPath);
    const before = countDomainAgents(db);
    const total = runTraImmediateTransactionSync(db, () =>
      importDomainAgentsRegistrySql(db, sql, { replace: true }),
    );
    return {
      status: "success",
      message: `Imported domain agent registry (${before} → ${total} rows).`,
      imported_count: total - before,
      total_count: total,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  } finally {
    db.close();
  }
}
