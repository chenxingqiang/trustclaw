// Bridges TrustClaw TRA tool results to side-panel iframes and standalone shells.

export const TRUSTCLAW_TRA_QUERY_TOOL = "trustclaw_tra_query";
export const TRUSTCLAW_TRA_WRITE_TOOL = "trustclaw_tra_write";
export const TRUSTCLAW_RUNTIME_CONTEXT_MESSAGE = "openclaw:trustclaw:runtime-context";
export const TRUSTCLAW_TRA_DATA_CHANGED_MESSAGE = "openclaw:trustclaw:tra-data-changed";
export const TRUSTCLAW_THEME_MESSAGE = "openclaw:theme";

export type TrustclawPersonalWritePayload = {
  status: string;
  tables?: string[];
  rows_affected?: number;
};

export type TrustclawEvidenceCitation = {
  index: number;
  label: string;
  value: string | number | null;
  rule_id: string;
  source: string;
};

export type TrustclawRuntimeContextPayload = {
  session_id: string;
  user_query: string;
  agent_pack_id?: string;
  declared_pipeline_steps?: string[];
  pipeline_stages: Record<string, unknown>;
  audit_trail_id: string;
  evidence_ledger_receipt?: {
    block_height?: number;
    proof_hash?: string;
    previous_evidence_hash?: string | null;
  };
};

type TrustclawTraHost = {
  trustclawRuntimeContext?: TrustclawRuntimeContextPayload | null;
  requestUpdate?: () => void;
};

