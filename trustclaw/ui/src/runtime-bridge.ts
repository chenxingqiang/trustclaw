import { TRUSTCLAW_RUNTIME_CONTEXT_MESSAGE } from "../../runtime/constants.js";
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

export function bindTrustclawRuntimeContextListener(handlers: {
  renderAudit: (context: RuntimeContextResponse) => void;
  appendLedger: (context: RuntimeContextResponse) => void;
  clear?: () => void;
  allowedOrigins?: string[];
}): () => void {
  const allowed = new Set(
    handlers.allowedOrigins?.length ? handlers.allowedOrigins : [window.location.origin],
  );

  const onMessage = (event: MessageEvent) => {
    if (!allowed.has(event.origin)) {
      return;
    }
    const data = event.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }
    const record = data as Record<string, unknown>;
    if (record.type !== TRUSTCLAW_RUNTIME_CONTEXT_MESSAGE) {
      return;
    }
    if (!isRuntimeContextPayload(record.context)) {
      return;
    }
    handlers.renderAudit(record.context);
    handlers.appendLedger(record.context);
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
