import { computeEvidenceProofHash } from "./hash.js";
import { appendEvidenceReceipt, readEvidenceChainHead } from "./store.js";
import type { CommitEvidenceReceiptInput, EvidenceReceipt } from "./types.js";

export function commitEvidenceReceipt(input: CommitEvidenceReceiptInput): EvidenceReceipt {
  const head = readEvidenceChainHead(input.evidenceDir);
  const previous_evidence_hash = head?.proof_hash ?? null;
  const block_height = head ? head.block_height + 1 : 0;
  const proof_hash = computeEvidenceProofHash({
    previous_evidence_hash,
    content_hash: input.content_hash,
    audit_trail_id: input.audit_trail_id,
    session_id: input.session_id,
    agent_pack_id: input.agent_pack_id,
  });
  const receipt: EvidenceReceipt = {
    block_height,
    content_hash: input.content_hash,
    previous_evidence_hash,
    proof_hash,
    audit_trail_id: input.audit_trail_id,
    session_id: input.session_id,
    agent_pack_id: input.agent_pack_id,
    committed_at: Math.floor(Date.now() / 1000),
  };
  appendEvidenceReceipt(input.evidenceDir, receipt);
  return receipt;
}
