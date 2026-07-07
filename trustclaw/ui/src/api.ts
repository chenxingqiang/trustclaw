// TrustClaw TRA Runtime Console — typed API client for plugin routes.
// Contracts follow handlers under `extensions/trustclaw-tra/src/` and
// colocated types here. If the shape changes, update handlers + DECISIONS.md first.

/** Frozen `POST /api/tra/init` request shape. */
export interface TraInitRequest {
  patientName?: string;
  gender: "男" | "女";
  age: number;
  weight: number;
  height: number;
  bmi?: number;
  hba1c: number;
  isPregnantOrLactating: boolean;
  hasType2Diabetes: boolean;
  thyroidHistory: boolean;
  pancreatitisHistory: boolean;
  cardiovascularRisk: boolean;
  gastrointestinalSensitivity: boolean;
  hasArteriosclerosis: boolean;
  hasCoronaryHeartDisease: boolean;
  hasMyocardialInfarction: boolean;
  hasStroke: boolean;
  usedMetforminBadControl: boolean;
  usedSulfonylureaBadControl: boolean;
  usedInsulinBadControl: boolean;
  /** AST prescription_context.is_first_prescription (default: true). */
  isFirstPrescription?: boolean;
  /** AST prescription_context.institution_level 1–3 (default: 3). */
  institutionLevel?: number;
  /** AST prescription_context.is_specialist_physician (default: true). */
  isSpecialistPhysician?: boolean;
}

export const TRA_INIT_FORM_DEFAULTS: Required<
  Pick<TraInitRequest, "patientName" | "gender" | "age">
> &
  Omit<TraInitRequest, "patientName" | "gender" | "age" | "bmi"> = {
  patientName: "张三",
  gender: "男",
  age: 45,
  weight: 82,
  height: 170,
  hba1c: 6.8,
  isPregnantOrLactating: false,
  hasType2Diabetes: true,
  thyroidHistory: false,
  pancreatitisHistory: false,
  cardiovascularRisk: false,
  gastrointestinalSensitivity: false,
  hasArteriosclerosis: false,
  hasCoronaryHeartDisease: false,
  hasMyocardialInfarction: false,
  hasStroke: false,
  usedMetforminBadControl: false,
  usedSulfonylureaBadControl: false,
  usedInsulinBadControl: false,
  isFirstPrescription: true,
  institutionLevel: 3,
  isSpecialistPhysician: true,
};

export function computeTraBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export interface TraInitResponse {
  status: "success" | "error";
  message: string;
  db_file?: string;
  records_inserted?: number;
}

export interface TraResetResponse {
  status: "success" | "error";
  message: string;
}

export interface TraStatusResponse {
  status: "success" | "error";
  mounted: boolean;
  db_file: string;
  snapshot: unknown;
}

export type TraTableKind = "personal" | "subscribed" | "reference" | "provenance" | "view";

export interface TraTableCatalogRow {
  table: string;
  kind: TraTableKind;
  subscription_type?: "pharma-compliance" | "nrdl-reference" | "device-data";
  label_en: string;
  label_zh: string;
}

export interface TraLineageNode {
  id: string;
  role: "table" | "source" | "subscription" | "panel" | "engine";
  label: string;
  meta?: Record<string, string | number | null>;
}

export interface TraLineageEdge {
  from: string;
  to: string;
  label?: string;
}

export interface TraTableLineage {
  table: string;
  kind: TraTableKind;
  subscription_type?: "pharma-compliance" | "nrdl-reference" | "device-data";
  provenance_fields: string[];
  nodes: TraLineageNode[];
  edges: TraLineageEdge[];
  live?: {
    active_standard_id?: string | null;
    ruleset_hash?: string | null;
    consent_session_id?: string | null;
    reference_version_id?: string | null;
    reference_package_hash?: string | null;
    subscription_url?: string | null;
    source_ids?: Array<{
      source_id: string;
      source_name: string;
      source_category: string;
      reliability_level: number;
      row_count: number;
    }>;
  };
}

export interface TraTablesResponse {
  status: "success" | "error";
  default_tables: string[];
  tables: string[];
  catalog?: TraTableCatalogRow[];
  personal_tables?: string[];
  subscribed_tables?: string[];
}

