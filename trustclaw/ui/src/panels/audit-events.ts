// Helpers for grouping PTDS audit JSONL rows into chat pipeline trails.

export type AuditEventRow = {
  event_id: string;
  audit_trail_id: string;
  step: string;
  timestamp: number;
  component: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: string;
};

export function pickLatestChatTrail(
  events: AuditEventRow[],
): { trailId: string; events: AuditEventRow[] } | null {
  if (events.length === 0) {
    return null;
  }
  const byTrail = new Map<string, AuditEventRow[]>();
  for (const event of events) {
    const bucket = byTrail.get(event.audit_trail_id) ?? [];
    bucket.push(event);
    byTrail.set(event.audit_trail_id, bucket);
  }
  let latest: { trailId: string; events: AuditEventRow[] } | null = null;
  for (const [trailId, trailEvents] of byTrail) {
    const lastTs = trailEvents.at(-1)?.timestamp ?? 0;
    const currentTs = latest?.events.at(-1)?.timestamp ?? 0;
    if (!latest || lastTs >= currentTs) {
      latest = { trailId, events: trailEvents };
    }
  }
  return latest;
}

export function readLedgerCommitFromTrail(events: AuditEventRow[]): {
  block_height?: number;
  proof_hash?: string;
  audit_trail_id: string;
} | null {
  const commit = [...events].reverse().find((event) => event.step === "LEDGER_COMMIT");
  if (!commit) {
    return null;
  }
  return ledgerReceiptFromEvent(commit);
}

export type LedgerReceiptRow = {
  block_height?: number;
  proof_hash?: string;
  previous_evidence_hash?: string | null;
  audit_trail_id: string;
  timestamp?: number;
};

function ledgerReceiptFromEvent(event: AuditEventRow): LedgerReceiptRow | null {
  if (event.step !== "LEDGER_COMMIT" || event.status !== "SUCCESS") {
    return null;
  }
  const proofHash = event.output.proof_hash;
  if (typeof proofHash !== "string" || proofHash.length === 0) {
    return null;
  }
  return {
    block_height:
      typeof event.output.block_height === "number" ? event.output.block_height : undefined,
    proof_hash: proofHash,
    previous_evidence_hash:
      typeof event.output.previous_evidence_hash === "string"
        ? event.output.previous_evidence_hash
        : event.output.previous_evidence_hash === null
          ? null
          : undefined,
    audit_trail_id: event.audit_trail_id,
    timestamp: event.timestamp,
  };
}

/** Collect ledger receipts from a chat audit batch (newest API window). */
export function collectLedgerReceipts(events: AuditEventRow[]): LedgerReceiptRow[] {
  const byTrail = new Map<string, LedgerReceiptRow>();
  for (const event of events) {
    const receipt = ledgerReceiptFromEvent(event);
    if (!receipt) {
      continue;
    }
    const existing = byTrail.get(receipt.audit_trail_id);
    if (!existing || (receipt.timestamp ?? 0) >= (existing.timestamp ?? 0)) {
      byTrail.set(receipt.audit_trail_id, receipt);
    }
  }
  return [...byTrail.values()].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

/** One-line compliance timeline headline for Panel D. */
export function summarizeComplianceEvent(event: AuditEventRow): string {
  switch (event.step) {
    case "DATA_CONSENT": {
      const granted = event.output.granted === true;
      const decision =
        typeof event.output.decision === "string" ? event.output.decision : "unknown";
      return granted ? `Consent granted (${decision})` : `Consent denied (${decision})`;
    }
    case "COMPLIANCE_IMPORT": {
      const standardId =
        typeof event.input.standard_id === "string" ? event.input.standard_id : "standard";
      const rules =
        typeof event.output.rules_imported === "number" ? event.output.rules_imported : 0;
      return `Imported ${rules} rules · ${standardId}`;
    }
    case "REFERENCE_SYNC": {
      const packageId =
        typeof event.input.package_id === "string" ? event.input.package_id : "reference";
      return `Reference sync · ${packageId}`;
    }
    case "AGENT_DOMAIN_GRANT": {
      const packId =
        typeof event.input.agent_pack_id === "string" ? event.input.agent_pack_id : "agent";
      const scopes = Array.isArray(event.input.scopes)
        ? event.input.scopes.filter((scope): scope is string => typeof scope === "string")
        : [];
      const granted = event.output.granted === true;
      const scopeList = scopes.length > 0 ? scopes.join(", ") : "none";
      return granted ? `Granted [${scopeList}] · ${packId}` : `Revoked all scopes · ${packId}`;
    }
    case "DEVICE_IMPORT": {
      const rows =
        typeof event.output.rows_affected === "number" ? event.output.rows_affected : undefined;
      return rows !== undefined ? `Device import · ${rows} rows` : "Device import";
    }
    default:
      return event.step;
  }
}
