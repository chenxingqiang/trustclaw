import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { readAuditEvents } from "../../../trustclaw/audit/index.js";
import { recordAgentDomainGrantAudit } from "../../../trustclaw/ptds/agent-domain-grant-audit.js";
import {
  listAgentDomainGrants,
  setAgentDomainGrant,
} from "../../../trustclaw/ptds/agent-domain-grants.js";
import {
  deriveAgentDomainScopes,
  isAgentDomainScope,
  type AgentDomainScope,
} from "../../../trustclaw/ptds/agent-domain-scopes.js";
import {
  resolveTrustclawPaths,
  type TrustclawPluginConfig,
} from "../../../trustclaw/ptds/config.js";
import {
  getAgentPackRegistry,
  summarizeAgentPack,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

const putGrantSchema = z
  .object({
    session_id: z.string().trim().min(1),
    agent_pack_id: z.string().trim().min(1),
    scopes: z.array(z.string().trim().min(1)),
  })
  .strict();

export function createAgentGrantsGetHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    try {
      const paths = resolveTrustclawPaths(pluginConfig);
      const registry = getAgentPackRegistry({
        agentsDir: pluginConfig?.agentPacksDir,
        defaultPackId: pluginConfig?.defaultAgentPack,
      });
      const grants = listAgentDomainGrants({ dbPath: paths.dbPath, auditDir: paths.auditDir });
      const history = readAuditEvents({
        auditDir: paths.auditDir,
        limit: 200,
        steps: ["AGENT_DOMAIN_GRANT"],
      })
        .map((event) => ({
          event_id: event.event_id,
          audit_trail_id: event.audit_trail_id,
          timestamp: event.timestamp,
          agent_pack_id:
            typeof event.input.agent_pack_id === "string" ? event.input.agent_pack_id : "unknown",
          scopes: Array.isArray(event.input.scopes)
            ? event.input.scopes.filter((scope): scope is string => typeof scope === "string")
            : [],
          granted: event.output.granted === true,
          status: event.status,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
      const packs = registry.list().map((pack) => {
        const available_scopes = deriveAgentDomainScopes(pack);
        const grant = grants[pack.id];
        return {
          ...summarizeAgentPack(pack),
          available_scopes,
          granted_scopes: grant?.scopes ?? [],
          granted_at: grant?.granted_at ?? null,
        };
      });
      sendJson(res, 200, {
        status: "success",
        packs,
        grants,
        history,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
    }
    return true;
  };
}

export function createAgentGrantsPutHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "PUT")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: "error", message: parsed.message });
      return true;
    }
    const body = putGrantSchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, {
        status: "error",
        message: "Invalid agent grant payload.",
        details: body.error.flatten(),
      });
      return true;
    }

    try {
      const paths = resolveTrustclawPaths(pluginConfig);
      const overrides = { dbPath: paths.dbPath, auditDir: paths.auditDir };
      const registry = getAgentPackRegistry({
        agentsDir: pluginConfig?.agentPacksDir,
        defaultPackId: pluginConfig?.defaultAgentPack,
      });
      const pack = registry.get(body.data.agent_pack_id);
      if (!pack) {
        sendJson(res, 404, {
          status: "error",
          message: `Unknown agent pack: ${body.data.agent_pack_id}`,
        });
        return true;
      }

      const available = new Set(deriveAgentDomainScopes(pack));
      const scopes: AgentDomainScope[] = [];
      for (const scope of body.data.scopes) {
        if (!isAgentDomainScope(scope) || !available.has(scope)) {
          sendJson(res, 400, {
            status: "error",
            message: `Scope "${scope}" is not grantable for pack "${pack.id}".`,
          });
          return true;
        }
        scopes.push(scope);
      }

      const entry = setAgentDomainGrant(pack.id, scopes, overrides);
      recordAgentDomainGrantAudit({
        sessionId: body.data.session_id,
        agentPackId: pack.id,
        scopes: entry.scopes,
        granted: entry.scopes.length > 0,
        auditDir: paths.auditDir,
      });

      sendJson(res, 200, {
        status: "success",
        agent_pack_id: pack.id,
        granted_scopes: entry.scopes,
        granted_at: entry.granted_at,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
    }
    return true;
  };
}
