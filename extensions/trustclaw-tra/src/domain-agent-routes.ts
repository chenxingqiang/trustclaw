import type { IncomingMessage, ServerResponse } from "node:http";
import {
  listDomainAgents,
  resolveTrustclawPaths,
  type TrustclawPluginConfig,
} from "../../../trustclaw/tra/index.js";
import { methodIs, sendJson } from "./http-utils.js";

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
