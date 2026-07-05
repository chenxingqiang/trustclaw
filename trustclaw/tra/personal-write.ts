import {
  generatePersonalWriteSql,
  resolvePersonalWriteSchemaSnippet,
} from "../runtime/text2sql/generate-personal-write.js";
import { recordDeviceImportAudit } from "./consent-audit.js";
import { openTraDatabase, resolvePrimaryUserId, runTraImmediateTransactionSync } from "./db.js";
import {
  executeDeviceImportStatements,
  hashDeviceImportStatements,
  type DeviceImportLlm,
} from "./device-import.js";
import type { DeviceImportPreviewResult, DeviceImportResult } from "./device-types.js";
import { resolveTraDbPath, type TraPathOverrides } from "./paths.js";
import { buildTraHealthProfileSummary } from "./profile-summary.js";

export type PersonalWriteRequest = {
  message: string;
  consentGranted: boolean;
  sessionId: string;
  agentPackId: string;
};

function profileSnapshotForWrite(
  dbPathOrOverrides: string | TraPathOverrides | undefined,
  env: NodeJS.ProcessEnv,
): Record<string, unknown> | null {
  const profile = buildTraHealthProfileSummary(
    typeof dbPathOrOverrides === "string"
      ? { dbPath: dbPathOrOverrides }
      : (dbPathOrOverrides ?? {}),
    env,
  );
  if (!profile.mounted) {
    return null;
  }
  return {
    patient_name: profile.patient_name,
    gender: profile.gender,
    age_years: profile.age_years,
    weight_kg: profile.weight_kg,
    height_cm: profile.height_cm,
    bmi: profile.bmi,
    hba1c_percent: profile.hba1c_percent,
    diagnoses: profile.diagnoses,
    medications: profile.medications,
    snapshot: profile.snapshot,
  };
}

export async function previewPersonalWrite(
  message: string,
  options: {
    llm: DeviceImportLlm;
    dbPathOrOverrides?: string | TraPathOverrides;
    promptTemplate?: string;
    writeTables?: readonly string[];
  },
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeviceImportPreviewResult> {
  const snapshot = profileSnapshotForWrite(options.dbPathOrOverrides, env);
  if (!snapshot) {
    return {
      status: "error",
      message:
        "Trust runtime is not initialized. Complete Panel A init before writing personal data.",
    };
  }

  const generated = await generatePersonalWriteSql(
    {
      writeRequest: message,
      profileSnapshot: snapshot,
      databaseSchema: resolvePersonalWriteSchemaSnippet(options.writeTables),
      promptTemplate: options.promptTemplate,
    },
    { llm: options.llm },
  );

  if (!generated.write_verification || generated.statements.length === 0) {
    return {
      status: "error",
      message: generated.security_error ?? "Personal write SQL generation failed security checks.",
      duration_ms: generated.duration_ms,
    };
  }

  return {
    status: "success",
    message: "Write request mapped to INSERT SQL via Text2SQL.",
    sql_statements: generated.statements,
    sql_hash: hashDeviceImportStatements(generated.statements),
    statement_count: generated.statements.length,
    tables: generated.tables,
    duration_ms: generated.duration_ms,
  };
}

export async function executePersonalWrite(
  request: PersonalWriteRequest,
  options: {
    llm: DeviceImportLlm;
    dbPathOrOverrides?: string | TraPathOverrides;
    auditDir?: string;
    promptTemplate?: string;
    writeTables?: readonly string[];
  },
  env: NodeJS.ProcessEnv = process.env,
): Promise<DeviceImportResult> {
  if (!request.consentGranted) {
    recordDeviceImportAudit({
      sessionId: request.sessionId,
      agentPackId: request.agentPackId.trim(),
      sqlHash: "blocked",
      tables: [],
      rowsAffected: 0,
      granted: false,
      sourceLabel: "chat-personal-write",
      auditDir: options.auditDir,
      overrides:
        typeof options.dbPathOrOverrides === "object" ? options.dbPathOrOverrides : undefined,
    });
    return {
      status: "error",
      message: "User consent is required before writing personal data to TRA.",
    };
  }

  const preview = await previewPersonalWrite(request.message, options, env);
  if (preview.status !== "success" || !preview.sql_statements?.length || !preview.sql_hash) {
    return {
      status: "error",
      message: preview.message,
    };
  }

  const dbPath =
    typeof options.dbPathOrOverrides === "string" || options.dbPathOrOverrides === undefined
      ? resolveTraDbPath(
          typeof options.dbPathOrOverrides === "string"
            ? { dbPath: options.dbPathOrOverrides }
            : {},
          env,
        )
      : resolveTraDbPath(options.dbPathOrOverrides, env);

  try {
    const db = openTraDatabase(dbPath);
    try {
      const rowsAffected = runTraImmediateTransactionSync(db, () => {
        if (!resolvePrimaryUserId(db)) {
          throw new Error("Trust runtime is not initialized. Call POST /api/tra/init first.");
        }
        return executeDeviceImportStatements(db, preview.sql_statements!);
      });

      recordDeviceImportAudit({
        sessionId: request.sessionId,
        agentPackId: request.agentPackId.trim(),
        sqlHash: preview.sql_hash,
        tables: preview.tables ?? [],
        rowsAffected,
        granted: true,
        sourceLabel: "chat-personal-write",
        auditDir: options.auditDir,
        overrides:
          typeof options.dbPathOrOverrides === "object" ? options.dbPathOrOverrides : undefined,
      });

      return {
        status: "success",
        message: "Personal data written to TRA.",
        rows_affected: rowsAffected,
        tables: preview.tables,
        statement_count: preview.statement_count,
        sql_hash: preview.sql_hash,
      };
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordDeviceImportAudit({
      sessionId: request.sessionId,
      agentPackId: request.agentPackId.trim(),
      sqlHash: preview.sql_hash,
      tables: preview.tables ?? [],
      rowsAffected: 0,
      granted: false,
      sourceLabel: "chat-personal-write",
      auditDir: options.auditDir,
      overrides:
        typeof options.dbPathOrOverrides === "object" ? options.dbPathOrOverrides : undefined,
    });
    return { status: "error", message };
  }
}
