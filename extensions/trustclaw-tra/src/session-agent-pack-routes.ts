import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  getAgentPackRegistry,
  resolveCoordinatorAgentPack,
  summarizeAgentPack,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import type { TrustclawPluginConfig } from "../../../trustclaw/tra/config.js";
import { resolveTrustclawPaths } from "../../../trustclaw/tra/config.js";
import {
  clearSessionAgentPackBinding,
  getSessionAgentPackId,
  getSessionAgentPackLock,
  setSessionAgentPackBinding,
} from "../../../trustclaw/tra/session-agent-pack.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

const putBodySchema = z
  .object({
    session_id: z.string().trim().min(1),
    agent_pack_id: z.string().trim().min(1),
  })
  .strict();

function readSessionIdFromQuery(req: IncomingMessage): string | undefined {
  const url = new URL(req.url ?? "/", "http://localhost");
  const sessionId =
    url.searchParams.get("session_id")?.trim() || url.searchParams.get("session_key")?.trim() || "";
  return sessionId || undefined;
}

export function createSessionAgentPackGetHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    const sessionId = readSessionIdFromQuery(req);
    if (!sessionId) {
      sendJson(res, 400, { status: "error", message: "session_id query parameter is required." });
      return true;
    }

    try {
      const paths = resolveTrustclawPaths(pluginConfig);
      const overrides = { dbPath: paths.dbPath, auditDir: paths.auditDir };
      const url = new URL(req.url ?? "/", "http://localhost");
      const openclawAgentId = url.searchParams.get("openclaw_agent_id")?.trim();
      const resolved = resolveCoordinatorAgentPack({
        sessionKey: sessionId,
        openclawAgentId: openclawAgentId || undefined,
        pluginConfig,
        bindLock: false,
      });
      sendJson(res, 200, {
        status: "success",
        session_id: sessionId,
        agent_pack_id: resolved.pack.id,
        resolved_from: resolved.source,
        locked: resolved.locked,
        lock_pack_id: resolved.lock_pack_id,
        session_override: getSessionAgentPackId(sessionId, overrides) ?? null,
        openclaw_suggested_pack_id: resolved.openclaw_suggested_pack_id,
        agent_pack_mismatch: resolved.agent_pack_mismatch,
        pack: summarizeAgentPack(resolved.pack),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
    }
    return true;
  };
}

export function createSessionAgentPackPutHandler(pluginConfig: TrustclawPluginConfig | undefined) {
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

    const body = putBodySchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, {
        status: "error",
        message: "Invalid session agent pack payload.",
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
      const pack = registry.resolve({ packId: body.data.agent_pack_id });
      setSessionAgentPackBinding(body.data.session_id, pack.id, overrides);
      sendJson(res, 200, {
        status: "success",
        session_id: body.data.session_id,
        agent_pack_id: pack.id,
        resolved_from: "session",
        locked: true,
        lock_pack_id: pack.id,
        pack: summarizeAgentPack(pack),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 400, { status: "error", message });
    }
    return true;
  };
}

export function createSessionAgentPackDeleteHandler(
  pluginConfig: TrustclawPluginConfig | undefined,
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "DELETE")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    const sessionId = readSessionIdFromQuery(req);
    if (!sessionId) {
      sendJson(res, 400, { status: "error", message: "session_id query parameter is required." });
      return true;
    }

    try {
      const paths = resolveTrustclawPaths(pluginConfig);
      clearSessionAgentPackBinding(sessionId, {
        dbPath: paths.dbPath,
        auditDir: paths.auditDir,
      });
      sendJson(res, 200, {
        status: "success",
        session_id: sessionId,
        cleared: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
    }
    return true;
  };
}
