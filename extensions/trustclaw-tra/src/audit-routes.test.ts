import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAgentPackRegistry } from "../../../trustclaw/runtime/agent-pack/index.js";
import { setAgentDomainGrant } from "../../../trustclaw/tra/agent-domain-grants.js";
import { deriveAgentDomainScopes } from "../../../trustclaw/tra/agent-domain-scopes.js";
import { createTraAuditEventsHandler } from "./audit-routes.js";

function mockRes(): {
  res: { statusCode: number; end: (chunk: string) => void };
  getBody: () => unknown;
} {
  const state = { statusCode: 200, body: "" };
  const res = {
    statusCode: 200,
    setHeader: () => {},
    end(chunk: string) {
      state.body = chunk;
    },
  };
  Object.defineProperty(res, "statusCode", {
    get: () => state.statusCode,
    set: (value: number) => {
      state.statusCode = value;
    },
  });
  return {
    res: res as never,
    getBody: () => JSON.parse(state.body),
  };
}

describe("audit routes agent scoping", () => {
  it("filters compliance and chat events by agentPackId", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-audit-scope-"));
    const auditDir = path.join(dir, "audit");
    const dbPath = path.join(dir, "db");
    const glp1 = getAgentPackRegistry().get("glp1-eligibility")!;
    const auditor = getAgentPackRegistry().get("compliance-auditor")!;
    setAgentDomainGrant(glp1.id, deriveAgentDomainScopes(glp1), { auditDir, dbPath });
    setAgentDomainGrant(auditor.id, deriveAgentDomainScopes(auditor), { auditDir, dbPath });

    writeFileSync(
      path.join(auditDir, "events.jsonl"),
      [
        JSON.stringify({
          event_id: "e1",
          audit_trail_id: "consent_a",
          step: "DATA_CONSENT",
          timestamp: 1,
          component: "TRA.Consent",
          input: { agent_pack_id: glp1.id, user_query: "q" },
          output: { granted: true },
          status: "SUCCESS",
        }),
        JSON.stringify({
          event_id: "e2",
          audit_trail_id: "consent_b",
          step: "COMPLIANCE_IMPORT",
          timestamp: 2,
          component: "TRA.ComplianceImport",
          input: { agent_pack_id: auditor.id, standard_id: "nrdl" },
          output: { rules_imported: 4 },
          status: "SUCCESS",
        }),
        JSON.stringify({
          event_id: "e3",
          audit_trail_id: "aud_chat",
          step: "LEDGER_COMMIT",
          timestamp: 3,
          component: "EvidenceLedger.Commit",
          input: { agent_pack_id: glp1.id, audit_trail_id: "aud_chat" },
          output: { proof_hash: "abc", block_height: 0 },
          status: "SUCCESS",
        }),
      ].join("\n"),
      "utf8",
    );

    const handler = createTraAuditEventsHandler({ auditDir, dbPath });
    const { res, getBody } = mockRes();
    await handler(
      { method: "GET", url: `/api/tra/audit/events?scope=all&agentPackId=${glp1.id}` } as never,
      res,
    );
    const body = getBody() as { events: Array<{ step: string }> };
    expect(body.events.map((event) => event.step)).toEqual(["DATA_CONSENT", "LEDGER_COMMIT"]);

    rmSync(dir, { recursive: true, force: true });
  });
});
