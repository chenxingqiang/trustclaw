export type AuditStepCode =
  | "TEXT2SQL_GEN"
  | "DB_QUERY"
  | "RULE_EVAL"
  | "AGENT_DECISION"
  | "LEDGER_COMMIT";

export type AuditComponent =
  | "AgentRuntime.Text2SQL"
  | "PTDS.Query"
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
