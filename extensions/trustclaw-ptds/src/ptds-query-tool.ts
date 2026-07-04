import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk/core";
import type { TrustclawPluginConfig } from "../../../trustclaw/ptds/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/ptds/config.js";
import { resolveBoundAgentPack } from "../../../trustclaw/runtime/agent-pack/index.js";
import { TRUSTCLAW_PTDS_QUERY_TOOL } from "../../../trustclaw/runtime/constants.js";
import type { Text2SqlLlmCaller } from "../../../trustclaw/runtime/pipeline/index.js";
import { runTrustclawChat } from "../../../trustclaw/runtime/pipeline/index.js";

export type TrustclawPtdsQueryToolDeps = {
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

export function createTrustclawPtdsQueryToolFactory(
  pluginConfig: TrustclawPluginConfig | undefined,
  deps: TrustclawPtdsQueryToolDeps,
) {
  return (ctx: OpenClawPluginToolContext) => {
    if (ctx.sandboxed) {
      return null;
    }

    return {
      name: TRUSTCLAW_PTDS_QUERY_TOOL,
      label: "TrustClaw PTDS Query",
      description:
        "Run the TrustClaw GLP-1 Text2SQL pipeline against the local PTDS SQLite database. Returns an evidence-backed decision with audit trail metadata.",
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
        const agentPack = resolveBoundAgentPack({
          sessionKey: sessionId,
          openclawAgentId: ctx.agentId,
          pluginConfig,
        }).pack;
        const result = await runTrustclawChat(
          { session_id: sessionId, message },
          {
            dbPath: paths.dbPath,
            auditDir: paths.auditDir,
            evidenceDir: paths.evidenceDir,
            llm: deps.llm,
            agentPack,
          },
        );

        if (!result.ok) {
          throw new Error(result.message);
        }

        const { context } = result;
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
