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

export type TrustclawTraAgentPackState = {
  basePath: string;
  sessionKey?: string | null;
  hello?: { auth?: { deviceToken?: string | null } | null } | null;
  settings?: { token?: string | null } | null;
  password?: string | null;
  traAgentPacks: TrustclawAgentPackSummary[];
  traAgentPacksLoading: boolean;
  traAgentPacksError: string | null;
  traSessionAgentPackId: string | null;
  traSessionAgentPackSource: "session" | "lock" | "openclaw_agent" | "default" | "request" | null;
  traSessionAgentPackLocked: boolean;
  traSessionAgentPackMismatch: boolean;
  traSessionAgentPackSaving: boolean;
  traAgentPackSessionKey?: string | null;
};

async function fetchTraJson<T>(
  state: TrustclawTraAgentPackState,
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

  throw lastError ?? new Error("TRA request failed.");
}

export async function loadTrustclawAgentPacks(state: TrustclawTraAgentPackState): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  state.traAgentPacksLoading = true;
  state.traAgentPacksError = null;
  try {
    const body = await fetchTraJson<{
      status: string;
      packs: TrustclawAgentPackSummary[];
    }>(state, "/api/tra/agent-packs");
    state.traAgentPacks = body.packs ?? [];
  } catch (error) {
    state.traAgentPacks = [];
    state.traAgentPacksError = error instanceof Error ? error.message : String(error);
  } finally {
    state.traAgentPacksLoading = false;
  }
}

export async function loadTrustclawSessionAgentPack(
  state: TrustclawTraAgentPackState,
): Promise<void> {
  const sessionId = normalizeOptionalString(state.sessionKey);
  if (!sessionId || typeof window === "undefined") {
    state.traSessionAgentPackId = null;
    state.traSessionAgentPackSource = null;
    return;
  }

  try {
    const params = new URLSearchParams({ session_id: sessionId });
    const body = await fetchTraJson<{
      status: string;
      agent_pack_id: string;
      resolved_from: TrustclawTraAgentPackState["traSessionAgentPackSource"];
      locked?: boolean;
      agent_pack_mismatch?: boolean;
    }>(state, `/api/tra/session/agent-pack?${params.toString()}`);
    state.traSessionAgentPackId = body.agent_pack_id;
    state.traSessionAgentPackSource = body.resolved_from;
    state.traSessionAgentPackLocked = body.locked === true;
    state.traSessionAgentPackMismatch = body.agent_pack_mismatch === true;
  } catch {
    state.traSessionAgentPackId = null;
    state.traSessionAgentPackSource = null;
    state.traSessionAgentPackLocked = false;
    state.traSessionAgentPackMismatch = false;
  }
}

/** Clear session pack binding + coordinator lock (e.g. after `/reset`). */
export async function clearTrustclawSessionAgentPack(
  state: TrustclawTraAgentPackState,
  sessionKey?: string | null,
): Promise<void> {
  const sessionId = normalizeOptionalString(sessionKey ?? state.sessionKey);
  if (!sessionId || typeof window === "undefined") {
    return;
  }

  try {
    const params = new URLSearchParams({ session_id: sessionId });
    await fetchTraJson<{ status: string; cleared?: boolean }>(
      state,
      `/api/tra/session/agent-pack?${params.toString()}`,
      { method: "DELETE" },
    );
  } catch {
    // Best-effort: chat reset must not fail when TRA is unavailable.
    return;
  }

  if (normalizeOptionalString(state.sessionKey) === sessionId) {
    state.traSessionAgentPackLocked = false;
    state.traSessionAgentPackMismatch = false;
    await loadTrustclawSessionAgentPack(state);
  }
}

export async function saveTrustclawSessionAgentPack(
  state: TrustclawTraAgentPackState,
  agentPackId: string,
): Promise<void> {
  const sessionId = normalizeOptionalString(state.sessionKey);
  if (!sessionId || typeof window === "undefined") {
    return;
  }

  state.traSessionAgentPackSaving = true;
  try {
    const body = await fetchTraJson<{
      status: string;
      agent_pack_id: string;
      resolved_from: "session";
    }>(state, "/api/tra/session/agent-pack", {
      method: "PUT",
      body: JSON.stringify({
        session_id: sessionId,
        agent_pack_id: agentPackId,
      }),
    });
    state.traSessionAgentPackId = body.agent_pack_id;
    state.traSessionAgentPackSource = "session";
    state.traSessionAgentPackLocked = true;
    state.traSessionAgentPackMismatch = false;
  } finally {
    state.traSessionAgentPackSaving = false;
  }
}

export function ensureTrustclawTraAgentPackState(state: TrustclawTraAgentPackState): void {
  if (
    !state.traAgentPacksLoading &&
    state.traAgentPacks.length === 0 &&
    !state.traAgentPacksError
  ) {
    void loadTrustclawAgentPacks(state);
  }
  const sessionId = normalizeOptionalString(state.sessionKey);
  if (sessionId && state.traAgentPackSessionKey !== sessionId) {
    state.traAgentPackSessionKey = sessionId;
    void loadTrustclawSessionAgentPack(state);
  }
}
