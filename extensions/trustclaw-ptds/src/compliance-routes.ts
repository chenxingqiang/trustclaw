import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  resolveTrustclawPaths,
  type TrustclawPluginConfig,
} from "../../../trustclaw/ptds/config.js";
import {
  bootstrapPtdsDatabase,
  importComplianceStandardPackage,
  listComplianceStandards,
  loadComplianceAstRules,
  previewComplianceStandardPackage,
} from "../../../trustclaw/ptds/index.js";
import { requireAgentDomainGrant } from "./agent-grant-guard.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

const importRequestSchema = z
  .object({
    consentGranted: z.boolean(),
    sessionId: z.string().trim().min(1),
    sourceLabel: z.string().trim().min(1).optional(),
    package: z.unknown(),
  })
  .strict();

const previewRequestSchema = z
  .object({
    package: z.unknown(),
  })
  .strict();

function pathOverrides(pluginConfig: TrustclawPluginConfig | undefined) {
  return resolveTrustclawPaths(pluginConfig);
}

export function createCompliancePreviewHandler(pluginConfig: TrustclawPluginConfig | undefined) {
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
    const body = previewRequestSchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, { status: "error", message: "Invalid preview payload." });
      return true;
    }
    const result = previewComplianceStandardPackage(body.data.package);
    sendJson(res, result.status === "success" ? 200 : 400, result);
    return true;
  };
}

export function createComplianceImportHandler(pluginConfig: TrustclawPluginConfig | undefined) {
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
    const body = importRequestSchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, { status: "error", message: "Invalid import payload." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const result = importComplianceStandardPackage(
      {
        consentGranted: body.data.consentGranted,
        sessionId: body.data.sessionId,
        agentPackId: guard.pack.id,
        sourceLabel: body.data.sourceLabel,
        package: body.data.package as never,
      },
      { dbPath: paths.dbPath, auditDir: paths.auditDir },
    );
    sendJson(res, result.status === "success" ? 200 : 400, result);
    return true;
  };
}

export function createComplianceStandardsHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const guard = requireAgentDomainGrant(req, "panel.compliance", pluginConfig);
    if (!guard.ok) {
      sendJson(res, guard.status, { status: "error", message: guard.message });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const db = bootstrapPtdsDatabase(paths.dbPath);
    try {
      const standards = listComplianceStandards(db);
      sendJson(res, 200, { status: "success", standards });
    } finally {
      db.close();
    }
    return true;
  };
}

export function createComplianceRulesHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const guard = requireAgentDomainGrant(req, "panel.compliance", pluginConfig);
    if (!guard.ok) {
      sendJson(res, guard.status, { status: "error", message: guard.message });
      return true;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const standardId = url.searchParams.get("standard_id")?.trim() ?? "";
    const drugId = url.searchParams.get("drug_id")?.trim() || undefined;
    if (!standardId) {
      sendJson(res, 400, { status: "error", message: "Missing standard_id query parameter." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const db = bootstrapPtdsDatabase(paths.dbPath);
    try {
      const rules = loadComplianceAstRules(db, standardId, drugId);
      sendJson(res, 200, {
        status: "success",
        standard_id: standardId,
        drug_id: drugId ?? null,
        rules,
      });
    } finally {
      db.close();
    }
    return true;
  };
}

/** Dev helper: import bundled GLP-1 AST v2 seed after consent (no client file read). */
export function createComplianceImportBundledHandler(
  pluginConfig: TrustclawPluginConfig | undefined,
  seedPath: string,
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
    const body = z
      .object({
        consentGranted: z.boolean(),
        sessionId: z.string().trim().min(1),
      })
      .strict()
      .safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, { status: "error", message: "Invalid bundled import payload." });
      return true;
    }
    let pkg: unknown;
    try {
      pkg = JSON.parse(readFileSync(seedPath, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const result = importComplianceStandardPackage(
      {
        consentGranted: body.data.consentGranted,
        sessionId: body.data.sessionId,
        agentPackId: guard.pack.id,
        sourceLabel: "glp1-nrdl-ast-handshake-v2.json",
        package: pkg as never,
      },
      { dbPath: paths.dbPath, auditDir: paths.auditDir },
    );
    sendJson(res, result.status === "success" ? 200 : 400, result);
    return true;
  };
}
