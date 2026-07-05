import { randomBytes } from "node:crypto";
import { AuditRecorder } from "../audit/index.js";
import { resolveTraAuditDir, type TraPathOverrides } from "./paths.js";

export type TraConsentDecision = "allow-once" | "allow-always" | "deny" | "timeout" | "cancelled";

function createConsentTrailId(): string {
  return `consent_${randomBytes(6).toString("hex")}`;
}

export function recordComplianceImportAudit(params: {
  sessionId: string;
  agentPackId: string;
  standardId: string;
  rulesetHash: string;
  rulesImported: number;
  granted: boolean;
  auditDir?: string;
  overrides?: TraPathOverrides;
}): void {
  const auditDir =
    params.auditDir?.trim() ||
    params.overrides?.auditDir?.trim() ||
    resolveTraAuditDir(params.overrides);
  const audit = new AuditRecorder({
    auditDir,
    auditTrailId: createConsentTrailId(),
    sessionId: params.sessionId,
  });
  audit.record({
    step: "COMPLIANCE_IMPORT",
    component: "TRA.ComplianceImport",
    input: {
      agent_pack_id: params.agentPackId.trim(),
      standard_id: params.standardId,
      ruleset_hash: params.rulesetHash,
    },
    output: {
      rules_imported: params.rulesImported,
      granted: params.granted,
    },
    status: params.granted ? "SUCCESS" : "BLOCKED",
  });
}

export function recordDeviceImportAudit(params: {
  sessionId: string;
  agentPackId: string;
  sqlHash: string;
  tables: string[];
  rowsAffected: number;
  granted: boolean;
  sourceLabel?: string;
  auditDir?: string;
  overrides?: TraPathOverrides;
}): void {
  const auditDir =
    params.auditDir?.trim() ||
    params.overrides?.auditDir?.trim() ||
    resolveTraAuditDir(params.overrides);
  const audit = new AuditRecorder({
    auditDir,
    auditTrailId: createConsentTrailId(),
    sessionId: params.sessionId,
  });
  audit.record({
    step: "DEVICE_IMPORT",
    component: "TRA.DeviceImport",
    input: {
      agent_pack_id: params.agentPackId.trim(),
      sql_hash: params.sqlHash,
      source_label: params.sourceLabel ?? null,
    },
    output: {
      tables: params.tables,
      rows_affected: params.rowsAffected,
      granted: params.granted,
    },
    status: params.granted ? "SUCCESS" : "BLOCKED",
  });
}

export function recordReferenceSyncAudit(params: {
  sessionId: string;
  agentPackId: string;
  versionId: string;
  packageHash: string;
  drugsSynced: number;
  rulesSynced: number;
  granted: boolean;
  subscriptionUrl?: string | null;
  auditDir?: string;
  overrides?: TraPathOverrides;
}): void {
  const auditDir =
    params.auditDir?.trim() ||
    params.overrides?.auditDir?.trim() ||
    resolveTraAuditDir(params.overrides);
  const audit = new AuditRecorder({
    auditDir,
    auditTrailId: createConsentTrailId(),
    sessionId: params.sessionId,
  });
  audit.record({
    step: "REFERENCE_SYNC",
    component: "TRA.ReferenceSync",
    input: {
      agent_pack_id: params.agentPackId.trim(),
      version_id: params.versionId,
      package_hash: params.packageHash,
      subscription_url: params.subscriptionUrl ?? null,
    },
    output: {
      drugs_synced: params.drugsSynced,
      rules_synced: params.rulesSynced,
      granted: params.granted,
    },
    status: params.granted ? "SUCCESS" : "BLOCKED",
  });
}

export function recordTraConsentAudit(params: {
  sessionId: string;
  agentPackId: string;
  question: string;
  privateDataFields: string[];
  decision: TraConsentDecision;
  granted: boolean;
  auditDir?: string;
  overrides?: TraPathOverrides;
}): void {
  const auditDir =
    params.auditDir?.trim() ||
    params.overrides?.auditDir?.trim() ||
    resolveTraAuditDir(params.overrides);
  const audit = new AuditRecorder({
    auditDir,
    auditTrailId: createConsentTrailId(),
    sessionId: params.sessionId,
  });
  audit.record({
    step: "DATA_CONSENT",
    component: "TRA.Consent",
    input: {
      agent_pack_id: params.agentPackId.trim(),
      user_query: params.question,
      private_data_fields: params.privateDataFields,
    },
    output: {
      decision: params.decision,
      granted: params.granted,
    },
    status: params.granted ? "SUCCESS" : "BLOCKED",
  });
}
