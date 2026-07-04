import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearAuditEvents,
  missingChatPipelineSteps,
  readAuditEvents,
} from "../../../trustclaw/audit/index.js";
import {
  clearEvidenceLedger,
  readEvidenceReceipts,
  verifyEvidenceChain,
} from "../../../trustclaw/ledger/index.js";
import { setAgentDomainGrant } from "../../../trustclaw/ptds/agent-domain-grants.js";
import { deriveAgentDomainScopes } from "../../../trustclaw/ptds/agent-domain-scopes.js";
import { initializePtds, resetPtds } from "../../../trustclaw/ptds/init.js";
import { PTDS_INIT_DEFAULTS } from "../../../trustclaw/ptds/types.js";
import { getAgentPackRegistry } from "../../../trustclaw/runtime/agent-pack/index.js";
import { runTrustclawChat } from "../../../trustclaw/runtime/pipeline/run-chat.js";

const INIT_BODY = {
  ...PTDS_INIT_DEFAULTS,
  weight: 85,
  height: 170,
  hba1c: 6.8,
  hasType2Diabetes: true,
};

const CHAT_LLM = async () =>
  "SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = 'local_user' LIMIT 1";

/** Task 503 / dod_reset_demo — two full demo passes without manual file deletion. */
describe("dod_reset_demo (Task 503)", () => {
  it("runs init → chat chain → reset → re-init → chat with fresh ledger", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-dod-reset-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "ptds-audit");
    const evidenceDir = path.join(dir, "ptds-evidence");
    const chatOpts = { dbPath, auditDir, evidenceDir, llm: CHAT_LLM };
    const glp1Pack = getAgentPackRegistry().get("glp1-eligibility")!;
    setAgentDomainGrant(glp1Pack.id, deriveAgentDomainScopes(glp1Pack), {
      dbPath,
      auditDir,
    });

    try {
      expect(initializePtds(INIT_BODY, { dbPath }).status).toBe("success");

      const pass1a = await runTrustclawChat(
        { session_id: "sess_dod_1", message: "我可以用司美格鲁肽吗？", agent_pack_id: glp1Pack.id },
        chatOpts,
      );
      const pass1b = await runTrustclawChat(
        { session_id: "sess_dod_1", message: "我的BMI是多少？", agent_pack_id: glp1Pack.id },
        chatOpts,
      );
      expect(pass1a.ok && pass1b.ok).toBe(true);
      if (!pass1a.ok || !pass1b.ok) {
        return;
      }
      expect(missingChatPipelineSteps(auditDir, pass1a.context.audit_trail_id)).toEqual([]);
      expect(missingChatPipelineSteps(auditDir, pass1b.context.audit_trail_id)).toEqual([]);
      expect(pass1a.context.evidence_ledger_receipt?.block_height).toBe(0);
      expect(pass1b.context.evidence_ledger_receipt?.block_height).toBe(1);
      expect(verifyEvidenceChain(readEvidenceReceipts(evidenceDir))).toEqual({ ok: true });

      const decisionAudit = readAuditEvents({ auditDir, steps: ["AGENT_DECISION"] });
      expect(decisionAudit.length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(decisionAudit[0]?.output.citations)).toBe(true);

      expect(resetPtds({ dbPath }).status).toBe("success");
      clearAuditEvents(auditDir);
      clearEvidenceLedger(evidenceDir);

      expect(readEvidenceReceipts(evidenceDir)).toHaveLength(0);
      const auditAfterReset = readFileSync(path.join(auditDir, "events.jsonl"), "utf8").trim();
      expect(auditAfterReset).toBe("");

      const blocked = await runTrustclawChat(
        { session_id: "sess_dod_2", message: "hello after reset" },
        chatOpts,
      );
      expect(blocked.ok).toBe(false);

      expect(initializePtds(INIT_BODY, { dbPath }).status).toBe("success");
      setAgentDomainGrant(glp1Pack.id, deriveAgentDomainScopes(glp1Pack), {
        dbPath,
        auditDir,
      });

      const pass2 = await runTrustclawChat(
        { session_id: "sess_dod_2", message: "我可以用司美格鲁肽吗？", agent_pack_id: glp1Pack.id },
        chatOpts,
      );
      expect(pass2.ok).toBe(true);
      if (!pass2.ok) {
        return;
      }
      expect(missingChatPipelineSteps(auditDir, pass2.context.audit_trail_id)).toEqual([]);
      expect(pass2.context.evidence_ledger_receipt?.block_height).toBe(0);
      expect(pass2.context.evidence_ledger_receipt?.previous_evidence_hash).toBeNull();
      expect(verifyEvidenceChain(readEvidenceReceipts(evidenceDir))).toEqual({ ok: true });
      expect(existsSync(path.join(evidenceDir, "ledger.jsonl"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
