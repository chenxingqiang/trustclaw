import { randomBytes } from "node:crypto";
import { AuditRecorder } from "../audit/index.js";
import type { AgentDomainScope } from "./agent-domain-scopes.js";
import { resolvePtdsAuditDir, type PtdsPathOverrides } from "./paths.js";

function createGrantTrailId(): string {
  return `grant_${randomBytes(6).toString("hex")}`;
}

export function recordAgentDomainGrantAudit(params: {
  sessionId: string;
  agentPackId: string;
  scopes: readonly AgentDomainScope[];
  granted: boolean;
  auditDir?: string;
  overrides?: PtdsPathOverrides;
}): void {
  const auditDir =
    params.auditDir?.trim() ||
    params.overrides?.auditDir?.trim() ||
    resolvePtdsAuditDir(params.overrides);
  const audit = new AuditRecorder({
    auditDir,
    auditTrailId: createGrantTrailId(),
    sessionId: params.sessionId,
  });
  audit.record({
    step: "AGENT_DOMAIN_GRANT",
    component: "PTDS.AgentDomainGrant",
    input: {
      agent_pack_id: params.agentPackId,
      scopes: [...params.scopes],
    },
    output: {
      granted: params.granted,
      scope_count: params.scopes.length,
    },
    status: params.granted ? "SUCCESS" : "BLOCKED",
  });
}
