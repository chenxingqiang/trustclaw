// TrustClaw demo SPA — typed API client for the frozen plugin routes.
// Contracts are pinned to `trustclaw/PRODUCT_SPEC.md` and the handlers under
// `extensions/trustclaw-ptds/src/`. Do not add spec-external fields here; if
// the shape needs to change, update PRODUCT_SPEC.md + DECISIONS.md first.

/** Frozen `POST /api/ptds/init` request shape. */
export interface PtdsInitRequest {
  weight: number;
  height: number;
  hba1c: number;
  thyroid_cancer_history: 0 | 1;
  pancreatitis_history: 0 | 1;
  include_t2dm_diagnosis?: boolean;
  name?: string;
}

export interface PtdsInitResponse {
  status: "success" | "error";
  message: string;
  db_file?: string;
  records_inserted?: number;
}

export interface PtdsResetResponse {
  status: "success" | "error";
  message: string;
}

export interface PtdsStatusResponse {
  status: "success" | "error";
  mounted: boolean;
  db_file: string;
  snapshot: unknown;
}

export interface PtdsTablesResponse {
  status: "success" | "error";
  default_tables: string[];
  tables: string[];
}

export interface PtdsBrowseResponse {
  status: "success" | "error";
  table: string;
  columns?: string[];
  rows?: unknown[];
  message?: string;
}

export interface AgentChatRequest {
  session_id: string;
  message: string;
}

/** Mirrors `RuntimeContext` in `PRODUCT_SPEC.md`. */
export interface RuntimeContextResponse {
  session_id: string;
  user_query: string;
  pipeline_stages: {
    text2sql?: { sql?: string; duration_ms?: number };
    db_query?: { raw_data?: unknown };
    rule_evaluation?: { evaluated_rules?: unknown[] };
    agent_decision?: { response?: string; citations?: unknown[] };
  };
  audit_trail_id: string;
  evidence_ledger_receipt?: {
    block_height?: number;
    proof_hash?: string;
  };
}

export interface AgentChatErrorResponse {
  status: "error" | "security_blocked" | "ptds_not_initialized";
  message: string;
}

export type AgentChatResponse = RuntimeContextResponse | AgentChatErrorResponse;

export function isAgentChatError(r: AgentChatResponse): r is AgentChatErrorResponse {
  // Runtime Context responses have no top-level `status`; error envelopes always do.
  return typeof (r as AgentChatErrorResponse).status === "string";
}

/** Serialize query params without leaking undefined. */
export function buildBrowseUrl(base: string, table: string, limit?: number): string {
  const url = new URL("/api/ptds/browse", base);
  url.searchParams.set("table", table);
  if (typeof limit === "number" && Number.isFinite(limit)) {
    url.searchParams.set("limit", String(Math.trunc(limit)));
  }
  return url.pathname + url.search;
}

/** Resolve API base URL. Empty string uses same-origin relative paths (gateway or Vite `/api` proxy). */
export function resolveApiBaseUrl(
  _env: { VITE_GATEWAY_URL?: string } | undefined,
  _location: Pick<Location, "origin">,
): string {
  // PTDS HTTP routes are always on the page origin: bundled at `/trustclaw/` on the
  // gateway, or proxied through Vite dev (`/api` → gateway). Do not use VITE_GATEWAY_URL
  // here — a stale baked port (e.g. :18789) breaks init when dev gateway runs on :19001.
  return "";
}

/** Resolve Control UI origin for embedded chat iframes (gateway in dev, same-origin when bundled). */
export function resolveGatewayControlUiOrigin(
  env: { VITE_GATEWAY_URL?: string } | undefined,
  location: Pick<Location, "origin">,
): string {
  const override = env?.VITE_GATEWAY_URL?.trim();
  if (override) {
    return override.replace(/\/$/, "");
  }
  return location.origin;
}

/** Build Control UI chat route for iframe embeds. */
export function buildControlUiChatSrc(
  env: { VITE_GATEWAY_URL?: string } | undefined,
  location: Pick<Location, "origin">,
  basePath = "",
): string {
  const origin = resolveGatewayControlUiOrigin(env, location);
  const prefix = basePath ? `${basePath.replace(/\/$/, "")}/chat` : "/chat";
  return `${origin}${prefix.startsWith("/") ? prefix : `/${prefix}`}`;
}

/** Minimal fetch wrapper — keeps error surface uniform for panels. */
export async function callJson<TResponse>(
  fetchImpl: typeof fetch,
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}${path}` : path;
  const response = await fetchImpl(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    const hint =
      response.status === 404
        ? " — PTDS plugin route missing; run `pnpm trustclaw:setup` and restart gateway"
        : "";
    throw new Error(
      `Non-JSON response from ${path} (${response.status})${hint}: ${text.slice(0, 200)}`,
    );
  }
  return parsed as TResponse;
}

export interface TrustclawApiClient {
  init(body: PtdsInitRequest): Promise<PtdsInitResponse>;
  reset(): Promise<PtdsResetResponse>;
  status(): Promise<PtdsStatusResponse>;
  tables(): Promise<PtdsTablesResponse>;
  browse(table: string, limit?: number): Promise<PtdsBrowseResponse>;
  chat(body: AgentChatRequest): Promise<AgentChatResponse>;
}

export function createApiClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): TrustclawApiClient {
  return {
    init(body) {
      return callJson(fetchImpl, baseUrl, "/api/ptds/init", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    reset() {
      return callJson(fetchImpl, baseUrl, "/api/ptds/reset", { method: "POST" });
    },
    status() {
      return callJson(fetchImpl, baseUrl, "/api/ptds/status");
    },
    tables() {
      return callJson(fetchImpl, baseUrl, "/api/ptds/tables");
    },
    browse(table, limit) {
      // buildBrowseUrl needs any absolute base to construct URLSearchParams; only
      // the pathname+search is returned, so the origin is discarded downstream.
      return callJson(fetchImpl, baseUrl, buildBrowseUrl("http://x", table, limit));
    },
    chat(body) {
      return callJson(fetchImpl, baseUrl, "/api/agent/chat", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
  };
}
