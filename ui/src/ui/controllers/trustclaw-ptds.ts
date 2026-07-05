import { resolveControlUiAuthCandidates } from "../control-ui-auth.ts";
import { normalizeBasePath } from "../navigation.ts";
import { normalizeOptionalString } from "../string-coerce.ts";

export type TrustclawAgentPackSummary = {
  id: string;
  version: string;
  displayName: { "zh-CN": string; en: string };
  domain?: string[];
  starterQuestions?: { "zh-CN": string; en: string }[];
  openclaw?: { agentId?: string; persona?: string };
  tools: { read: string; write?: string };
};

export type TrustclawPtdsAgentPackState = {
  basePath: string;
  sessionKey?: string | null;
  hello?: { auth?: { deviceToken?: string | null } | null } | null;
  settings?: { token?: string | null } | null;
  password?: string | null;
  ptdsAgentPacks: TrustclawAgentPackSummary[];
  ptdsAgentPacksLoading: boolean;
  ptdsAgentPacksError: string | null;
  ptdsSessionAgentPackId: string | null;
  ptdsSessionAgentPackSource: "session" | "lock" | "openclaw_agent" | "default" | "request" | null;
  ptdsSessionAgentPackLocked: boolean;
  ptdsSessionAgentPackMismatch: boolean;
  ptdsSessionAgentPackSaving: boolean;
  ptdsAgentPackSessionKey?: string | null;
};

async function fetchPtdsJson<T>(
  state: TrustclawPtdsAgentPackState,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const basePath = normalizeBasePath(state.basePath ?? "");
  const url = new URL(`${basePath}${path}`, window.location.origin);
  const authCandidates = resolveControlUiAuthCandidates(state);
  let lastError: Error | null = null;

  for (let index = 0; index < Math.max(authCandidates.length, 1); index += 1) {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    const auth = authCandidates[index];
    if (auth?.kind === "bearer") {
      headers.set("Authorization", `Bearer ${auth.token}`);
    } else if (auth?.kind === "password") {
      headers.set("X-OpenClaw-Password", auth.password);
    }
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...init,
      headers,
      credentials: "same-origin",
    });
    if (response.status === 401 || response.status === 403) {
      lastError = new Error(`HTTP ${response.status}`);
      continue;
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  throw lastError ?? new Error("PTDS request failed.");
}

export async function loadTrustclawAgentPacks(state: TrustclawPtdsAgentPackState): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  state.ptdsAgentPacksLoading = true;
  state.ptdsAgentPacksError = null;
  try {
    const body = await fetchPtdsJson<{
      status: string;
      packs: TrustclawAgentPackSummary[];
    }>(state, "/api/ptds/agent-packs");
    state.ptdsAgentPacks = body.packs ?? [];
  } catch (error) {
    state.ptdsAgentPacks = [];
    state.ptdsAgentPacksError = error instanceof Error ? error.message : String(error);
  } finally {
    state.ptdsAgentPacksLoading = false;
  }
}

export async function loadTrustclawSessionAgentPack(
  state: TrustclawPtdsAgentPackState,
): Promise<void> {
  const sessionId = normalizeOptionalString(state.sessionKey);
  if (!sessionId || typeof window === "undefined") {
    state.ptdsSessionAgentPackId = null;
    state.ptdsSessionAgentPackSource = null;
    return;
  }

  try {
    const params = new URLSearchParams({ session_id: sessionId });
    const body = await fetchPtdsJson<{
      status: string;
      agent_pack_id: string;
      resolved_from: TrustclawPtdsAgentPackState["ptdsSessionAgentPackSource"];
      locked?: boolean;
      agent_pack_mismatch?: boolean;
    }>(state, `/api/ptds/session/agent-pack?${params.toString()}`);
    state.ptdsSessionAgentPackId = body.agent_pack_id;
    state.ptdsSessionAgentPackSource = body.resolved_from;
    state.ptdsSessionAgentPackLocked = body.locked === true;
    state.ptdsSessionAgentPackMismatch = body.agent_pack_mismatch === true;
  } catch {
    state.ptdsSessionAgentPackId = null;
    state.ptdsSessionAgentPackSource = null;
    state.ptdsSessionAgentPackLocked = false;
    state.ptdsSessionAgentPackMismatch = false;
  }
}

/** Clear session pack binding + coordinator lock (e.g. after `/reset`). */
export async function clearTrustclawSessionAgentPack(
  state: TrustclawPtdsAgentPackState,
  sessionKey?: string | null,
): Promise<void> {
  const sessionId = normalizeOptionalString(sessionKey ?? state.sessionKey);
  if (!sessionId || typeof window === "undefined") {
    return;
  }

  try {
    const params = new URLSearchParams({ session_id: sessionId });
    await fetchPtdsJson<{ status: string; cleared?: boolean }>(
      state,
      `/api/ptds/session/agent-pack?${params.toString()}`,
      { method: "DELETE" },
    );
  } catch {
    // Best-effort: chat reset must not fail when PTDS is unavailable.
    return;
  }

  if (normalizeOptionalString(state.sessionKey) === sessionId) {
    state.ptdsSessionAgentPackLocked = false;
    state.ptdsSessionAgentPackMismatch = false;
    await loadTrustclawSessionAgentPack(state);
  }
}

export async function saveTrustclawSessionAgentPack(
  state: TrustclawPtdsAgentPackState,
  agentPackId: string,
): Promise<void> {
  const sessionId = normalizeOptionalString(state.sessionKey);
  if (!sessionId || typeof window === "undefined") {
    return;
  }

  state.ptdsSessionAgentPackSaving = true;
  try {
    const body = await fetchPtdsJson<{
      status: string;
      agent_pack_id: string;
      resolved_from: "session";
    }>(state, "/api/ptds/session/agent-pack", {
      method: "PUT",
      body: JSON.stringify({
        session_id: sessionId,
        agent_pack_id: agentPackId,
      }),
    });
    state.ptdsSessionAgentPackId = body.agent_pack_id;
    state.ptdsSessionAgentPackSource = "session";
    state.ptdsSessionAgentPackLocked = true;
    state.ptdsSessionAgentPackMismatch = false;
  } finally {
    state.ptdsSessionAgentPackSaving = false;
  }
}

export function ensureTrustclawPtdsAgentPackState(state: TrustclawPtdsAgentPackState): void {
  if (
    !state.ptdsAgentPacksLoading &&
    state.ptdsAgentPacks.length === 0 &&
    !state.ptdsAgentPacksError
  ) {
    void loadTrustclawAgentPacks(state);
  }
  const sessionId = normalizeOptionalString(state.sessionKey);
  if (sessionId && state.ptdsAgentPackSessionKey !== sessionId) {
    state.ptdsAgentPackSessionKey = sessionId;
    void loadTrustclawSessionAgentPack(state);
  }
}
