import type { IncomingMessage, ServerResponse } from "node:http";
import {
  resolveTrustclawPaths,
  type TrustclawPluginConfig,
} from "../../../trustclaw/tra/config.js";
import { importDeviceData, previewDeviceImport } from "../../../trustclaw/tra/device-import.js";
import type { DeviceImportLlm } from "../../../trustclaw/tra/device-import.js";
import {
  deviceImportExecuteRequestSchema,
  deviceImportPreviewRequestSchema,
} from "../../../trustclaw/tra/device-types.js";
import { requireAgentDomainGrant } from "./agent-grant-guard.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

function pathOverrides(pluginConfig: TrustclawPluginConfig | undefined) {
  return resolveTrustclawPaths(pluginConfig);
}

export function createDevicePreviewHandler(
  pluginConfig: TrustclawPluginConfig | undefined,
  llm: DeviceImportLlm,
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "POST")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const guard = requireAgentDomainGrant(req, "panel.compliance", pluginConfig);
    if (!guard.ok) {
      sendJson(res, guard.status, { status: "error", message: guard.message });
      return true;
    }
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: "error", message: parsed.message });
      return true;
    }
    const body = deviceImportPreviewRequestSchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, { status: "error", message: "Invalid device import preview payload." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const result = await previewDeviceImport(body.data, {
      llm,
      dbPathOrOverrides: { dbPath: paths.dbPath, auditDir: paths.auditDir },
    });
    sendJson(res, result.status === "success" ? 200 : 400, result);
    return true;
  };
}

export function createDeviceImportHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "POST")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const guard = requireAgentDomainGrant(req, "panel.compliance", pluginConfig);
    if (!guard.ok) {
      sendJson(res, guard.status, { status: "error", message: guard.message });
      return true;
    }
    const parsed = await readJsonBody(req);
    if (!parsed.ok) {
      sendJson(res, 400, { status: "error", message: parsed.message });
      return true;
    }
    const body = deviceImportExecuteRequestSchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, { status: "error", message: "Invalid device import payload." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const result = await importDeviceData(
      { ...body.data, agentPackId: guard.pack.id },
      {
        dbPathOrOverrides: { dbPath: paths.dbPath, auditDir: paths.auditDir },
        auditDir: paths.auditDir,
      },
    );
    sendJson(res, result.status === "success" ? 200 : 400, result);
    return true;
  };
}
