import {
  TRUSTCLAW_TRA_DATA_CHANGED_MESSAGE,
  TRUSTCLAW_RUNTIME_CONTEXT_MESSAGE,
} from "../../runtime/constants.js";
import type { RuntimeContextResponse } from "./api.js";

function isRuntimeContextPayload(value: unknown): value is RuntimeContextResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.session_id === "string" &&
    typeof record.user_query === "string" &&
    typeof record.audit_trail_id === "string" &&
    !!record.pipeline_stages &&
    typeof record.pipeline_stages === "object"
  );
}

function isAllowedRuntimeContextOrigin(origin: string, allowed: Set<string>): boolean {
  if (allowed.has(origin)) {
    return true;
  }
  // Dev: Vite UI (:5174) listens while Control UI chat runs on gateway (:19001).
  try {
    const { hostname } = new URL(origin);
    if (hostname === "127.0.0.1" || hostname === "localhost") {
      return true;
    }
  } catch {
    // ignore malformed origin
  }
  return false;
}

export function bindTrustclawRuntimeContextListener(handlers: {
  renderAudit: (context: RuntimeContextResponse) => void;
  appendLedger: (context: RuntimeContextResponse) => void;
  onDataChanged?: () => void;
  clear?: () => void;
  allowedOrigins?: string[];
}): () => void {
  const allowed = new Set(
    handlers.allowedOrigins?.length ? handlers.allowedOrigins : [window.location.origin],
  );

  const onMessage = (event: MessageEvent) => {
    if (!isAllowedRuntimeContextOrigin(event.origin, allowed)) {
      return;
    }
    const data = event.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    const record = data as Record<string, unknown>;
    if (record.type === TRUSTCLAW_RUNTIME_CONTEXT_MESSAGE) {
      if (!isRuntimeContextPayload(record.context)) {
        return;
      }
      handlers.renderAudit(record.context);
      handlers.appendLedger(record.context);
      return;
    }
    if (record.type === TRUSTCLAW_TRA_DATA_CHANGED_MESSAGE) {
      handlers.onDataChanged?.();
    }
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
