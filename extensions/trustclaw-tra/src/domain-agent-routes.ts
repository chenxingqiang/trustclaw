import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  importBundledDomainAgentsMigration,
  importDomainAgentsRegistryPackage,
  listDomainAgents,
  resolveTrustclawPaths,
  type TrustclawPluginConfig,
} from "../../../trustclaw/tra/index.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

const importRequestSchema = z
  .object({
    sql: z.string().trim().min(1),
    replace: z.boolean().optional(),
  })
  .strict();

function readQueryParam(req: IncomingMessage, key: string): string | undefined {
  const rawUrl = req.url ?? "/";
  const queryStart = rawUrl.indexOf("?");
  if (queryStart < 0) {
    return undefined;
  }
  const params = new URLSearchParams(rawUrl.slice(queryStart + 1));
  const value = params.get(key)?.trim();
  return value || undefined;
}

export function createDomainAgentsHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    try {
      const paths = resolveTrustclawPaths(pluginConfig);
      const result = listDomainAgents(paths, {
        pack_id: readQueryParam(req, "pack_id"),
        enabled: readQueryParam(req, "enabled"),
        domain: readQueryParam(req, "domain"),
      });
      sendJson(res, 200, {
        status: "success",
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
    }
    return true;
  };
}

export function createDomainAgentsImportHandler(pluginConfig: TrustclawPluginConfig | undefined) {
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
    const body = importRequestSchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, { status: "error", message: "Invalid domain agent registry import payload." });
      return true;
    }
    const paths = resolveTrustclawPaths(pluginConfig);
    const result = importDomainAgentsRegistryPackage(paths, body.data.sql);
    sendJson(res, result.status === "success" ? 200 : 500, result);
    return true;
  };
}

export function createDomainAgentsBundledMigrationHandler(
  pluginConfig: TrustclawPluginConfig | undefined,
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "POST")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const paths = resolveTrustclawPaths(pluginConfig);
    const result = importBundledDomainAgentsMigration(paths);
    sendJson(res, result.status === "success" ? 200 : 500, result);
    return true;
  };
}
