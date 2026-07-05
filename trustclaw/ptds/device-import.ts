import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  assertDeviceImportStatements,
  DeviceImportSecurityError,
  splitInsertStatements,
} from "../runtime/text2sql/device-write-sanitize.js";
import { generateDeviceImportSql } from "../runtime/text2sql/generate-device-import.js";
import { recordDeviceImportAudit } from "./consent-audit.js";
import {
  bootstrapPtdsDatabase,
  openPtdsDatabase,
  resolvePrimaryUserId,
  runPtdsImmediateTransactionSync,
} from "./db.js";
import type {
  DeviceImportExecuteRequest,
  DeviceImportPreviewResult,
  DeviceImportResult,
} from "./device-types.js";
import { resolvePtdsDbPath, type PtdsPathOverrides } from "./paths.js";
import { fetchReferencePackageFromUrl } from "./reference-import.js";

export type DeviceImportLlm = (prompt: string) => Promise<string>;

export function hashDeviceImportStatements(statements: string[]): string {
  return createHash("sha256").update(statements.join("\n")).digest("hex");
}

export function executeDeviceImportStatements(db: DatabaseSync, statements: string[]): number {
  const verified = assertDeviceImportStatements(statements);
  let rowsAffected = 0;
  for (const statement of statements) {
    const result = db.prepare(statement).run();
    rowsAffected += result.changes;
  }
  return rowsAffected;
}

async function resolveDevicePayload(body: {
  package?: unknown;
  url?: string;
}): Promise<{ ok: true; payload: unknown } | { ok: false; message: string }> {
  if (body.package !== undefined) {
    return { ok: true, payload: body.package };
  }
  const url = body.url?.trim();
  if (!url) {
    return { ok: false, message: "Provide package or url." };
  }
  try {
    const payload = await fetchReferencePackageFromUrl(url);
    return { ok: true, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }
}

export async function previewDeviceImport(
  params: {
    package?: unknown;
    url?: string;
    deviceHint?: string;
  },
  options: { llm: DeviceImportLlm; dbPathOrOverrides?: string | PtdsPathOverrides },
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeviceImportPreviewResult> {
  const resolved = await resolveDevicePayload(params);
  if (!resolved.ok) {
    return { status: "error", message: resolved.message };
  }

  const dbPath =
    typeof options.dbPathOrOverrides === "string" || options.dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof options.dbPathOrOverrides === "string"
            ? { dbPath: options.dbPathOrOverrides }
            : {},
          env,
        )
      : resolvePtdsDbPath(options.dbPathOrOverrides, env);
  const db = bootstrapPtdsDatabase(dbPath);
  try {
    if (!resolvePrimaryUserId(db)) {
      return {
        status: "error",
        message: "Trust runtime is not initialized. Complete Panel A init before importing device data.",
      };
    }
  } finally {
    db.close();
  }

  const generated = await generateDeviceImportSql(
    { devicePayload: resolved.payload, deviceHint: params.deviceHint },
    { llm: options.llm },
  );

  if (!generated.write_verification || generated.statements.length === 0) {
    return {
      status: "error",
      message: generated.security_error ?? "Device import SQL generation failed security checks.",
      duration_ms: generated.duration_ms,
      payload_bytes: JSON.stringify(resolved.payload).length,
    };
  }

  return {
    status: "success",
    message: "Device payload mapped to INSERT SQL via Text2SQL.",
    sql_statements: generated.statements,
    sql_hash: hashDeviceImportStatements(generated.statements),
    statement_count: generated.statements.length,
    tables: generated.tables,
    duration_ms: generated.duration_ms,
    payload_bytes: JSON.stringify(resolved.payload).length,
  };
}

export async function importDeviceData(
  request: DeviceImportExecuteRequest,
  options: {
    llm?: DeviceImportLlm;
    dbPathOrOverrides?: string | PtdsPathOverrides;
    auditDir?: string;
  },
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeviceImportResult> {
  if (!request.consentGranted) {
    const agentPackId = request.agentPackId?.trim();
    if (agentPackId) {
      recordDeviceImportAudit({
        sessionId: request.sessionId,
        agentPackId,
        sqlHash: request.sql_hash,
        tables: [],
        rowsAffected: 0,
        granted: false,
        auditDir: options.auditDir,
        overrides:
          typeof options.dbPathOrOverrides === "object" ? options.dbPathOrOverrides : undefined,
      });
    }
    return {
      status: "error",
      message: "User consent is required before importing third-party device data.",
    };
  }

  const agentPackId = request.agentPackId?.trim();
  if (!agentPackId) {
    return {
      status: "error",
      message: "agentPackId is required for device import audit.",
    };
  }

  const statements = request.sql_statements.map((statement) => statement.trim()).filter(Boolean);
  const sqlHash = hashDeviceImportStatements(statements);
  if (sqlHash !== request.sql_hash) {
    return {
      status: "error",
      message: "SQL hash mismatch. Preview again before import.",
    };
  }

  let verifiedTables: string[] = [];
  try {
    verifiedTables = assertDeviceImportStatements(statements).tables;
  } catch (error) {
    const message = error instanceof DeviceImportSecurityError ? error.message : String(error);
    return { status: "error", message };
  }

  const dbPath =
    typeof options.dbPathOrOverrides === "string" || options.dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof options.dbPathOrOverrides === "string"
            ? { dbPath: options.dbPathOrOverrides }
            : {},
          env,
        )
      : resolvePtdsDbPath(options.dbPathOrOverrides, env);

  try {
    const db = openPtdsDatabase(dbPath);
    try {
      const rowsAffected = runPtdsImmediateTransactionSync(db, () => {
        if (!resolvePrimaryUserId(db)) {
          throw new Error("Trust runtime is not initialized. Call POST /api/ptds/init first.");
        }
        return executeDeviceImportStatements(db, statements);
      });

      recordDeviceImportAudit({
        sessionId: request.sessionId,
        agentPackId,
        sqlHash,
        tables: verifiedTables,
        rowsAffected,
        granted: true,
        sourceLabel: request.sourceLabel,
        auditDir: options.auditDir,
        overrides:
          typeof options.dbPathOrOverrides === "object" ? options.dbPathOrOverrides : undefined,
      });

      return {
        status: "success",
        message: "Third-party device data imported into PTDS.",
        rows_affected: rowsAffected,
        tables: verifiedTables,
        statement_count: statements.length,
        sql_hash: sqlHash,
      };
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordDeviceImportAudit({
      sessionId: request.sessionId,
      agentPackId,
      sqlHash,
      tables: verifiedTables,
      rowsAffected: 0,
      granted: false,
      auditDir: options.auditDir,
      overrides:
        typeof options.dbPathOrOverrides === "object" ? options.dbPathOrOverrides : undefined,
    });
    return { status: "error", message };
  }
}

/** Test helper: finalize raw LLM SQL into validated statements. */
export function finalizeDeviceImportSql(rawSql: string): string[] {
  const statements = splitInsertStatements(rawSql);
  assertDeviceImportStatements(statements);
  return statements;
}
