import { createHash } from "node:crypto";

export function hashEvidenceContent(context: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
}

export function computeEvidenceProofHash(params: {
  previous_evidence_hash: string | null;
  content_hash: string;
  audit_trail_id: string;
  session_id: string;
  agent_pack_id: string;
}): string {
  const payload = JSON.stringify({
    previous_evidence_hash: params.previous_evidence_hash,
    content_hash: params.content_hash,
    audit_trail_id: params.audit_trail_id,
    session_id: params.session_id,
    agent_pack_id: params.agent_pack_id,
  });
  return createHash("sha256").update(payload).digest("hex");
}
