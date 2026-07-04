import type { AuditEvent } from "./types.js";

export function readAgentPackIdFromAuditInput(input: Record<string, unknown>): string | null {
  const raw = input.agent_pack_id;
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Panel D/E audit rows belong to exactly one domain agent when input carries agent_pack_id. */
export function auditEventMatchesAgentPack(
  event: Pick<AuditEvent, "input">,
  agentPackId: string,
): boolean {
  const eventPackId = readAgentPackIdFromAuditInput(event.input);
  if (!eventPackId) {
    return false;
  }
  return eventPackId === agentPackId.trim();
}
