import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  complianceStandardPackageSchema,
  type ComplianceImportRequest,
  type ComplianceImportResult,
  type CompliancePreviewResult,
  type ComplianceStandardPackage,
  type MedicationComplianceAstRuleRow,
  type MedicationComplianceStandardRow,
} from "./compliance-types.js";
import { recordComplianceImportAudit } from "./consent-audit.js";
import { bootstrapTraDatabase, runTraImmediateTransactionSync } from "./db.js";
import { resolveTraDbPath, type TraPathOverrides } from "./paths.js";

const NRDL_EXTERNAL_SOURCE = "NRDL_EXTERNAL";

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parsePackage(raw: unknown): ComplianceStandardPackage {
  return complianceStandardPackageSchema.parse(raw);
}

export function previewComplianceStandardPackage(raw: unknown): CompliancePreviewResult {
  try {
    const pkg = parsePackage(raw);
    return {
      status: "success",
      message: "Compliance standard package validated.",
      metadata: pkg.metadata,
      rule_count: pkg.ast_rules.length,
      drug_ids: [...new Set(pkg.ast_rules.map((rule) => rule.drug_id))],
      source_file_hash: sha256Json(pkg),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }
}

function upsertDrugRegistry(db: DatabaseSync, drugId: string, drugName: string): void {
  db.prepare(
    `INSERT INTO nrdl_drug_registry (
       drug_id, generic_name, active_ingredient, atc_code, is_negotiated_drug
     ) VALUES (?, ?, ?, 'A10BJ', 1)
     ON CONFLICT(drug_id) DO UPDATE SET
       generic_name = excluded.generic_name,
       active_ingredient = excluded.active_ingredient`,
  ).run(drugId, drugName, drugName);
}

function deactivateOtherStandards(db: DatabaseSync, keepStandardId: string): void {
  db.prepare(
    `UPDATE medication_compliance_standards
     SET is_active = 0
     WHERE standard_id != ?`,
  ).run(keepStandardId);
}

export function importComplianceStandardPackage(
  request: ComplianceImportRequest,
  dbPathOrOverrides?: string | TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): ComplianceImportResult {
  if (!request.consentGranted) {
    return {
      status: "error",
      message: "User consent is required before importing external compliance standards.",
    };
  }
  const sessionId = request.sessionId.trim();
  if (!sessionId) {
    return { status: "error", message: "sessionId is required for consent audit." };
  }
  const agentPackId = request.agentPackId.trim();
  if (!agentPackId) {
    return { status: "error", message: "agentPackId is required for compliance import audit." };
  }

  let pkg: ComplianceStandardPackage;
  try {
    pkg = parsePackage(request.package);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }

  const sourceFileHash = sha256Json(pkg);
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolveTraDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolveTraDbPath(dbPathOrOverrides, env);
  const auditDir =
    typeof dbPathOrOverrides === "object" && dbPathOrOverrides?.auditDir
      ? dbPathOrOverrides.auditDir
      : undefined;

  try {
    const db = bootstrapTraDatabase(dbPath);
    const standardId = pkg.metadata.version_id;
    const drugsRegistered = runTraImmediateTransactionSync(db, () => {
      deactivateOtherStandards(db, standardId);
      db.prepare(
        `INSERT INTO medication_compliance_standards (
           standard_id, schema_uri, release_date, publisher, publisher_signature,
           ruleset_hash, source_file_hash, source_label, consent_session_id, is_active
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(standard_id) DO UPDATE SET
           schema_uri = excluded.schema_uri,
           release_date = excluded.release_date,
           publisher = excluded.publisher,
           publisher_signature = excluded.publisher_signature,
           ruleset_hash = excluded.ruleset_hash,
           source_file_hash = excluded.source_file_hash,
           source_label = excluded.source_label,
           consent_session_id = excluded.consent_session_id,
           imported_at = CURRENT_TIMESTAMP,
           is_active = 1`,
      ).run(
        standardId,
        pkg.$schema ?? null,
        pkg.metadata.release_date,
        pkg.metadata.publisher,
        pkg.metadata.publisher_signature ?? null,
        pkg.metadata.ruleset_hash,
        sourceFileHash,
        request.sourceLabel?.trim() || "external-compliance-package",
        sessionId,
      );

      db.prepare(`DELETE FROM medication_compliance_ast_rules WHERE standard_id = ?`).run(
        standardId,
      );

      const insertRule = db.prepare(
        `INSERT INTO medication_compliance_ast_rules (
           rule_id, standard_id, drug_id, drug_name, ast_root_json
         ) VALUES (?, ?, ?, ?, ?)`,
      );

      const drugIds = new Set<string>();
      for (const rule of pkg.ast_rules) {
        insertRule.run(
          rule.rule_id,
          standardId,
          rule.drug_id,
          rule.drug_name,
          JSON.stringify(rule.ast_root),
        );
        upsertDrugRegistry(db, rule.drug_id, rule.drug_name);
        drugIds.add(rule.drug_id);
      }
      return drugIds.size;
    });
    db.close();

    recordComplianceImportAudit({
      sessionId,
      agentPackId: request.agentPackId.trim(),
      standardId,
      rulesetHash: pkg.metadata.ruleset_hash,
      rulesImported: pkg.ast_rules.length,
      granted: true,
      auditDir,
      overrides: typeof dbPathOrOverrides === "object" ? dbPathOrOverrides : { dbPath },
    });

    return {
      status: "success",
      message: "External compliance standard imported.",
      standard_id: standardId,
      rules_imported: pkg.ast_rules.length,
      drugs_registered: drugsRegistered,
      source_file_hash: sourceFileHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message, source_file_hash: sourceFileHash };
  }
}

export function getActiveComplianceStandard(
  db: DatabaseSync,
): MedicationComplianceStandardRow | null {
  const row = db
    .prepare(
      `SELECT standard_id, schema_uri, release_date, publisher, publisher_signature,
              ruleset_hash, source_file_hash, source_label, imported_at, consent_session_id, is_active
       FROM medication_compliance_standards
       WHERE is_active = 1
       ORDER BY imported_at DESC
       LIMIT 1`,
    )
    .get() as MedicationComplianceStandardRow | undefined;
  return row ?? null;
}

export function listComplianceStandards(db: DatabaseSync): MedicationComplianceStandardRow[] {
  return db
    .prepare(
      `SELECT standard_id, schema_uri, release_date, publisher, publisher_signature,
              ruleset_hash, source_file_hash, source_label, imported_at, consent_session_id, is_active
       FROM medication_compliance_standards
       ORDER BY imported_at DESC`,
    )
    .all() as MedicationComplianceStandardRow[];
}

export function loadComplianceAstRules(
  db: DatabaseSync,
  standardId: string,
  drugId?: string,
): MedicationComplianceAstRuleRow[] {
  if (drugId) {
    return db
      .prepare(
        `SELECT rule_id, standard_id, drug_id, drug_name, ast_root_json
         FROM medication_compliance_ast_rules
         WHERE standard_id = ? AND drug_id = ?
         ORDER BY rule_id`,
      )
      .all(standardId, drugId) as MedicationComplianceAstRuleRow[];
  }
  return db
    .prepare(
      `SELECT rule_id, standard_id, drug_id, drug_name, ast_root_json
       FROM medication_compliance_ast_rules
       WHERE standard_id = ?
       ORDER BY drug_id, rule_id`,
    )
    .all(standardId) as MedicationComplianceAstRuleRow[];
}

export { NRDL_EXTERNAL_SOURCE };
