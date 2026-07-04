import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type {
  AuditComponent,
  AuditEvent,
  AuditEventStatus,
  AuditRecorderOptions,
  AuditStepCode,
} from "./types.js";

function createEventId(): string {
  return `evt_${randomBytes(8).toString("hex")}`;
}

export class AuditRecorder {
  readonly auditTrailId: string;
  private readonly auditFilePath: string;
  private readonly sessionId: string;
  readonly events: AuditEvent[] = [];

  constructor(options: AuditRecorderOptions) {
    this.auditTrailId = options.auditTrailId;
    this.sessionId = options.sessionId;
    mkdirSync(options.auditDir, { recursive: true });
    this.auditFilePath = path.join(options.auditDir, "events.jsonl");
  }

  record(params: {
    step: AuditStepCode;
    component: AuditComponent;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    status: AuditEventStatus;
  }): AuditEvent {
    const event: AuditEvent = {
      event_id: createEventId(),
      audit_trail_id: this.auditTrailId,
      step: params.step,
      timestamp: Math.floor(Date.now() / 1000),
      component: params.component,
      input: { session_id: this.sessionId, ...params.input },
      output: params.output,
      status: params.status,
    };
    this.events.push(event);
    appendFileSync(this.auditFilePath, `${JSON.stringify(event)}\n`, "utf8");
    return event;
  }
}
