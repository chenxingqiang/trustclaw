import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { missingChatPipelineSteps, readAuditEvents } from "./read-events.js";

describe("readAuditEvents", () => {
  it("returns empty when audit file is missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-audit-read-"));
    expect(readAuditEvents({ auditDir: dir })).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads newest events first with step filter", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-audit-read-"));
    mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, "events.jsonl");
    writeFileSync(
      filePath,
      [
        JSON.stringify({
          event_id: "evt_1",
          audit_trail_id: "consent_aaa",
          step: "DATA_CONSENT",
          timestamp: 1,
          component: "PTDS.Consent",
          input: { session_id: "s1", user_query: "q1" },
          output: { granted: true, decision: "allow-once" },
          status: "SUCCESS",
        }),
        JSON.stringify({
          event_id: "evt_2",
          audit_trail_id: "consent_bbb",
          step: "COMPLIANCE_IMPORT",
          timestamp: 2,
          component: "PTDS.ComplianceImport",
          input: { session_id: "ui_1", standard_id: "nrdl_2025_v1.0.0" },
          output: { granted: true, rules_imported: 4 },
          status: "SUCCESS",
        }),
        JSON.stringify({
          event_id: "evt_3",
          audit_trail_id: "aud_ccc",
          step: "TEXT2SQL_GEN",
          timestamp: 3,
          component: "AgentRuntime.Text2SQL",
          input: { session_id: "s1" },
          output: { sql: "SELECT 1" },
          status: "SUCCESS",
        }),
      ].join("\n"),
      "utf8",
    );

    const events = readAuditEvents({
      auditDir: dir,
      steps: ["DATA_CONSENT", "COMPLIANCE_IMPORT"],
      limit: 10,
    });
    expect(events).toHaveLength(2);
    expect(events[0]?.step).toBe("DATA_CONSENT");
    expect(events[1]?.step).toBe("COMPLIANCE_IMPORT");

    rmSync(dir, { recursive: true, force: true });
  });

  it("reports missing chat pipeline steps for a trail", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-audit-missing-"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "events.jsonl"),
      [
        JSON.stringify({
          event_id: "evt_1",
          audit_trail_id: "aud_partial",
          step: "TEXT2SQL_GEN",
          timestamp: 1,
          component: "AgentRuntime.Text2SQL",
          input: {},
          output: {},
          status: "SUCCESS",
        }),
        JSON.stringify({
          event_id: "evt_2",
          audit_trail_id: "aud_partial",
          step: "DB_QUERY",
          timestamp: 2,
          component: "PTDS.Query",
          input: {},
          output: {},
          status: "SUCCESS",
        }),
      ].join("\n"),
      "utf8",
    );

    expect(missingChatPipelineSteps(dir, "aud_partial")).toEqual([
      "RULE_EVAL",
      "AGENT_DECISION",
      "LEDGER_COMMIT",
    ]);
    expect(missingChatPipelineSteps(dir, "aud_missing")).toEqual([
      "TEXT2SQL_GEN",
      "DB_QUERY",
      "RULE_EVAL",
      "AGENT_DECISION",
      "LEDGER_COMMIT",
    ]);

    rmSync(dir, { recursive: true, force: true });
  });
});
