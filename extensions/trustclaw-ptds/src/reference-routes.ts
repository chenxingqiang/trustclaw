import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  resolveTrustclawPaths,
  type TrustclawPluginConfig,
} from "../../../trustclaw/ptds/config.js";
import {
  fetchReferencePackageFromUrl,
  getNrdlReferenceStatus,
  previewNrdlReferencePackage,
  syncNrdlReferencePackage,
} from "../../../trustclaw/ptds/index.js";
import { requireAgentDomainGrant } from "./agent-grant-guard.js";
import { methodIs, readJsonBody, sendJson } from "./http-utils.js";

const previewRequestSchema = z
  .object({
    package: z.unknown().optional(),
    url: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((body) => body.package !== undefined || body.url !== undefined, {
    message: "Provide package or url.",
  });

const syncRequestSchema = z
  .object({
    consentGranted: z.boolean(),
    sessionId: z.string().trim().min(1),
    sourceLabel: z.string().trim().min(1).optional(),
    package: z.unknown().optional(),
    url: z.string().trim().min(1).optional(),
    saveSubscriptionUrl: z.boolean().optional(),
  })
  .strict()
  .refine((body) => body.package !== undefined || body.url !== undefined, {
    message: "Provide package or url.",
  });

function pathOverrides(pluginConfig: TrustclawPluginConfig | undefined) {
  return resolveTrustclawPaths(pluginConfig);
}

async function resolvePackageBody(body: {
  package?: unknown;
  url?: string;
}): Promise<{ ok: true; package: unknown } | { ok: false; message: string }> {
  if (body.package !== undefined) {
    return { ok: true, package: body.package };
  }
  const url = body.url?.trim();
  if (!url) {
    return { ok: false, message: "Provide package or url." };
  }
  try {
    const pkg = await fetchReferencePackageFromUrl(url);
    return { ok: true, package: pkg };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }
}

export function createReferencePreviewHandler(pluginConfig: TrustclawPluginConfig | undefined) {
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
      sendJson(res, 400, { status: "error", message: "Invalid reference preview payload." });
      return true;
    }
    const resolved = await resolvePackageBody(body.data);
    if (!resolved.ok) {
      sendJson(res, 400, { status: "error", message: resolved.message });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const result = previewNrdlReferencePackage(resolved.package, {
      dbPath: paths.dbPath,
      auditDir: paths.auditDir,
    });
    sendJson(res, result.status === "success" ? 200 : 400, result);
    return true;
  };
}

export function createReferenceSyncHandler(pluginConfig: TrustclawPluginConfig | undefined) {
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
    const body = syncRequestSchema.safeParse(parsed.body);
    if (!body.success) {
      sendJson(res, 400, { status: "error", message: "Invalid reference sync payload." });
      return true;
    }
    const paths = pathOverrides(pluginConfig);
    const result = await syncNrdlReferencePackage(
      {
        consentGranted: body.data.consentGranted,
        sessionId: body.data.sessionId,
        agentPackId: guard.pack.id,
        sourceLabel: body.data.sourceLabel,
        package: body.data.package,
        url: body.data.url,
        saveSubscriptionUrl: body.data.saveSubscriptionUrl,
      },
      { dbPath: paths.dbPath, auditDir: paths.auditDir },
    );
    sendJson(res, result.status === "success" ? 200 : 400, result);
    return true;
  };
}

export function createReferenceStatusHandler(pluginConfig: TrustclawPluginConfig | undefined) {
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
    const result = getNrdlReferenceStatus({ dbPath: paths.dbPath, auditDir: paths.auditDir });
    sendJson(res, 200, result);
    return true;
  };
}

/** Dev helper: sync bundled NRDL GLP-1 reference package after consent. */
export function createReferenceSyncBundledHandler(
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
      sendJson(res, 400, { status: "error", message: "Invalid bundled reference sync payload." });
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
    const result = await syncNrdlReferencePackage(
      {
        consentGranted: body.data.consentGranted,
        sessionId: body.data.sessionId,
        agentPackId: guard.pack.id,
        sourceLabel: "nrdl-reference-glp1-v1.json",
        package: pkg,
      },
      { dbPath: paths.dbPath, auditDir: paths.auditDir },
    );
    sendJson(res, result.status === "success" ? 200 : 400, result);
    return true;
  };
}
