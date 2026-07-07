import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import {
  agentPackDocumentJsonSchemaRef,
  deleteAgentPackDirectory,
  describeAgentPackDetail,
  getAgentPackRegistry,
  inspectAgentPackDocument,
  listAgentPackExtensionPoints,
  resetAgentPackRegistryCache,
  summarizeAgentPack,
  writeAgentPackDocument,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import type { TrustclawPluginConfig } from "../../../trustclaw/tra/config.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

function readAgentPacksSubpath(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.pathname.replace(/^\/api\/tra\/agent-packs\/?/, "").trim();
}

function loadRegistry(pluginConfig: TrustclawPluginConfig | undefined) {
  return getAgentPackRegistry({
    agentsDir: pluginConfig?.agentPacksDir,
    defaultPackId: pluginConfig?.defaultAgentPack,
  });
}

function resolveWritableAgentsDir(
  pluginConfig: TrustclawPluginConfig | undefined,
): string | undefined {
  const agentsDir = pluginConfig?.agentPacksDir?.trim();
  return agentsDir || undefined;
}

export function createAgentPacksHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    try {
      const subpath = readAgentPacksSubpath(req);

      if (subpath === "validate") {
        if (!methodIs(req, "POST")) {
          sendJson(res, 405, { status: "error", message: "Method not allowed." });
          return true;
        }
        const parsed = await readJsonBody(req);
        if (!parsed.ok) {
          sendJson(res, 400, { status: "error", message: parsed.message });
          return true;
        }
        const inspected = inspectAgentPackDocument(parsed.body);
        if (!inspected.ok) {
          sendJson(res, 400, {
            status: "error",
            code: "invalid_agent_pack",
            valid: false,
            issues: inspected.issues,
            schema_ref: agentPackDocumentJsonSchemaRef,
          });
          return true;
        }
        sendJson(res, 200, {
          status: "success",
          valid: true,
          pack: describeAgentPackDetail(inspected.pack),
          schema_ref: agentPackDocumentJsonSchemaRef,
        });
        return true;
      }

      if (!subpath && methodIs(req, "POST")) {
        const agentsDir = resolveWritableAgentsDir(pluginConfig);
        if (!agentsDir) {
          sendJson(res, 403, {
            status: "error",
            code: "pack_write_disabled",
            message: "Agent pack writes require plugin config agentPacksDir.",
          });
          return true;
        }
        const parsed = await readJsonBody(req);
        if (!parsed.ok) {
          sendJson(res, 400, { status: "error", message: parsed.message });
          return true;
        }
        const inspected = inspectAgentPackDocument(parsed.body);
        if (!inspected.ok) {
          sendJson(res, 400, {
            status: "error",
            code: "invalid_agent_pack",
            valid: false,
            issues: inspected.issues,
            schema_ref: agentPackDocumentJsonSchemaRef,
          });
          return true;
        }
        const registryBefore = loadRegistry(pluginConfig);
        if (registryBefore.get(inspected.pack.id)) {
          sendJson(res, 409, {
            status: "error",
            code: "pack_already_exists",
            message: `Agent pack already exists: ${inspected.pack.id}`,
          });
          return true;
        }
        const targetDir = path.join(agentsDir, inspected.pack.id);
        if (existsSync(path.join(targetDir, "agent.pack.json"))) {
          sendJson(res, 409, {
            status: "error",
            code: "pack_already_exists",
            message: `Agent pack directory already exists: ${inspected.pack.id}`,
          });
          return true;
        }
        writeAgentPackDocument(agentsDir, inspected.pack);
        resetAgentPackRegistryCache();
        const registry = loadRegistry(pluginConfig);
        const pack = registry.get(inspected.pack.id);
        if (!pack) {
          sendJson(res, 500, {
            status: "error",
            message: `Pack ${inspected.pack.id} was created but could not be reloaded.`,
          });
          return true;
        }
        sendJson(res, 201, {
          status: "success",
          pack: describeAgentPackDetail(pack),
          schema_ref: agentPackDocumentJsonSchemaRef,
        });
        return true;
      }

      if (subpath && methodIs(req, "PUT")) {
        const agentsDir = resolveWritableAgentsDir(pluginConfig);
        if (!agentsDir) {
          sendJson(res, 403, {
            status: "error",
            code: "pack_write_disabled",
            message: "Agent pack writes require plugin config agentPacksDir.",
          });
          return true;
        }
        const parsed = await readJsonBody(req);
        if (!parsed.ok) {
          sendJson(res, 400, { status: "error", message: parsed.message });
          return true;
        }
        const inspected = inspectAgentPackDocument(parsed.body);
        if (!inspected.ok) {
          sendJson(res, 400, {
            status: "error",
            code: "invalid_agent_pack",
            valid: false,
            issues: inspected.issues,
            schema_ref: agentPackDocumentJsonSchemaRef,
          });
          return true;
        }
        if (inspected.pack.id !== subpath) {
          sendJson(res, 400, {
            status: "error",
            code: "pack_id_mismatch",
            message: `Pack id ${inspected.pack.id} does not match URL path ${subpath}.`,
          });
          return true;
        }
        const registryBefore = loadRegistry(pluginConfig);
        const existing = registryBefore.get(subpath);
        writeAgentPackDocument(agentsDir, inspected.pack, {
          packDir: existing?.packDir,
        });
        resetAgentPackRegistryCache();
        const registry = loadRegistry(pluginConfig);
        const pack = registry.get(subpath);
        if (!pack) {
          sendJson(res, 500, {
            status: "error",
            message: `Pack ${subpath} was written but could not be reloaded.`,
          });
          return true;
        }
        sendJson(res, 200, {
          status: "success",
          pack: describeAgentPackDetail(pack),
          schema_ref: agentPackDocumentJsonSchemaRef,
        });
        return true;
      }

      if (subpath && methodIs(req, "DELETE")) {
        const agentsDir = resolveWritableAgentsDir(pluginConfig);
        if (!agentsDir) {
          sendJson(res, 403, {
            status: "error",
            code: "pack_write_disabled",
            message: "Agent pack writes require plugin config agentPacksDir.",
          });
          return true;
        }
        const registryBefore = loadRegistry(pluginConfig);
        const existing = registryBefore.get(subpath);
        if (!existing) {
          sendJson(res, 404, {
            status: "error",
            code: "pack_not_found",
            message: `Unknown agent pack id: ${subpath}`,
          });
          return true;
        }
        if (existing.id === registryBefore.getDefault().id) {
          sendJson(res, 403, {
            status: "error",
            code: "default_pack_protected",
            message: `Cannot delete default agent pack: ${existing.id}`,
          });
          return true;
        }
        deleteAgentPackDirectory(agentsDir, existing.packDir);
        resetAgentPackRegistryCache();
        sendJson(res, 200, {
          status: "success",
          deleted_pack_id: existing.id,
        });
        return true;
      }

      if (!methodIs(req, "GET")) {
        sendJson(res, 405, { status: "error", message: "Method not allowed." });
        return true;
      }

      const registry = loadRegistry(pluginConfig);

      if (!subpath) {
        const packs = registry.list().map((pack) => summarizeAgentPack(pack));
        sendJson(res, 200, {
          status: "success",
          default_pack_id: registry.getDefault().id,
          packs,
          extension_points: listAgentPackExtensionPoints(),
          schema_ref: agentPackDocumentJsonSchemaRef,
        });
        return true;
      }

      if (subpath === "extension-points") {
        sendJson(res, 200, {
          status: "success",
          ...listAgentPackExtensionPoints(),
          schema_ref: agentPackDocumentJsonSchemaRef,
        });
        return true;
      }

      const pack = registry.get(subpath);
      if (!pack) {
        sendJson(res, 404, {
          status: "error",
          code: "pack_not_found",
          message: `Unknown agent pack id: ${subpath}`,
        });
        return true;
      }

      sendJson(res, 200, {
        status: "success",
        pack: describeAgentPackDetail(pack),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
    }
    return true;
  };
}
