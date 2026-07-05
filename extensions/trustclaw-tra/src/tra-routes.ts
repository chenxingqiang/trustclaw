import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { clearAuditEvents } from "../../../trustclaw/audit/index.js";
import { clearEvidenceLedger } from "../../../trustclaw/ledger/index.js";
import { clearAgentDomainGrants } from "../../../trustclaw/tra/agent-domain-grants.js";
import { resolveAgentBrowseTables } from "../../../trustclaw/tra/agent-domain-scopes.js";
import {
  resolveTrustclawPaths,
  type TrustclawPluginConfig,
} from "../../../trustclaw/tra/config.js";
import {
  buildTraHealthProfileSummary,
  clearTraDataAccessGrants,
  initializeTra,
  listTraTables,
  TRA_BROWSER_DEFAULT_TABLES,
  queryTra,
  readGlp1CheckSnapshot,
  resetTra,
  buildTableLineage,
  getBrowseSubscriptionSnapshot,
  summarizeTableCatalog,
} from "../../../trustclaw/tra/index.js";
import { requireAgentDomainGrant } from "./agent-grant-guard.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

const initRequestSchema = z
  .object({
    patientName: z.string().trim().min(1).optional(),
    gender: z.enum(["男", "女"]),
    age: z.number().int().min(1).max(120),
    weight: z.number().finite().positive(),
    height: z.number().finite().positive(),
    bmi: z.number().finite().positive().optional(),
    hba1c: z.number().finite().nonnegative(),
    isPregnantOrLactating: z.boolean(),
    hasType2Diabetes: z.boolean(),
    thyroidHistory: z.boolean(),
    pancreatitisHistory: z.boolean(),
    cardiovascularRisk: z.boolean(),
    gastrointestinalSensitivity: z.boolean(),
    hasArteriosclerosis: z.boolean(),
    hasCoronaryHeartDisease: z.boolean(),
    hasMyocardialInfarction: z.boolean(),
    hasStroke: z.boolean(),
    usedMetforminBadControl: z.boolean(),
    usedSulfonylureaBadControl: z.boolean(),
    usedInsulinBadControl: z.boolean(),
    isFirstPrescription: z.boolean().optional(),
    institutionLevel: z.number().int().min(1).max(3).optional(),
    isSpecialistPhysician: z.boolean().optional(),
  })
  .strict();

/** Default TRA browser tables (D12 + subscribed reference/compliance). */
export const TRA_BROWSER_TABLES = TRA_BROWSER_DEFAULT_TABLES;

function pathOverrides(pluginConfig: TrustclawPluginConfig | undefined) {
  return resolveTrustclawPaths(pluginConfig);
}

export function createTraInitHandler(pluginConfig: TrustclawPluginConfig | undefined) {
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
    const body = initRequestSchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, {
        status: "error",
        message: "Invalid TRA init payload.",
        details: body.error.flatten(),
      });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const result = initializeTra(body.data, { dbPath: paths.dbPath });
    const status = result.status === "success" ? 200 : 500;
    const profileSummary =
      result.status === "success"
        ? buildTraHealthProfileSummary({ dbPath: paths.dbPath })
        : undefined;
    sendJson(res, status, profileSummary ? { ...result, profile_summary: profileSummary } : result);
    return true;
  };
}

export function createTraResetHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "POST")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const result = resetTra({ dbPath: paths.dbPath });
    if (result.status === "success") {
      clearTraDataAccessGrants({ dbPath: paths.dbPath, auditDir: paths.auditDir });
      clearAgentDomainGrants({ dbPath: paths.dbPath, auditDir: paths.auditDir });
      clearAuditEvents(paths.auditDir);
      clearEvidenceLedger(paths.evidenceDir);
    }
    sendJson(res, result.status === "success" ? 200 : 500, result);
    return true;
  };
}

export function createTraStatusHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const snapshot = readGlp1CheckSnapshot({ dbPath: paths.dbPath });
    sendJson(res, 200, {
      status: "success",
      mounted: snapshot !== null,
      db_file: paths.dbPath,
      snapshot,
    });
    return true;
  };
}

export function createTraProfileSummaryHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const profile = buildTraHealthProfileSummary({ dbPath: paths.dbPath });
    sendJson(res, 200, {
      status: "success",
      mounted: profile.mounted,
      profile,
    });
    return true;
  };
}

export function createTraTablesHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const guard = requireAgentDomainGrant(req, "panel.browse", pluginConfig);
    if (!guard.ok) {
      sendJson(res, guard.status, { status: "error", message: guard.message });
      return true;
    }
    const paths = guard.paths;
    const allTables = listTraTables({ dbPath: paths.dbPath });
    const allowed = new Set(resolveAgentBrowseTables(guard.pack));
    const filtered = allTables.filter((table) => allowed.has(table));
    const catalog = filtered.map((table) => summarizeTableCatalog(table));
    sendJson(res, 200, {
      status: "success",
      agent_pack_id: guard.pack.id,
      default_tables: filtered.filter((table) =>
        (TRA_BROWSER_TABLES as readonly string[]).includes(table),
      ),
      tables: filtered,
      catalog,
      personal_tables: catalog
        .filter((row) => row.kind === "personal" || row.kind === "view")
        .map((r) => r.table),
      subscribed_tables: catalog.filter((row) => row.kind === "subscribed").map((r) => r.table),
    });
    return true;
  };
}

export function createTraBrowseSubscriptionsHandler(
  pluginConfig: TrustclawPluginConfig | undefined,
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const guard = requireAgentDomainGrant(req, "panel.browse", pluginConfig);
    if (!guard.ok) {
      sendJson(res, guard.status, { status: "error", message: guard.message });
      return true;
    }
    const snapshot = getBrowseSubscriptionSnapshot({ dbPath: guard.paths.dbPath });
    const packTables = new Set(resolveAgentBrowseTables(guard.pack));
    const quickTables = snapshot.quick_tables.filter((row) => packTables.has(row.table));
    sendJson(res, 200, {
      status: "success",
      agent_pack_id: guard.pack.id,
      pharma: snapshot.pharma,
      nrdl: snapshot.nrdl,
      quick_tables: quickTables,
    });
    return true;
  };
}

export function createTraBrowseHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }
    const guard = requireAgentDomainGrant(req, "panel.browse", pluginConfig);
    if (!guard.ok) {
      sendJson(res, guard.status, { status: "error", message: guard.message });
      return true;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const table = url.searchParams.get("table")?.trim() ?? "";
    const limitRaw = url.searchParams.get("limit") ?? "100";
    const limit = Math.min(Math.max(Number.parseInt(limitRaw, 10) || 100, 1), 500);
    if (!table) {
      sendJson(res, 400, { status: "error", message: "Missing table query parameter." });
      return true;
    }
    const paths = guard.paths;
    const packTables = new Set(resolveAgentBrowseTables(guard.pack));
    if (!packTables.has(table) || !/^[a-zA-Z0-9_]+$/.test(table)) {
      sendJson(res, 403, {
        status: "error",
        message: `Table "${table}" is not in agent pack "${guard.pack.id}" readTables.`,
      });
      return true;
    }
    try {
      const result = queryTra(`SELECT * FROM ${table} LIMIT ${limit}`, { dbPath: paths.dbPath });
      const lineage = buildTableLineage(table, { dbPath: paths.dbPath });
      sendJson(res, 200, {
        status: "success",
        agent_pack_id: guard.pack.id,
        table,
        lineage,
        ...result,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { status: "error", message });
      return true;
    }
  };
}