export interface TraBrowseSubscriptionsResponse {
  status: "success" | "error";
  agent_pack_id?: string;
  pharma: {
    active: boolean;
    standard_id?: string;
    publisher?: string;
    ruleset_hash?: string;
  };
  nrdl: {
    synced: boolean;
    version_id?: string;
    package_hash?: string;
    drug_count: number;
    rule_count: number;
  };
  quick_tables?: Array<{
    table: string;
    kind: string;
    subscription_type?: TraTableLineage["subscription_type"];
    label_en: string;
    label_zh: string;
  }>;
  message?: string;
}

export interface TraBrowseResponse {
  status: "success" | "error";
  table: string;
  columns?: string[];
  rows?: unknown[];
  lineage?: TraTableLineage;
  message?: string;
}

export interface AgentChatRequest {
  session_id: string;
  message: string;
}

/** Mirrors `RuntimeContext` from `trustclaw/runtime/pipeline/types.ts`. */
export interface RuntimeContextResponse {
  session_id: string;
  user_query: string;
  agent_pack_id?: string;
  declared_pipeline_steps?: string[];
  agent_pack_source?: "session" | "lock" | "openclaw_agent" | "default" | "request";
  agent_pack_locked?: boolean;
  agent_pack_mismatch?: boolean;
  openclaw_suggested_pack_id?: string | null;
  pipeline_stages: {
    text2sql?: { sql?: string; duration_ms?: number };
    db_query?: { raw_data?: unknown };
    rule_evaluation?: { evaluated_rules?: unknown[] };
    agent_decision?: {
      response?: string;
      citations?: Array<{
        index: number;
        label: string;
        value: string | number | null;
        rule_id: string;
        source: string;
      }>;
    };
  };
  audit_trail_id: string;
  evidence_ledger_receipt?: {
    block_height?: number;
    proof_hash?: string;
    previous_evidence_hash?: string | null;
  };
}

export interface AgentChatErrorResponse {
  status: "error" | "security_blocked" | "tra_not_initialized";
  message: string;
}

export type AgentChatResponse = RuntimeContextResponse | AgentChatErrorResponse;

export interface CompliancePreviewResult {
  status: "success" | "error";
  message: string;
  metadata?: {
    version_id: string;
    release_date: string;
    publisher: string;
    publisher_signature?: string;
    ruleset_hash: string;
  };
  rule_count?: number;
  drug_ids?: string[];
  source_file_hash?: string;
}

export interface ComplianceImportResult {
  status: "success" | "error";
  message: string;
  standard_id?: string;
  rules_imported?: number;
  drugs_registered?: number;
  source_file_hash?: string;
}

export interface MedicationComplianceStandardRow {
  standard_id: string;
  schema_uri: string | null;
  release_date: string;
  publisher: string;
  publisher_signature: string | null;
  ruleset_hash: string;
  source_file_hash: string;
  source_label: string | null;
  imported_at: string;
  consent_session_id: string;
  is_active: number;
}

export interface ComplianceStandardsResponse {
  status: "success" | "error";
  standards?: MedicationComplianceStandardRow[];
  message?: string;
}

export interface AuditEventRow {
  event_id: string;
  audit_trail_id: string;
  step: string;
  timestamp: number;
  component: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: string;
}

export interface AuditEventsResponse {
  status: "success" | "error";
  scope?: string;
  audit_dir?: string;
  events?: AuditEventRow[];
  message?: string;
}

export interface LedgerReceiptApiRow {
  block_height: number;
  content_hash: string;
  previous_evidence_hash: string | null;
  proof_hash: string;
  audit_trail_id: string;
  session_id: string;
  agent_pack_id: string;
  committed_at: number;
}

export interface LedgerStatusResponse {
  status: "success" | "error";
  evidence_dir?: string;
  receipt_count?: number;
  receipts?: LedgerReceiptApiRow[];
  verify?: { ok: true } | { ok: false; block_height: number; reason: string };
  message?: string;
}

