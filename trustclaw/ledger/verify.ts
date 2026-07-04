import { computeEvidenceProofHash } from "./hash.js";
import type { EvidenceChainVerifyResult, EvidenceReceipt } from "./types.js";

export function verifyEvidenceChain(receipts: EvidenceReceipt[]): EvidenceChainVerifyResult {
  let expectedPrevious: string | null = null;
  for (const receipt of receipts) {
    if (receipt.block_height < 0) {
      return { ok: false, block_height: receipt.block_height, reason: "negative block_height" };
    }
    if (receipt.previous_evidence_hash !== expectedPrevious) {
      return {
        ok: false,
        block_height: receipt.block_height,
        reason: "previous_evidence_hash mismatch",
      };
    }
    const expectedProof = computeEvidenceProofHash({
      previous_evidence_hash: receipt.previous_evidence_hash,
      content_hash: receipt.content_hash,
      audit_trail_id: receipt.audit_trail_id,
      session_id: receipt.session_id,
      agent_pack_id: receipt.agent_pack_id,
    });
    if (receipt.proof_hash !== expectedProof) {
      return { ok: false, block_height: receipt.block_height, reason: "proof_hash mismatch" };
    }
    expectedPrevious = receipt.proof_hash;
  }
  return { ok: true };
}
