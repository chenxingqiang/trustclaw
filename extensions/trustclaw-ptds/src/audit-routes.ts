import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CHAT_PIPELINE_AUDIT_STEPS,
  COMPLIANCE_AUDIT_STEPS,
  auditEventMatchesAgentPack,
  readAuditEvents,
  type AuditStepCode,
} from "../../../trustclaw/audit/index.js";
import {
  resolveTrustclawPaths,
  type TrustclawPluginConfig,
} from "../../../trustclaw/ptds/config.js";
import { requireAgentDomainGrant } from "./agent-grant-guard.js";
import { methodIs, sendJson } from "./http-utils.js";

const ALL_SCOPES = new Set(["compliance", "chat", "all"]);

function resolveSteps(scope: string): readonly AuditStepCode[] | undefined {
  if (scope === "compliance") {
    return COMPLIANCE_AUDIT_STEPS;
  }
  if (scope === "chat") {
    return CHAT_PIPELINE_AUDIT_STEPS;
  }
  return undefined;
}

export function createPtdsAuditEventsHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const scope = url.searchParams.get("scope")?.trim() || "compliance";
    if (!ALL_SCOPES.has(scope)) {
      sendJson(res, 400, {
        status: "error",
        message: "Invalid scope. Use compliance, chat, or all.",
      });
      return true;
    }
    const limitRaw = url.searchParams.get("limit")?.trim();
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 30;
    if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
      sendJson(res, 400, { status: "error", message: "Invalid limit. Use 1–500." });
      return true;
    }

    const guard = requireAgentDomainGrant(req, "panel.audit", pluginConfig);
    if (!guard.ok) {
      sendJson(res, guard.status, { status: "error", message: guard.message });
      return true;
    }

    const paths = guard.paths;
    const events = readAuditEvents({
      auditDir: paths.auditDir,
      limit,
      steps: resolveSteps(scope),
    }).filter((event) => auditEventMatchesAgentPack(event, guard.pack.id));
    sendJson(res, 200, {
      status: "success",
      scope,
      agent_pack_id: guard.pack.id,
      audit_dir: paths.auditDir,
      events,
    });
    return true;
  };
}
