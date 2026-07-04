import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { commitEvidenceReceipt, readEvidenceReceipts, verifyEvidenceChain } from "./index.js";

describe("trustclaw/ledger", () => {
  it("commits genesis and linked receipts with verifiable chain", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-ledger-"));
    try {
      const first = commitEvidenceReceipt({
        evidenceDir: dir,
        audit_trail_id: "aud_first",
        session_id: "sess_1",
        agent_pack_id: "glp1-eligibility",
        content_hash: "a".repeat(64),
      });
      const second = commitEvidenceReceipt({
        evidenceDir: dir,
        audit_trail_id: "aud_second",
        session_id: "sess_1",
        agent_pack_id: "glp1-eligibility",
        content_hash: "b".repeat(64),
      });

      expect(first.block_height).toBe(0);
      expect(first.previous_evidence_hash).toBeNull();
      expect(second.block_height).toBe(1);
      expect(second.previous_evidence_hash).toBe(first.proof_hash);

      const stored = readEvidenceReceipts(dir);
      expect(stored).toHaveLength(2);
      expect(verifyEvidenceChain(stored)).toEqual({ ok: true });

      const lines = readFileSync(path.join(dir, "ledger.jsonl"), "utf8").trim().split("\n");
      expect(lines).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects tampered proof_hash", () => {
    const receipts = [
      {
        block_height: 0,
        content_hash: "c".repeat(64),
        previous_evidence_hash: null,
        proof_hash: "deadbeef",
        audit_trail_id: "aud_x",
        session_id: "sess_x",
        agent_pack_id: "glp1-eligibility",
        committed_at: 1,
      },
    ];
    expect(verifyEvidenceChain(receipts).ok).toBe(false);
  });
});