export interface ReferencePreviewResult {
  status: "success" | "error";
  message: string;
  metadata?: {
    version_id: string;
    release_date: string;
    publisher: string;
    package_hash: string;
  };
  drug_count?: number;
  rule_count?: number;
  drug_ids?: string[];
  package_hash?: string;
  changed_from_local?: boolean;
}

export interface ReferenceSyncResult {
  status: "success" | "error";
  message: string;
  version_id?: string;
  drugs_synced?: number;
  rules_synced?: number;
  package_hash?: string;
  subscription_url?: string | null;
  skipped_unchanged?: boolean;
}

export interface ReferenceSyncStateRow {
  sync_id: string;
  version_id: string;
  package_hash: string;
  source_label: string | null;
  subscription_url: string | null;
  consent_session_id: string;
  drug_count: number;
  rule_count: number;
  synced_at: string;
}

export interface ReferenceStatusResponse {
  status: "success" | "error";
  message?: string;
  local_drug_count?: number;
  local_rule_count?: number;
  last_sync?: ReferenceSyncStateRow | null;
}

export interface DeviceImportPreviewResult {
  status: "success" | "error";
  message: string;
  sql_statements?: string[];
  sql_hash?: string;
  statement_count?: number;
  tables?: string[];
  duration_ms?: number;
  payload_bytes?: number;
}

export interface DeviceImportResult {
  status: "success" | "error";
  message: string;
  rows_affected?: number;
  tables?: string[];
  statement_count?: number;
  sql_hash?: string;
}

export interface DeviceImportPreviewRequestBody {
  package?: unknown;
  url?: string;
  deviceHint?: string;
}

export interface DeviceImportExecuteRequestBody {
  consentGranted: boolean;
  sessionId: string;
  sourceLabel?: string;
  package?: unknown;
  url?: string;
  deviceHint?: string;
  sql_statements: string[];
  sql_hash: string;
}

export interface ReferenceSyncRequestBody {
  consentGranted: boolean;
  sessionId: string;
  sourceLabel?: string;
  package?: unknown;
  url?: string;
  saveSubscriptionUrl?: boolean;
}

export interface ReferenceBundledSyncRequestBody {
  consentGranted: boolean;
  sessionId: string;
}

export interface ComplianceImportRequestBody {
  consentGranted: boolean;
  sessionId: string;
  sourceLabel?: string;
  package: unknown;
}

export interface ComplianceBundledImportRequestBody {
  consentGranted: boolean;
  sessionId: string;
}

export function isAgentChatError(r: AgentChatResponse): r is AgentChatErrorResponse {
  // Runtime Context responses have no top-level `status`; error envelopes always do.
  return typeof (r as AgentChatErrorResponse).status === "string";
}

/** Serialize browse URL with domain-agent authorization. */
export function buildBrowseUrl(
  base: string,
  table: string,
  limit?: number,
  agentPackId?: string,
): string {
  const url = new URL("/api/tra/browse", base);
  url.searchParams.set("table", table);
  if (agentPackId?.trim()) {
    url.searchParams.set("agentPackId", agentPackId.trim());
  }
  if (typeof limit === "number" && Number.isFinite(limit)) {
    url.searchParams.set("limit", String(Math.trunc(limit)));
  }
  return url.pathname + url.search;
}

export type AgentDomainScopeId =
  | "panel.browse"
  | "panel.audit"
  | "panel.ledger"
  | "panel.compliance"
  | "tra.chat"
  | "tra.write";

export interface AgentGrantPackRow {
  id: string;
  version: string;
  displayName: { "zh-CN": string; en: string };
  domain?: string[];
  pipeline: { stages: string[] };
  available_scopes: AgentDomainScopeId[];
  granted_scopes: AgentDomainScopeId[];
  granted_at: number | null;
}

export interface AgentGrantHistoryEntry {
  event_id: string;
  audit_trail_id: string;
  timestamp: number;
  agent_pack_id: string;
  scopes: string[];
  granted: boolean;
  status: string;
}

export interface AgentGrantsResponse {
  status: "success" | "error";
  packs: AgentGrantPackRow[];
  grants: Record<string, { granted_at: number; scopes: AgentDomainScopeId[] }>;
  history?: AgentGrantHistoryEntry[];
  message?: string;
}