const EVIDENCE_TAG_RE = /\[Evidence #(\d+)\]/g;

function escapeHtmlAttr(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function extractTrustclawEvidenceCitations(
  context: TrustclawRuntimeContextPayload | null | undefined,
): TrustclawEvidenceCitation[] {
  const agentDecision = readRecord(context?.pipeline_stages?.agent_decision);
  const raw = agentDecision?.citations;
  if (!Array.isArray(raw)) {
    return [];
  }
  const citations: TrustclawEvidenceCitation[] = [];
  for (const entry of raw) {
    const row = readRecord(entry);
    if (!row) {
      continue;
    }
    const index = typeof row.index === "number" ? row.index : NaN;
    const label = typeof row.label === "string" ? row.label : "";
    const ruleId = typeof row.rule_id === "string" ? row.rule_id : "";
    const source = typeof row.source === "string" ? row.source : "";
    if (!Number.isFinite(index) || !label || !ruleId) {
      continue;
    }
    const value =
      typeof row.value === "string" || typeof row.value === "number"
        ? row.value
        : row.value === null
          ? null
          : null;
    citations.push({ index, label, value, rule_id: ruleId, source });
  }
  return citations.sort((a, b) => a.index - b.index);
}

function formatEvidenceValue(value: string | number | null): string {
  return value === null || value === undefined ? "missing" : String(value);
}

function buildEvidenceTooltip(citation: TrustclawEvidenceCitation): string {
  return `${citation.label} · ${citation.rule_id} · ${formatEvidenceValue(citation.value)} (${citation.source})`;
}

/** Wrap [Evidence #N] in chat markdown with hover tooltips when citations are known. */
export function decorateTrustclawEvidenceTags(
  text: string,
  citations: TrustclawEvidenceCitation[],
): string {
  if (!text || citations.length === 0) {
    return text;
  }
  const byIndex = new Map(citations.map((citation) => [citation.index, citation]));
  return text.replace(EVIDENCE_TAG_RE, (match, indexStr: string) => {
    const citation = byIndex.get(Number(indexStr));
    if (!citation) {
      return match;
    }
    return `<span class="trustclaw-evidence-tag" title="${escapeHtmlAttr(buildEvidenceTooltip(citation))}">${match}</span>`;
  });
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readRuntimeContext(value: unknown): TrustclawRuntimeContextPayload | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const sessionId = typeof record.session_id === "string" ? record.session_id : "";
  const userQuery = typeof record.user_query === "string" ? record.user_query : "";
  const agentPackId = typeof record.agent_pack_id === "string" ? record.agent_pack_id : undefined;
  const declaredPipelineSteps = Array.isArray(record.declared_pipeline_steps)
    ? record.declared_pipeline_steps.filter((step): step is string => typeof step === "string")
    : undefined;
  const auditTrailId = typeof record.audit_trail_id === "string" ? record.audit_trail_id : "";
  const pipelineStages = readRecord(record.pipeline_stages);
  if (!sessionId || !userQuery || !auditTrailId || !pipelineStages) {
    return null;
  }
  const receipt = readRecord(record.evidence_ledger_receipt) ?? undefined;
  return {
    session_id: sessionId,
    user_query: userQuery,
    ...(agentPackId ? { agent_pack_id: agentPackId } : {}),
    ...(declaredPipelineSteps?.length ? { declared_pipeline_steps: declaredPipelineSteps } : {}),
    pipeline_stages: pipelineStages,
    audit_trail_id: auditTrailId,
    evidence_ledger_receipt: receipt
      ? {
          block_height: typeof receipt.block_height === "number" ? receipt.block_height : undefined,
          proof_hash: typeof receipt.proof_hash === "string" ? receipt.proof_hash : undefined,
          previous_evidence_hash:
            typeof receipt.previous_evidence_hash === "string"
              ? receipt.previous_evidence_hash
              : receipt.previous_evidence_hash === null
                ? null
                : undefined,
        }
      : undefined,
  };
}

export function parseRuntimeContextFromToolResult(
  result: unknown,
): TrustclawRuntimeContextPayload | null {
  const record = readRecord(result);
  if (!record) {
    return null;
  }

  const trustclaw = readRecord(readRecord(record.details)?.trustclaw);
  const fromDetails = readRuntimeContext(trustclaw?.runtime_context);
  if (fromDetails) {
    return fromDetails;
  }

  if (typeof record.content === "string") {
    try {
      return readRuntimeContext(JSON.parse(record.content));
    } catch {
      return null;
    }
  }

  const content = Array.isArray(record.content) ? record.content : null;
  const textEntry = content?.find(
    (entry) => readRecord(entry)?.type === "text" && typeof readRecord(entry)?.text === "string",
  );
  const text = typeof readRecord(textEntry)?.text === "string" ? readRecord(textEntry)!.text : null;
  if (!text) {
    return null;
  }
  try {
    return readRuntimeContext(JSON.parse(text));
  } catch {
    return null;
  }
}

export function notifyTrustclawTraTheme(resolved: string, themeMode: "light" | "dark"): void {
  if (typeof document === "undefined") {
    return;
  }
  for (const iframe of document.querySelectorAll<HTMLIFrameElement>(".trustclaw-tra-rail__frame")) {
    iframe.contentWindow?.postMessage(
      { type: TRUSTCLAW_THEME_MESSAGE, resolved, themeMode },
      window.location.origin,
    );
  }
}

function postRuntimeContextToFrame(
  iframe: HTMLIFrameElement,
  message: { type: string; context: TrustclawRuntimeContextPayload },
): void {
  iframe.contentWindow?.postMessage(message, "*");
}

export function notifyTrustclawRuntimeContext(context: TrustclawRuntimeContextPayload): void {
  if (typeof document === "undefined") {
    return;
  }

  const message = { type: TRUSTCLAW_RUNTIME_CONTEXT_MESSAGE, context };

  for (const iframe of document.querySelectorAll<HTMLIFrameElement>(
    "iframe.trustclaw-tra-rail__frame",
  )) {
    const src = iframe.getAttribute("src") ?? "";
    if (src.includes("embed=right")) {
      postRuntimeContextToFrame(iframe, message);
    }
  }

  // Standalone TrustClaw console: Panel D/E live on the parent page; chat runs in .console-chat-frame.
  if (window.parent !== window) {
    window.parent.postMessage(message, "*");
  }
}

export function parsePersonalWriteFromToolResult(
  result: unknown,
): TrustclawPersonalWritePayload | null {
  const record = readRecord(result);
  if (!record) {
    return null;
  }
  const trustclaw = readRecord(readRecord(record.details)?.trustclaw);
  const write = readRecord(trustclaw?.personal_write);
  if (!write || write.status !== "success") {
    return null;
  }
  return {
    status: "success",
    tables: Array.isArray(write.tables)
      ? write.tables.filter((value): value is string => typeof value === "string")
      : undefined,
    rows_affected: typeof write.rows_affected === "number" ? write.rows_affected : undefined,
  };
}

export function notifyTrustclawTraDataChanged(payload: TrustclawPersonalWritePayload): void {
  if (typeof document === "undefined") {
    return;
  }
  const message = { type: TRUSTCLAW_TRA_DATA_CHANGED_MESSAGE, payload };

  for (const iframe of document.querySelectorAll<HTMLIFrameElement>(
    "iframe.trustclaw-tra-rail__frame",
  )) {
    const src = iframe.getAttribute("src") ?? "";
    if (src.includes("embed=left") || src.includes("embed=right")) {
      iframe.contentWindow?.postMessage(message, "*");
    }
  }

  if (window.parent !== window) {
    window.parent.postMessage(message, "*");
  }
}

export function syncTrustclawTraDataChanged(data: Record<string, unknown>): void {
  const payload =
    parsePersonalWriteFromToolResult(data.result) ?? parsePersonalWriteFromToolResult(data);
  if (!payload) {
    return;
  }
  notifyTrustclawTraDataChanged(payload);
}

export function isTrustclawTraDataChangedMessage(
  data: unknown,
): data is { type: string; payload: TrustclawPersonalWritePayload } {
  const record = readRecord(data);
  return !!record && record.type === TRUSTCLAW_TRA_DATA_CHANGED_MESSAGE;
}

export function syncTrustclawTraRuntimeContext(
  host: TrustclawTraHost,
  data: Record<string, unknown>,
): void {
  const context =
    parseRuntimeContextFromToolResult(data.result) ?? parseRuntimeContextFromToolResult(data);
  if (!context) {
    return;
  }
  host.trustclawRuntimeContext = context;
  host.requestUpdate?.();
  notifyTrustclawRuntimeContext(context);
}

export function isTrustclawRuntimeContextMessage(
  data: unknown,
): data is { type: string; context: TrustclawRuntimeContextPayload } {
  const record = readRecord(data);
  if (!record || record.type !== TRUSTCLAW_RUNTIME_CONTEXT_MESSAGE) {
    return false;
  }
  return readRuntimeContext(record.context) != null;
}
