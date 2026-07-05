import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getAgentPackRegistry,
  summarizeAgentPack,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import type { TrustclawPluginConfig } from "../../../trustclaw/tra/config.js";
import { methodIs, sendJson } from "./http-utils.js";

export function createAgentPacksHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    try {
      const registry = getAgentPackRegistry({
        agentsDir: pluginConfig?.agentPacksDir,
        defaultPackId: pluginConfig?.defaultAgentPack,
      });
      const packs = registry.list().map((pack) => summarizeAgentPack(pack));
      sendJson(res, 200, {
        status: "success",
        default_pack_id: registry.getDefault().id,
        packs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
    }
    return true;
  };
}
