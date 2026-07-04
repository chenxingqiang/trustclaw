import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clearAuditEvents } from "../../../trustclaw/audit/index.js";
import {
  clearEvidenceLedger,
  commitEvidenceReceipt,
  readEvidenceReceipts,
  verifyEvidenceChain,
} from "../../../trustclaw/ledger/index.js";
import { initializePtds, resetPtds } from "../../../trustclaw/ptds/init.js";
import { PTDS_INIT_DEFAULTS } from "../../../trustclaw/ptds/types.js";
import { runTrustclawChat } from "../../../trustclaw/runtime/pipeline/run-chat.js";

describe("trustclaw evidence ledger (Task 401)", () => {
  it("commits verifiable SHA-256 chain receipts", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-ledger-ext-"));
    try {
      const first = commitEvidenceReceipt({
        evidenceDir: dir,
        audit_trail_id: "aud_a",
        session_id: "sess",
        agent_pack_id: "glp1-eligibility",
        content_hash: "a".repeat(64),
      });
      const second = commitEvidenceReceipt({
        evidenceDir: dir,
        audit_trail_id: "aud_b",
        session_id: "sess",
        agent_pack_id: "glp1-eligibility",
        content_hash: "b".repeat(64),
      });
      expect(second.previous_evidence_hash).toBe(first.proof_hash);
      expect(verifyEvidenceChain(readEvidenceReceipts(dir))).toEqual({ ok: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("links consecutive chat runs through the pipeline", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-ledger-chat-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const evidenceDir = path.join(dir, "ptds-evidence");
    try {
      initializePtds(
        { ...PTDS_INIT_DEFAULTS, weight: 85, height: 170, hba1c: 6.8, hasType2Diabetes: true },
        { dbPath },
      );
      const opts = {
        dbPath,
        auditDir: path.join(dir, "ptds-audit"),
        evidenceDir,
        llm: async () =>
          "SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = 'local_user' LIMIT 1",
      };
      const first = await runTrustclawChat({ session_id: "s1", message: "BMI?" }, opts);
      const second = await runTrustclawChat({ session_id: "s1", message: "GLP-1?" }, opts);
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) {
        return;
      }
      expect(second.context.evidence_ledger_receipt?.block_height).toBe(1);
      expect(second.context.evidence_ledger_receipt?.previous_evidence_hash).toBe(
        first.context.evidence_ledger_receipt?.proof_hash,
      );
      expect(verifyEvidenceChain(readEvidenceReceipts(evidenceDir))).toEqual({ ok: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("clears audit and ledger on PTDS reset path helpers", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-ledger-reset-"));
    const auditDir = path.join(dir, "ptds-audit");
    const evidenceDir = path.join(dir, "ptds-evidence");
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      initializePtds({ ...PTDS_INIT_DEFAULTS, weight: 80, height: 170, hba1c: 6.5 }, { dbPath });
      commitEvidenceReceipt({
        evidenceDir,
        audit_trail_id: "aud_reset",
        session_id: "sess",
        agent_pack_id: "glp1-eligibility",
        content_hash: "c".repeat(64),
      });
      clearAuditEvents(auditDir);
      clearEvidenceLedger(evidenceDir);
      resetPtds({ dbPath });
      expect(readEvidenceReceipts(evidenceDir)).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
