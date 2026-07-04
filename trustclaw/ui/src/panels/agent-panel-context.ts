/** Shared Panel B/D/E/F domain-agent context (decoupled from PTDS runtime). */

const STORAGE_KEY = "trustclaw.panelAgentPackId";
const DEFAULT_PACK_ID = "glp1-eligibility";

export function readPanelAgentPackId(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() || DEFAULT_PACK_ID;
  } catch {
    return DEFAULT_PACK_ID;
  }
}

export function writePanelAgentPackId(packId: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, packId.trim());
  } catch {
    // ignore private mode
  }
}

export function withAgentPackQuery(path: string, agentPackId?: string): string {
  const url = new URL(path, "http://local");
  url.searchParams.set("agentPackId", (agentPackId ?? readPanelAgentPackId()).trim());
  return url.pathname + url.search;
}

export function createGrantSessionId(): string {
  return `ui_grant_${crypto.randomUUID()}`;
}
