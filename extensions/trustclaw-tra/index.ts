import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createOpenAiText2SqlLlm } from "../../trustclaw/runtime/text2sql/openai-llm.js";
import type { TrustclawPluginConfig } from "../../trustclaw/tra/config.js";
import {
  TRA_SEED_GLP1_AST_V2_JSON,
  TRA_SEED_NRDL_REFERENCE_GLP1_JSON,
} from "../../trustclaw/tra/paths.js";
import {
  createAgentGrantsGetHandler,
  createAgentGrantsPutHandler,
} from "./src/agent-grant-routes.js";
import { buildTrustclawTraAgentGuidance } from "./src/agent-guidance.js";
import { createAgentPacksHandler } from "./src/agent-pack-routes.js";
import { createAgentChatHandler } from "./src/agent-routes.js";
import { createTraAuditEventsHandler } from "./src/audit-routes.js";
import {
  createComplianceImportBundledHandler,
  createComplianceImportHandler,
  createCompliancePreviewHandler,
  createComplianceRulesHandler,
  createComplianceStandardsHandler,
} from "./src/compliance-routes.js";
import { createTrustclawTraDataConsentHook } from "./src/data-consent-hook.js";
import { createDeviceImportHandler, createDevicePreviewHandler } from "./src/device-routes.js";
import { createDomainAgentsHandler } from "./src/domain-agent-routes.js";
import { methodIs, sendJson } from "./src/http-utils.js";
import { createTraLedgerHandler } from "./src/ledger-routes.js";
import {
  createReferencePreviewHandler,
  createReferenceStatusHandler,
  createReferenceSyncBundledHandler,
  createReferenceSyncHandler,
} from "./src/reference-routes.js";
import {
  createSessionAgentPackDeleteHandler,
  createSessionAgentPackGetHandler,
  createSessionAgentPackPutHandler,
} from "./src/session-agent-pack-routes.js";
import { createTrustclawTraQueryToolFactory } from "./src/tra-query-tool.js";
import {
  createTraBrowseHandler,
  createTraBrowseSubscriptionsHandler,
  createTraInitHandler,
  createTraProfileSummaryHandler,
  createTraResetHandler,
  createTraStatusHandler,
  createTraTablesHandler,
} from "./src/tra-routes.js";
import { createTrustclawTraWriteToolFactory } from "./src/tra-write-tool.js";
import { createTrustclawUiHandler } from "./src/ui-routes.js";

function readPluginConfig(
  pluginConfig: Record<string, unknown> | undefined,
): TrustclawPluginConfig {
  if (!pluginConfig) {
    return {};
  }
  return {
    dbPath: typeof pluginConfig.dbPath === "string" ? pluginConfig.dbPath : undefined,
    auditDir: typeof pluginConfig.auditDir === "string" ? pluginConfig.auditDir : undefined,
    evidenceDir:
      typeof pluginConfig.evidenceDir === "string" ? pluginConfig.evidenceDir : undefined,
    agentPacksDir:
      typeof pluginConfig.agentPacksDir === "string" ? pluginConfig.agentPacksDir : undefined,
    defaultAgentPack:
      typeof pluginConfig.defaultAgentPack === "string" ? pluginConfig.defaultAgentPack : undefined,
  };
}