export interface DomainAgentRow {
  agent_id: string;
  agent_name: string;
  domain: string;
  subdomain: string | null;
  region: string | null;
  insurance_type: string | null;
  enabled: string;
  tra_scopes: string | null;
  tra_write: number | null;
  pack_id: string | null;
  pack_version: string | null;
  registered_at: string | null;
}

export interface DomainAgentsResponse {
  status: "success" | "error";
  available: boolean;
  agents: DomainAgentRow[];
  summary: {
    total: number;
    by_enabled: Record<string, number>;
    by_pack: Record<string, number>;
  };
  message?: string;
}

export type DomainAgentsQuery = {
  pack_id?: string;
  enabled?: string;
  domain?: string;
};

export interface DomainAgentsImportResponse {
  status: "success" | "error" | "skipped";
  message: string;
  imported_count?: number;
  total_count?: number;
}

export interface DomainAgentsBundledRegistryImportRequest {
  force?: boolean;
}

export interface AgentPackSummaryRow {
  id: string;
  version: string;
  displayName: { "zh-CN": string; en: string };
  domain?: string[];
  tools: { read: string; write?: string };
  pipeline: { stages: string[] };
}

export interface AgentPacksListResponse {
  status: "success" | "error";
  default_pack_id?: string;
  packs?: AgentPackSummaryRow[];
  extension_points?: Record<string, string[]>;
  schema_ref?: string;
  message?: string;
}

export type AgentPackDetailManifest = Record<string, unknown>;

export interface AgentPackDetailResponse {
  status: "success" | "error";
  pack?: AgentPackDetailManifest;
  message?: string;
}

export interface AgentPackValidationIssue {
  path: string;
  message: string;
}

export type AgentPackValidateResult =
  | { ok: true; pack: AgentPackDetailManifest; schema_ref?: string }
  | { ok: false; issues: AgentPackValidationIssue[]; message?: string };

export interface AgentPackPutResponse {
  status: "success" | "error";
  pack?: AgentPackDetailManifest;
  code?: string;
  message?: string;
}

export interface AgentPackCreateResponse {
  status: "success" | "error";
  pack?: AgentPackDetailManifest;
  code?: string;
  message?: string;
}

export interface AgentPackDeleteResponse {
  status: "success" | "error";
  deleted_pack_id?: string;
  code?: string;
  message?: string;
}

