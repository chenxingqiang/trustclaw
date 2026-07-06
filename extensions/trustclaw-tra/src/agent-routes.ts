import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { resolveBoundAgentPack } from "../../../trustclaw/runtime/agent-pack/index.js";
import { withCoordinatorAttribution } from "../../../trustclaw/runtime/coordinator/index.js";
import type { Text2SqlLlmCaller } from "../../../trustclaw/runtime/pipeline/index.js";
import { runTrustclawChat } from "../../../trustclaw/runtime/pipeline/index.js";
import { hasAgentDomainGrant } from "../../../trustclaw/tra/agent-domain-grants.js";
import type { TrustclawPluginConfig } from "../../../trustclaw/tra/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/tra/config.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

const chatRequestSchema = z
  .object({
    session_id: z.string().trim().min(1),
    message: z.string().trim().min(1),
    agent_pack_id: z.string().trim().min(1).optional(),
  })
  .strict();

export type AgentChatHandlerDeps = {
  llm: Text2SqlLlmCaller;
};

function pathOverrides(pluginConfig: TrustclawPluginConfig | undefined) {
  return resolveTrustclawPaths(pluginConfig);
}

export function createAgentChatHandler(
  pluginConfig: TrustclawPluginConfig | undefined,
  deps: AgentChatHandlerDeps,
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "POST")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: "error", message: parsed.message });
      return true;
    }

    const body = chatRequestSchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, {
        status: "error",
        message: "Invalid chat payload.",
        details: body.error.flatten(),
      });
      return true;
    }

    const paths = pathOverrides(pluginConfig);
    const pathOverrides_ = { dbPath: paths.dbPath, auditDir: paths.auditDir };
    const coordinator = resolveBoundAgentPack({
      sessionKey: body.data.session_id,
      requestedPackId: body.data.agent_pack_id,
      pluginConfig,
    });
    if (!hasAgentDomainGrant(coordinator.pack.id, "tra.chat", pathOverrides_)) {
      sendJson(res, 403, {
        status: "error",
        code: "agent_not_granted",
        message: `Domain agent "${coordinator.pack.id}" lacks tra.chat grant. Grant in Panel C.`,
      });
      return true;
    }
    const result = await runTrustclawChat(
      { ...body.data, agent_pack_id: coordinator.pack.id },
      {
        dbPath: paths.dbPath,
        auditDir: paths.auditDir,
        evidenceDir: paths.evidenceDir,
        llm: deps.llm,
        agentPack: coordinator.pack,
      },
    );

    if (!result.ok) {
      const status =
        result.status === "tra_not_initialized"
          ? 409
          : result.status === "security_blocked"
            ? 403
            : 500;
      sendJson(res, status, {
        status: "error",
        code: result.status,
        message: result.message,
        ...(result.audit_trail_id ? { audit_trail_id: result.audit_trail_id } : {}),
      });
      return true;
    }

    sendJson(res, 200, withCoordinatorAttribution(result.context, coordinator));
    return true;
  };
}