export default definePluginEntry({
  id: "trustclaw-tra",
  name: "TrustClaw TRA",
  description: "Trust Runtime for Agent APIs for TrustClaw",
  register(api) {
    const cfg = readPluginConfig(api.pluginConfig);
    const text2sqlLlm = createOpenAiText2SqlLlm();
    api.registerHttpRoute({
      path: "/api/tra/init",
      auth: "plugin",
      match: "exact",
      handler: createTraInitHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/reset",
      auth: "plugin",
      match: "exact",
      handler: createTraResetHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/status",
      auth: "plugin",
      match: "exact",
      handler: createTraStatusHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/compliance/preview",
      auth: "plugin",
      match: "exact",
      handler: createCompliancePreviewHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/compliance/import",
      auth: "plugin",
      match: "exact",
      handler: createComplianceImportHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/compliance/import/bundled-glp1-v2",
      auth: "plugin",
      match: "exact",
      handler: createComplianceImportBundledHandler(cfg, TRA_SEED_GLP1_AST_V2_JSON),
    });
    api.registerHttpRoute({
      path: "/api/tra/compliance/standards",
      auth: "plugin",
      match: "exact",
      handler: createComplianceStandardsHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/compliance/rules",
      auth: "plugin",
      match: "exact",
      handler: createComplianceRulesHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/reference/preview",
      auth: "plugin",
      match: "exact",
      handler: createReferencePreviewHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/reference/sync",
      auth: "plugin",
      match: "exact",
      handler: createReferenceSyncHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/reference/status",
      auth: "plugin",
      match: "exact",
      handler: createReferenceStatusHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/reference/sync/bundled-glp1",
      auth: "plugin",
      match: "exact",
      handler: createReferenceSyncBundledHandler(cfg, TRA_SEED_NRDL_REFERENCE_GLP1_JSON),
    });
    api.registerHttpRoute({
      path: "/api/tra/device/preview",
      auth: "plugin",
      match: "exact",
      handler: createDevicePreviewHandler(cfg, text2sqlLlm),
    });
    api.registerHttpRoute({
      path: "/api/tra/device/import",
      auth: "plugin",
      match: "exact",
      handler: createDeviceImportHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/profile-summary",
      auth: "plugin",
      match: "exact",
      handler: createTraProfileSummaryHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/audit/events",
      auth: "plugin",
      match: "exact",
      handler: createTraAuditEventsHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/ledger",
      auth: "plugin",
      match: "exact",
      handler: createTraLedgerHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/tables",
      auth: "plugin",
      match: "exact",
      handler: createTraTablesHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/browse/subscriptions",
      auth: "plugin",
      match: "exact",
      handler: createTraBrowseSubscriptionsHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/browse",
      auth: "plugin",
      match: "exact",
      handler: createTraBrowseHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/agent-packs",
      auth: "plugin",
      match: "exact",
      handler: createAgentPacksHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/domain-agents",
      auth: "plugin",
      match: "exact",
      handler: createDomainAgentsHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/tra/agent-grants",
      auth: "plugin",
      match: "exact",
      handler: async (req, res) => {
        const getHandler = createAgentGrantsGetHandler(cfg);
        const putHandler = createAgentGrantsPutHandler(cfg);
        if (methodIs(req, "GET")) {
          return getHandler(req, res);
        }
        if (methodIs(req, "PUT")) {
          return putHandler(req, res);
        }
        sendJson(res, 405, { status: "error", message: "Method not allowed." });
        return true;
      },
    });
    api.registerHttpRoute({
      path: "/api/tra/session/agent-pack",
      auth: "plugin",
      match: "exact",
      handler: async (req, res) => {
        const getHandler = createSessionAgentPackGetHandler(cfg);
        const putHandler = createSessionAgentPackPutHandler(cfg);
        const deleteHandler = createSessionAgentPackDeleteHandler(cfg);
        if (methodIs(req, "GET")) {
          return getHandler(req, res);
        }
        if (methodIs(req, "PUT")) {
          return putHandler(req, res);
        }
        if (methodIs(req, "DELETE")) {
          return deleteHandler(req, res);
        }
        sendJson(res, 405, { status: "error", message: "Method not allowed." });
        return true;
      },
    });
    api.registerHttpRoute({
      path: "/api/agent/chat",
      auth: "plugin",
      match: "exact",
      handler: createAgentChatHandler(cfg, { llm: text2sqlLlm }),
    });
    api.registerTool(createTrustclawTraQueryToolFactory(cfg, { llm: text2sqlLlm }), {
      name: "trustclaw_tra_query",
    });
    api.registerTool(createTrustclawTraWriteToolFactory(cfg, { llm: text2sqlLlm }), {
      name: "trustclaw_tra_write",
    });
    api.on("before_prompt_build", async (event, ctx) =>
      buildTrustclawTraAgentGuidance({
        pluginConfig: cfg,
        messages: event?.messages,
        sessionKey: ctx?.sessionKey ?? ctx?.sessionId,
        openclawAgentId: ctx?.agentId,
      }),
    );
    api.on("before_tool_call", createTrustclawTraDataConsentHook(cfg));
    const uiHandler = createTrustclawUiHandler();
    api.registerHttpRoute({
      path: "/trustclaw",
      auth: "plugin",
      match: "prefix",
      handler: uiHandler,
    });
    api.logger.info?.(
      "[trustclaw-tra] registered TRA HTTP routes under /api/tra/*, POST /api/agent/chat, and /trustclaw/* UI",
    );
  },
});
