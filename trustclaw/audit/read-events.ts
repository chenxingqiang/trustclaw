import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AuditEvent, AuditStepCode } from "./types.js";

export type ReadAuditEventsOptions = {
  auditDir: string;
  limit?: number;
  steps?: readonly AuditStepCode[];
};

function resolveAuditEventsPath(auditDir: string): string {
  return path.join(auditDir, "events.jsonl");
}

export function readAuditEvents(options: ReadAuditEventsOptions): AuditEvent[] {
  const filePath = resolveAuditEventsPath(options.auditDir);
  if (!existsSync(filePath)) {
    return [];
  }
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
  const stepFilter = options.steps ? new Set<AuditStepCode>(options.steps) : null;
  const matched: AuditEvent[] = [];

  for (let index = lines.length - 1; index >= 0 && matched.length < limit; index -= 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    try {
      const event = JSON.parse(line) as AuditEvent;
      if (stepFilter && !stepFilter.has(event.step)) {
        continue;
      }
      matched.push(event);
    } catch {
      continue;
    }
  }

  return matched.reverse();
}

/** Remove chat/compliance audit JSONL for demo reset (Task 503). */
export function clearAuditEvents(auditDir: string): void {
  const filePath = resolveAuditEventsPath(auditDir);
  try {
    unlinkSync(filePath);
  } catch {
    // Missing file is already cleared.
  }
  mkdirSync(auditDir, { recursive: true });
  writeFileSync(filePath, "", "utf8");
}

export const COMPLIANCE_AUDIT_STEPS = [
  "AGENT_DOMAIN_GRANT",
  "DATA_CONSENT",
  "COMPLIANCE_IMPORT",
  "REFERENCE_SYNC",
  "DEVICE_IMPORT",
] as const satisfies readonly AuditStepCode[];

export const CHAT_PIPELINE_AUDIT_STEPS = [
  "TEXT2SQL_GEN",
  "DB_QUERY",
  "RULE_EVAL",
  "AGENT_DECISION",
  "LEDGER_COMMIT",
] as const satisfies readonly AuditStepCode[];

/** Steps missing from a chat audit trail (Task 301 / DoD auditable gate). */
export function missingChatPipelineSteps(auditDir: string, auditTrailId: string): AuditStepCode[] {
  const events = readAuditEvents({ auditDir, limit: 200 }).filter(
    (event) => event.audit_trail_id === auditTrailId,
  );
  const present = new Set(events.map((event) => event.step));
  return CHAT_PIPELINE_AUDIT_STEPS.filter((step) => !present.has(step));
}
