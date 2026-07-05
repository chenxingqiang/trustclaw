export type AuditStepCode =
  | "AGENT_DOMAIN_GRANT"
  | "COMPLIANCE_IMPORT"
  | "REFERENCE_SYNC"
  | "DEVICE_IMPORT"
  | "DATA_CONSENT"
  | "TEXT2SQL_GEN"
  | "DB_QUERY"
  | "RULE_EVAL"
  | "AGENT_DECISION"
  | "LEDGER_COMMIT";

export type AuditComponent =
  | "TRA.AgentDomainGrant"
  | "TRA.ComplianceImport"
  | "TRA.ReferenceSync"
  | "TRA.DeviceImport"
  | "TRA.Consent"
  | "AgentRuntime.Text2SQL"
  | "TRA.Query"
  | "AgentRuntime.ExecRule"
  | "Agent.GLP1Decision"
  | "EvidenceLedger.Commit";

export type AuditEventStatus = "SUCCESS" | "FAILURE" | "BLOCKED";

export type AuditEvent = {
  event_id: string;
  audit_trail_id: string;
  step: AuditStepCode;
  timestamp: number;
  component: AuditComponent;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: AuditEventStatus;
};

export type AuditRecorderOptions = {
  auditDir: string;
  auditTrailId: string;
  sessionId: string;
};
