import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk/core";
import { resolveBoundAgentPack } from "../../../trustclaw/runtime/agent-pack/index.js";
import { TRUSTCLAW_TRA_QUERY_TOOL } from "../../../trustclaw/runtime/constants.js";
import { withCoordinatorAttribution } from "../../../trustclaw/runtime/coordinator/index.js";
import type { Text2SqlLlmCaller } from "../../../trustclaw/runtime/pipeline/index.js";
import { runTrustclawChat } from "../../../trustclaw/runtime/pipeline/index.js";
import type { TrustclawPluginConfig } from "../../../trustclaw/tra/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/tra/config.js";

export type TrustclawTraQueryToolDeps = {
  llm: Text2SqlLlmCaller;
};

function readMessageParam(params: Record<string, unknown>): string {
  const message = typeof params.message === "string" ? params.message.trim() : "";
  if (!message) {
    throw new Error("message required");
  }
  return message;
}

function resolveSessionId(ctx: OpenClawPluginToolContext): string {
  return ctx.sessionKey?.trim() || ctx.sessionId?.trim() || "default";
}

export function createTrustclawTraQueryToolFactory(
  pluginConfig: TrustclawPluginConfig | undefined,
  deps: TrustclawTraQueryToolDeps,
) {
  return (ctx: OpenClawPluginToolContext) => {
    if (ctx.sandboxed) {
      return null;
    }

    return {
      name: TRUSTCLAW_TRA_QUERY_TOOL,
      label: "TrustClaw TRA Query",
      description:
        "Run the TrustClaw audited Text2SQL pipeline against the local trust-runtime SQLite database. Returns an evidence-backed decision with audit trail metadata.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          message: {
            type: "string",
            description: "Natural-language health or GLP-1 eligibility question.",
          },
        },
        required: ["message"],
      },
      async execute(_id: string, params: Record<string, unknown>) {
        const message = readMessageParam(params);
        const paths = resolveTrustclawPaths(pluginConfig);
        const sessionId = resolveSessionId(ctx);
        const coordinator = resolveBoundAgentPack({
          sessionKey: sessionId,
          openclawAgentId: ctx.agentId,
          pluginConfig,
        });
        const result = await runTrustclawChat(
          { session_id: sessionId, message },
          {
            dbPath: paths.dbPath,
            auditDir: paths.auditDir,
            evidenceDir: paths.evidenceDir,
            llm: deps.llm,
            agentPack: coordinator.pack,
          },
        );

        if (!result.ok) {
          throw new Error(result.message);
        }

        const context = withCoordinatorAttribution(result.context, coordinator);
        return {
          content: [
            {
              type: "text",
              text: context.pipeline_stages.agent_decision.response,
            },
          ],
          details: {
            trustclaw: {
              runtime_context: context,
            },
          },
        };
      },
    };
  };
}
