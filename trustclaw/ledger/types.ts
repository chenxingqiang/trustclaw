export type EvidenceReceipt = {
  block_height: number;
  content_hash: string;
  previous_evidence_hash: string | null;
  proof_hash: string;
  audit_trail_id: string;
  session_id: string;
  agent_pack_id: string;
  committed_at: number;
};

export type EvidenceChainVerifyResult =
  | { ok: true }
  | { ok: false; block_height: number; reason: string };

export type CommitEvidenceReceiptInput = {
  evidenceDir: string;
  audit_trail_id: string;
  session_id: string;
  agent_pack_id: string;
  content_hash: string;
};
