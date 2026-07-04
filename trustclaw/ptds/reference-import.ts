import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { recordReferenceSyncAudit } from "./consent-audit.js";
import { bootstrapPtdsDatabase, runPtdsImmediateTransactionSync } from "./db.js";
import { resolvePtdsDbPath, type PtdsPathOverrides } from "./paths.js";
import {
  nrdlReferencePackageSchema,
  type NrdlReferencePackage,
  type ReferencePreviewResult,
  type ReferenceStatusResult,
  type ReferenceSyncRequest,
  type ReferenceSyncResult,
  type ReferenceSyncStateRow,
} from "./reference-types.js";

const NRDL_REFERENCE_SOURCE = "NRDL_EXTERNAL";

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parsePackage(raw: unknown): NrdlReferencePackage {
  return nrdlReferencePackageSchema.parse(raw);
}

function normalizeNegotiatedDrug(
  value: NrdlReferencePackage["drugs"][number]["is_negotiated_drug"],
): number {
  if (value === true || value === 1) {
    return 1;
  }
  return 0;
}

export function isAllowedReferenceFetchUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") {
    return true;
  }
  if (parsed.protocol === "http:") {
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }
  return false;
}

export async function fetchReferencePackageFromUrl(url: string): Promise<unknown> {
  const trimmed = url.trim();
  if (!isAllowedReferenceFetchUrl(trimmed)) {
    throw new Error("Reference subscription URL must be https:// or http://localhost.");
  }
  const response = await fetch(trimmed, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Reference fetch failed (${response.status} ${response.statusText}).`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json") && !contentType.includes("text/plain")) {
    throw new Error("Reference fetch response must be JSON.");
  }
  return response.json() as Promise<unknown>;
}

export function previewNrdlReferencePackage(
  raw: unknown,
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): ReferencePreviewResult {
  try {
    const pkg = parsePackage(raw);
    const packageHash = sha256Json(pkg);
    const dbPath =
      typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
        ? resolvePtdsDbPath(
            typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
            env,
          )
        : resolvePtdsDbPath(dbPathOrOverrides, env);
    const db = bootstrapPtdsDatabase(dbPath);
    let changedFromLocal = true;
    try {
      const lastSync = getReferenceSyncState(db);
      changedFromLocal = !lastSync || lastSync.package_hash !== packageHash;
    } finally {
      db.close();
    }
    return {
      status: "success",
      message: "NRDL reference package validated.",
      metadata: pkg.metadata,
      drug_count: pkg.drugs.length,
      rule_count: pkg.payment_rules.length,
      drug_ids: [...new Set(pkg.drugs.map((drug) => drug.drug_id))],
      package_hash: packageHash,
      changed_from_local: changedFromLocal,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }
}

function ensureNrdlExternalSource(db: DatabaseSync): void {
  db.prepare(
    `INSERT OR IGNORE INTO data_source_registry (
       source_id, source_name, source_category, reliability_level
     ) VALUES (?, 'NRDL External Reference', 'HOSPITAL', 3)`,
  ).run(NRDL_REFERENCE_SOURCE);
}

function upsertReferenceSyncState(
  db: DatabaseSync,
  params: {
    versionId: string;
    packageHash: string;
    sourceLabel: string | null;
    subscriptionUrl: string | null;
    sessionId: string;
    drugCount: number;
    ruleCount: number;
  },
): void {
  db.prepare(
    `INSERT INTO nrdl_reference_sync_state (
       sync_id, version_id, package_hash, source_label, subscription_url,
       consent_session_id, drug_count, rule_count, synced_at
     ) VALUES ('active', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(sync_id) DO UPDATE SET
       version_id = excluded.version_id,
       package_hash = excluded.package_hash,
       source_label = excluded.source_label,
       subscription_url = COALESCE(excluded.subscription_url, nrdl_reference_sync_state.subscription_url),
       consent_session_id = excluded.consent_session_id,
       drug_count = excluded.drug_count,
       rule_count = excluded.rule_count,
       synced_at = CURRENT_TIMESTAMP`,
  ).run(
    params.versionId,
    params.packageHash,
    params.sourceLabel,
    params.subscriptionUrl,
    params.sessionId,
    params.drugCount,
    params.ruleCount,
  );
}

export function getReferenceSyncState(db: DatabaseSync): ReferenceSyncStateRow | null {
  const row = db
    .prepare(
      `SELECT sync_id, version_id, package_hash, source_label, subscription_url,
              consent_session_id, drug_count, rule_count, synced_at
       FROM nrdl_reference_sync_state
       WHERE sync_id = 'active'
       LIMIT 1`,
    )
    .get() as ReferenceSyncStateRow | undefined;
  return row ?? null;
}

export function getNrdlReferenceStatus(
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): ReferenceStatusResult {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  const db = bootstrapPtdsDatabase(dbPath);
  try {
    const drugRow = db.prepare("SELECT COUNT(*) AS count FROM nrdl_drug_registry").get() as {
      count: number;
    };
    const ruleRow = db.prepare("SELECT COUNT(*) AS count FROM nrdl_payment_rules").get() as {
      count: number;
    };
    return {
      status: "success",
      local_drug_count: drugRow.count,
      local_rule_count: ruleRow.count,
      last_sync: getReferenceSyncState(db),
    };
  } finally {
    db.close();
  }
}

export async function syncNrdlReferencePackage(
  request: ReferenceSyncRequest,
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReferenceSyncResult> {
  if (!request.consentGranted) {
    return {
      status: "error",
      message: "User consent is required before syncing external NRDL reference data.",
    };
  }
  const sessionId = request.sessionId.trim();
  if (!sessionId) {
    return { status: "error", message: "sessionId is required for consent audit." };
  }
  const agentPackId = request.agentPackId.trim();
  if (!agentPackId) {
    return { status: "error", message: "agentPackId is required for reference sync audit." };
  }

  let rawPackage = request.package;
  const subscriptionUrl = request.url?.trim() || null;
  if (!rawPackage) {
    if (!subscriptionUrl) {
      return { status: "error", message: "Provide package JSON or subscription url." };
    }
    try {
      rawPackage = await fetchReferencePackageFromUrl(subscriptionUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: "error", message };
    }
  }

  let pkg: NrdlReferencePackage;
  try {
    pkg = parsePackage(rawPackage);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }

  const packageHash = sha256Json(pkg);
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  const auditDir =
    typeof dbPathOrOverrides === "object" && dbPathOrOverrides?.auditDir
      ? dbPathOrOverrides.auditDir
      : undefined;

  try {
    const db = bootstrapPtdsDatabase(dbPath);
    const existing = getReferenceSyncState(db);
    if (existing?.package_hash === packageHash) {
      db.close();
      return {
        status: "success",
        message: "NRDL reference package unchanged; sync skipped.",
        version_id: pkg.metadata.version_id,
        drugs_synced: pkg.drugs.length,
        rules_synced: pkg.payment_rules.length,
        package_hash: packageHash,
        subscription_url: request.saveSubscriptionUrl ? subscriptionUrl : existing.subscription_url,
        skipped_unchanged: true,
      };
    }

    const drugIdsInPackage = runPtdsImmediateTransactionSync(db, () => {
      ensureNrdlExternalSource(db);

      const upsertDrug = db.prepare(
        `INSERT INTO nrdl_drug_registry (
           drug_id, generic_name, active_ingredient, atc_code,
           is_negotiated_drug, agreement_expiry_date
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(drug_id) DO UPDATE SET
           generic_name = excluded.generic_name,
           active_ingredient = excluded.active_ingredient,
           atc_code = excluded.atc_code,
           is_negotiated_drug = excluded.is_negotiated_drug,
           agreement_expiry_date = excluded.agreement_expiry_date`,
      );

      const drugIds = new Set<string>();
      for (const drug of pkg.drugs) {
        upsertDrug.run(
          drug.drug_id,
          drug.generic_name,
          drug.active_ingredient,
          drug.atc_code,
          normalizeNegotiatedDrug(drug.is_negotiated_drug),
          drug.agreement_expiry_date ?? null,
        );
        drugIds.add(drug.drug_id);
      }

      const deleteRulesForDrug = db.prepare(`DELETE FROM nrdl_payment_rules WHERE drug_id = ?`);
      const insertRule = db.prepare(
        `INSERT INTO nrdl_payment_rules (
           rule_id, drug_id, rule_category, target_key,
           comparison_operator, comparison_value, alert_message
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(rule_id) DO UPDATE SET
           drug_id = excluded.drug_id,
           rule_category = excluded.rule_category,
           target_key = excluded.target_key,
           comparison_operator = excluded.comparison_operator,
           comparison_value = excluded.comparison_value,
           alert_message = excluded.alert_message`,
      );

      for (const drugId of drugIds) {
        deleteRulesForDrug.run(drugId);
      }
      for (const rule of pkg.payment_rules) {
        insertRule.run(
          rule.rule_id,
          rule.drug_id,
          rule.rule_category,
          rule.target_key,
          rule.comparison_operator,
          rule.comparison_value,
          rule.alert_message,
        );
      }

      const savedUrl =
        request.saveSubscriptionUrl && subscriptionUrl
          ? subscriptionUrl
          : (existing?.subscription_url ?? null);

      upsertReferenceSyncState(db, {
        versionId: pkg.metadata.version_id,
        packageHash,
        sourceLabel: request.sourceLabel?.trim() || subscriptionUrl || "nrdl-reference-package",
        subscriptionUrl: savedUrl,
        sessionId,
        drugCount: pkg.drugs.length,
        ruleCount: pkg.payment_rules.length,
      });

      return drugIds;
    });
    db.close();

    recordReferenceSyncAudit({
      sessionId,
      agentPackId: request.agentPackId.trim(),
      versionId: pkg.metadata.version_id,
      packageHash,
      drugsSynced: drugIdsInPackage.size,
      rulesSynced: pkg.payment_rules.length,
      granted: true,
      subscriptionUrl: request.saveSubscriptionUrl ? subscriptionUrl : undefined,
      auditDir,
      overrides: typeof dbPathOrOverrides === "object" ? dbPathOrOverrides : { dbPath },
    });

    return {
      status: "success",
      message: "NRDL reference dataset synced to local PTDS.",
      version_id: pkg.metadata.version_id,
      drugs_synced: drugIdsInPackage.size,
      rules_synced: pkg.payment_rules.length,
      package_hash: packageHash,
      subscription_url: request.saveSubscriptionUrl ? subscriptionUrl : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message, package_hash: packageHash };
  }
}

export { NRDL_REFERENCE_SOURCE };
