import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk/core";
import type { TrustclawPluginConfig } from "../../../trustclaw/ptds/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/ptds/config.js";
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
        const result = await runTrustclawChat(
          { session_id: resolveSessionId(ctx), message },
          {
            dbPath: paths.dbPath,
            auditDir: paths.auditDir,
            llm: deps.llm,
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