async function postJsonBody<TBody>(
  fetchImpl: typeof fetch,
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<{ status: number; body: TBody }> {
  const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}${path}` : path;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: TBody;
  try {
    parsed = (text.length > 0 ? JSON.parse(text) : null) as TBody;
  } catch {
    throw new Error(`Non-JSON response from ${path} (${response.status}): ${text.slice(0, 200)}`);
  }
  return { status: response.status, body: parsed };
}

/** Serialize domain-agents registry URL with optional filters. */
export function buildDomainAgentsUrl(base: string, query?: DomainAgentsQuery): string {
  const url = new URL("/api/tra/domain-agents", base);
  if (query?.pack_id?.trim()) {
    url.searchParams.set("pack_id", query.pack_id.trim());
  }
  if (query?.enabled?.trim()) {
    url.searchParams.set("enabled", query.enabled.trim());
  }
  if (query?.domain?.trim()) {
    url.searchParams.set("domain", query.domain.trim());
  }
  return url.pathname + url.search;
}

export interface PutAgentGrantRequest {
  session_id: string;
  agent_pack_id: string;
  scopes: string[];
}

export interface PutAgentGrantResponse {
  status: "success" | "error";
  agent_pack_id?: string;
  granted_scopes?: AgentDomainScopeId[];
  granted_at?: number;
  message?: string;
}

/** Resolve API base URL. Empty string uses same-origin relative paths (gateway or Vite `/api` proxy). */
export function resolveApiBaseUrl(
  _env: { VITE_GATEWAY_URL?: string } | undefined,
  _location: Pick<Location, "origin">,
): string {
  // TRA HTTP routes are always on the page origin: bundled at `/trustclaw/` on the
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
        ? " — TRA plugin route missing; run `pnpm trustclaw:setup` and restart gateway"
        : "";
    throw new Error(
      `Non-JSON response from ${path} (${response.status})${hint}: ${text.slice(0, 200)}`,
    );
  }
  if (!response.ok) {
    const message =
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : text.slice(0, 200);
    throw new Error(`${path} failed (${response.status}): ${message}`);
  }
  return parsed as TResponse;
}

export interface TrustclawApiClient {
  init(body: TraInitRequest): Promise<TraInitResponse>;
  reset(): Promise<TraResetResponse>;
  status(): Promise<TraStatusResponse>;
  tables(agentPackId?: string): Promise<TraTablesResponse>;
  browseSubscriptions(agentPackId?: string): Promise<TraBrowseSubscriptionsResponse>;
  browse(table: string, limit?: number, agentPackId?: string): Promise<TraBrowseResponse>;
  agentGrants(): Promise<AgentGrantsResponse>;
  domainAgents(query?: DomainAgentsQuery): Promise<DomainAgentsResponse>;
  importDomainAgentsBundledRegistry(
    body?: DomainAgentsBundledRegistryImportRequest,
  ): Promise<DomainAgentsImportResponse>;
  putAgentGrant(body: PutAgentGrantRequest): Promise<PutAgentGrantResponse>;
  agentPacks(): Promise<AgentPacksListResponse>;
  agentPackDetail(packId: string): Promise<AgentPackDetailResponse>;
  validateAgentPack(body: unknown): Promise<AgentPackValidateResult>;
  putAgentPack(packId: string, body: unknown): Promise<AgentPackPutResponse>;
  createAgentPack(body: unknown): Promise<AgentPackCreateResponse>;
  deleteAgentPack(packId: string): Promise<AgentPackDeleteResponse>;
  chat(body: AgentChatRequest): Promise<AgentChatResponse>;
  auditEvents(
    scope?: "compliance" | "chat" | "all",
    limit?: number,
    agentPackId?: string,
  ): Promise<AuditEventsResponse>;
  ledgerStatus(agentPackId?: string): Promise<LedgerStatusResponse>;
  compliancePreview(
    packagePayload: unknown,
    agentPackId?: string,
  ): Promise<CompliancePreviewResult>;
  complianceImport(
    body: ComplianceImportRequestBody,
    agentPackId?: string,
  ): Promise<ComplianceImportResult>;
  complianceImportBundled(
    body: ComplianceBundledImportRequestBody,
    agentPackId?: string,
  ): Promise<ComplianceImportResult>;
  complianceStandards(agentPackId?: string): Promise<ComplianceStandardsResponse>;
  referencePreview(
    body: { package?: unknown; url?: string },
    agentPackId?: string,
  ): Promise<ReferencePreviewResult>;
  referenceSync(body: ReferenceSyncRequestBody, agentPackId?: string): Promise<ReferenceSyncResult>;
  referenceSyncBundled(
    body: ReferenceBundledSyncRequestBody,
    agentPackId?: string,
  ): Promise<ReferenceSyncResult>;
  referenceStatus(agentPackId?: string): Promise<ReferenceStatusResponse>;
  devicePreview(
    body: DeviceImportPreviewRequestBody,
    agentPackId?: string,
  ): Promise<DeviceImportPreviewResult>;
  deviceImport(
    body: DeviceImportExecuteRequestBody,
    agentPackId?: string,
  ): Promise<DeviceImportResult>;
}

function scopedPath(path: string, agentPackId?: string): string {
  if (!agentPackId?.trim()) {
    return path;
  }
  const url = new URL(path, "http://x");
  url.searchParams.set("agentPackId", agentPackId.trim());
  return url.pathname + url.search;
}

export function createApiClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): TrustclawApiClient {
  return {
    init(body) {
      return callJson(fetchImpl, baseUrl, "/api/tra/init", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    reset() {
      return callJson(fetchImpl, baseUrl, "/api/tra/reset", { method: "POST" });
    },
    status() {
      return callJson(fetchImpl, baseUrl, "/api/tra/status");
    },
    tables(agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/tables", agentPackId));
    },
    browseSubscriptions(agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/browse/subscriptions", agentPackId));
    },
    browse(table, limit, agentPackId) {
      return callJson(fetchImpl, baseUrl, buildBrowseUrl("http://x", table, limit, agentPackId));
    },
    agentGrants() {
      return callJson(fetchImpl, baseUrl, "/api/tra/agent-grants");
    },
    domainAgents(query) {
      return callJson(fetchImpl, baseUrl, buildDomainAgentsUrl("http://x", query));
    },
    importDomainAgentsBundledRegistry(body) {
      return callJson(fetchImpl, baseUrl, "/api/tra/domain-agents/import/bundled-registry", {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      });
    },
    putAgentGrant(body) {
      return callJson(fetchImpl, baseUrl, "/api/tra/agent-grants", {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
    agentPacks() {
      return callJson(fetchImpl, baseUrl, "/api/tra/agent-packs");
    },
    agentPackDetail(packId) {
      return callJson(
        fetchImpl,
        baseUrl,
        `/api/tra/agent-packs/${encodeURIComponent(packId.trim())}`,
      );
    },
    async validateAgentPack(body) {
      const result = await postJsonBody<{
        status: string;
        valid?: boolean;
        pack?: AgentPackDetailManifest;
        issues?: AgentPackValidationIssue[];
        schema_ref?: string;
        message?: string;
      }>(fetchImpl, baseUrl, "/api/tra/agent-packs/validate", body);
      if (result.status === 200 && result.body.valid === true && result.body.pack) {
        return { ok: true, pack: result.body.pack, schema_ref: result.body.schema_ref };
      }
      if (result.status === 400 && Array.isArray(result.body.issues)) {
        return {
          ok: false,
          issues: result.body.issues,
          message: result.body.message,
        };
      }
      throw new Error(
        `/api/tra/agent-packs/validate failed (${result.status}): ${result.body.message ?? "unknown error"}`,
      );
    },
    putAgentPack(packId, body) {
      return callJson(
        fetchImpl,
        baseUrl,
        `/api/tra/agent-packs/${encodeURIComponent(packId.trim())}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
      );
    },
    createAgentPack(body) {
      return callJson(fetchImpl, baseUrl, "/api/tra/agent-packs", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    deleteAgentPack(packId) {
      return callJson(
        fetchImpl,
        baseUrl,
        `/api/tra/agent-packs/${encodeURIComponent(packId.trim())}`,
        { method: "DELETE" },
      );
    },
    chat(body) {
      return callJson(fetchImpl, baseUrl, "/api/agent/chat", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    compliancePreview(packagePayload, agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/compliance/preview", agentPackId), {
        method: "POST",
        body: JSON.stringify({ package: packagePayload }),
      });
    },
    complianceImport(body, agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/compliance/import", agentPackId), {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    complianceImportBundled(body, agentPackId) {
      return callJson(
        fetchImpl,
        baseUrl,
        scopedPath("/api/tra/compliance/import/bundled-glp1-v2", agentPackId),
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },
    complianceStandards(agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/compliance/standards", agentPackId));
    },
    referencePreview(body, agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/reference/preview", agentPackId), {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    referenceSync(body, agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/reference/sync", agentPackId), {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    referenceSyncBundled(body, agentPackId) {
      return callJson(
        fetchImpl,
        baseUrl,
        scopedPath("/api/tra/reference/sync/bundled-glp1", agentPackId),
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },
    referenceStatus(agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/reference/status", agentPackId));
    },
    devicePreview(body, agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/device/preview", agentPackId), {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    deviceImport(body, agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/device/import", agentPackId), {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    auditEvents(scope = "compliance", limit = 30, agentPackId) {
      const url = new URL("/api/tra/audit/events", "http://x");
      url.searchParams.set("scope", scope);
      url.searchParams.set("limit", String(limit));
      if (agentPackId?.trim()) {
        url.searchParams.set("agentPackId", agentPackId.trim());
      }
      return callJson(fetchImpl, baseUrl, url.pathname + url.search);
    },
    ledgerStatus(agentPackId) {
      return callJson(fetchImpl, baseUrl, scopedPath("/api/tra/ledger", agentPackId));
    },
  };
}
