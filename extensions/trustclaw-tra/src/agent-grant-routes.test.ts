import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAgentPackRegistry } from "../../../trustclaw/runtime/agent-pack/index.js";
import { recordAgentDomainGrantAudit } from "../../../trustclaw/tra/agent-domain-grant-audit.js";
import {
  hasAgentDomainGrant,
  setAgentDomainGrant,
} from "../../../trustclaw/tra/agent-domain-grants.js";
import { deriveAgentDomainScopes } from "../../../trustclaw/tra/agent-domain-scopes.js";
import { createAgentGrantsGetHandler } from "./agent-grant-routes.js";

function mockRes(): { res: { statusCode: number; body: string }; getBody: () => unknown } {
  const state = { statusCode: 200, body: "" };
  const res = {
    setHeader: () => {},
    end(chunk: string) {
      state.body = chunk;
    },
  } as never;
  Object.defineProperty(res, "statusCode", {
    get: () => state.statusCode,
    set: (value: number) => {
      state.statusCode = value;
    },
  });
  return {
    res,
    getBody: () => JSON.parse(state.body || "{}"),
  };
}

describe("agent-grant-routes", () => {
  it("GET lists packs with available and granted scopes", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-grants-get-"));
    const auditDir = path.join(dir, "audit");
    const pack = getAgentPackRegistry().get("glp1-eligibility")!;
    setAgentDomainGrant(pack.id, ["tra.chat"], { auditDir, dbPath: path.join(dir, "db") });

    const handler = createAgentGrantsGetHandler({ auditDir, dbPath: path.join(dir, "db") });
    const { res, getBody } = mockRes();
    await handler({ method: "GET", url: "/api/tra/agent-grants" } as never, res);
    const body = getBody() as { packs: Array<{ id: string; granted_scopes: string[] }> };
    const row = body.packs.find((p) => p.id === pack.id);
    expect(row?.granted_scopes).toContain("tra.chat");
    rmSync(dir, { recursive: true, force: true });
  });

  it("GET returns AGENT_DOMAIN_GRANT history newest first", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-grants-history-"));
    const auditDir = path.join(dir, "audit");
    const dbPath = path.join(dir, "db");
    const pack = getAgentPackRegistry().get("glp1-eligibility")!;
    recordAgentDomainGrantAudit({
      sessionId: "sess-1",
      agentPackId: pack.id,
      scopes: ["tra.chat"],
      granted: true,
      auditDir,
    });
    recordAgentDomainGrantAudit({
      sessionId: "sess-2",
      agentPackId: pack.id,
      scopes: ["tra.chat", "panel.browse"],
      granted: true,
      auditDir,
    });

    const handler = createAgentGrantsGetHandler({ auditDir, dbPath });
    const { res, getBody } = mockRes();
    await handler({ method: "GET", url: "/api/tra/agent-grants" } as never, res);
    const body = getBody() as {
      history: Array<{ agent_pack_id: string; scopes: string[] }>;
    };
    expect(body.history.length).toBeGreaterThanOrEqual(2);
    const scopes = body.history.flatMap((row) => row.scopes);
    expect(scopes).toContain("panel.browse");
    expect(scopes).toContain("tra.chat");
    rmSync(dir, { recursive: true, force: true });
  });

  it("PUT persists scoped grants via store", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-grants-put-"));
    const auditDir = path.join(dir, "audit");
    const dbPath = path.join(dir, "db");
    const pack = getAgentPackRegistry().get("compliance-auditor")!;
    const scopes = deriveAgentDomainScopes(pack).filter((scope) => scope === "panel.compliance");
    setAgentDomainGrant(pack.id, scopes, { auditDir, dbPath });
    expect(hasAgentDomainGrant(pack.id, "panel.compliance", { auditDir, dbPath })).toBe(true);
    setAgentDomainGrant(pack.id, [], { auditDir, dbPath });
    expect(hasAgentDomainGrant(pack.id, "panel.compliance", { auditDir, dbPath })).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});
