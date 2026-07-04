import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import type { TrustclawPluginConfig } from "../../trustclaw/ptds/config.js";
import { createOpenAiText2SqlLlm } from "../../trustclaw/runtime/text2sql/openai-llm.js";
import { createAgentChatHandler } from "./src/agent-routes.js";
import { createTrustclawUiHandler } from "./src/ui-routes.js";
import {
  createPtdsBrowseHandler,
  createPtdsInitHandler,
  createPtdsResetHandler,
  createPtdsStatusHandler,
  createPtdsTablesHandler,
} from "./src/ptds-routes.js";

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
  };
}

export default definePluginEntry({
  id: "trustclaw-ptds",
  name: "TrustClaw PTDS",
  description: "Personal Trusted Data Space runtime APIs for TrustClaw",
  register(api) {
    const cfg = readPluginConfig(api.pluginConfig);
    const text2sqlLlm = createOpenAiText2SqlLlm();
    api.registerHttpRoute({
      path: "/api/ptds/init",
      auth: "plugin",
      match: "exact",
      handler: createPtdsInitHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/reset",
      auth: "plugin",
      match: "exact",
      handler: createPtdsResetHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/status",
      auth: "plugin",
      match: "exact",
      handler: createPtdsStatusHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/tables",
      auth: "plugin",
      match: "exact",
      handler: createPtdsTablesHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/ptds/browse",
      auth: "plugin",
      match: "exact",
      handler: createPtdsBrowseHandler(cfg),
    });
    api.registerHttpRoute({
      path: "/api/agent/chat",
      auth: "plugin",
      match: "exact",
      handler: createAgentChatHandler(cfg, { llm: text2sqlLlm }),
    });
    const uiHandler = createTrustclawUiHandler();
    api.registerHttpRoute({
      path: "/trustclaw",
      auth: "plugin",
      match: "prefix",
      handler: uiHandler,
    });
    api.logger.info?.(
      "[trustclaw-ptds] registered PTDS HTTP routes under /api/ptds/*, POST /api/agent/chat, and /trustclaw/* UI",
    );
  },
});
