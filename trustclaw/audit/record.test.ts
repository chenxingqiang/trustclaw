import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AuditRecorder } from "./record.js";

describe("trustclaw/audit", () => {
  it("appends audit events to JSONL with required fields", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-audit-"));
    try {
      const recorder = new AuditRecorder({
        auditDir: dir,
        auditTrailId: "aud_test_trail",
        sessionId: "sess_audit",
      });

      recorder.record({
        step: "TEXT2SQL_GEN",
        component: "AgentRuntime.Text2SQL",
        input: { user_query: "test" },
        output: { sql: "SELECT 1" },
        status: "SUCCESS",
      });

      expect(recorder.events).toHaveLength(1);
      expect(recorder.events[0]?.component).toBe("AgentRuntime.Text2SQL");

      const lines = readFileSync(path.join(dir, "events.jsonl"), "utf8")
        .trim()
        .split("\n");
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0] ?? "{}") as { audit_trail_id: string; step: string };
      expect(parsed.audit_trail_id).toBe("aud_test_trail");
      expect(parsed.step).toBe("TEXT2SQL_GEN");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
