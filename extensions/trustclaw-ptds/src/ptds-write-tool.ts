import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk/core";
import type { TrustclawPluginConfig } from "../../../trustclaw/ptds/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/ptds/config.js";
import { executePersonalWrite } from "../../../trustclaw/ptds/personal-write.js";
import {
  loadAgentPackPersonalWriteTemplate,
  resolveBoundAgentPack,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import { TRUSTCLAW_PTDS_WRITE_TOOL } from "../../../trustclaw/runtime/constants.js";
import type { Text2SqlLlmCaller } from "../../../trustclaw/runtime/pipeline/index.js";

export type TrustclawPtdsWriteToolDeps = {
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

export function createTrustclawPtdsWriteToolFactory(
  pluginConfig: TrustclawPluginConfig | undefined,
  deps: TrustclawPtdsWriteToolDeps,
) {
  return (ctx: OpenClawPluginToolContext) => {
    if (ctx.sandboxed) {
      return null;
    }

    return {
      name: TRUSTCLAW_PTDS_WRITE_TOOL,
      label: "TrustClaw TRA Write",
      description:
        "Write new personal health measurements into the local trust-runtime SQLite database using Text2SQL-generated INSERT statements. Use when the user asks to record, update, or import vitals (weight, BMI, HbA1c, blood pressure, wearable metrics). Requires explicit user consent.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          message: {
            type: "string",
            description:
              "Natural-language description of what to write, including new values and timeframe (e.g. '90天后体重72kg，HbA1c 6.5%').",
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
        const result = await executePersonalWrite(
          {
            message,
            consentGranted: true,
            sessionId,
            agentPackId: agentPack.id,
          },
          {
            llm: deps.llm,
            dbPathOrOverrides: { dbPath: paths.dbPath, auditDir: paths.auditDir },
            auditDir: paths.auditDir,
            promptTemplate: loadAgentPackPersonalWriteTemplate(agentPack),
            writeTables: agentPack.data.writeTables,
          },
        );

        if (result.status !== "success") {
          throw new Error(result.message);
        }

        return {
          content: [
            {
              type: "text",
              text: `已写入可信运行时：${result.rows_affected ?? 0} 行，表 ${(result.tables ?? []).join(", ")}。可在 Panel B 刷新查看。`,
            },
          ],
          details: {
            trustclaw: {
              personal_write: result,
            },
          },
        };
      },
    };
  };
}
