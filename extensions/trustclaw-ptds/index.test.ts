// TrustClaw PTDS plugin tests cover HTTP route registration and init handler.
import { mkdtempSync, rmSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { setAgentDomainGrant } from "../../trustclaw/ptds/agent-domain-grants.js";
import { deriveAgentDomainScopes } from "../../trustclaw/ptds/agent-domain-scopes.js";
import { getAgentPackRegistry } from "../../trustclaw/runtime/agent-pack/index.js";
import plugin from "./index.js";
import manifest from "./openclaw.plugin.json" with { type: "json" };
import { createAgentChatHandler } from "./src/agent-routes.js";
import { createPtdsInitHandler } from "./src/ptds-routes.js";

const sampleInitPayload = {
  patientName: "张三",
  gender: "男",
  age: 45,
  weight: 85,
  height: 170,
  hba1c: 6.8,
  isPregnantOrLactating: false,
  hasType2Diabetes: true,
  thyroidHistory: false,
  pancreatitisHistory: false,
  cardiovascularRisk: false,
  gastrointestinalSensitivity: false,
  hasArteriosclerosis: false,
  hasCoronaryHeartDisease: false,
  hasMyocardialInfarction: false,
  hasStroke: false,
  usedMetforminBadControl: false,
  usedSulfonylureaBadControl: false,
  usedInsulinBadControl: false,
};

function createMockResponse(): ServerResponse & { getBody: () => string } {
  const state = { statusCode: 200, body: "" };
  const res = {
    setHeader: vi.fn(),
    end(chunk: string) {
      state.body = chunk;
    },
  } as unknown as ServerResponse;
  Object.defineProperty(res, "statusCode", {
    get: () => state.statusCode,
    set: (value: number) => {
      state.statusCode = value;
    },
  });
  return Object.assign(res, {
    getBody: () => state.body,
  });
}

describe("trustclaw-ptds plugin", () => {
  it("activates when plugin entry is enabled in config", () => {
    expect(manifest.activation).toEqual({
      onStartup: false,
      onConfigPaths: ["plugins.entries.trustclaw-ptds"],
    });
  });

  it("registers PTDS HTTP routes", () => {
    const routes: Array<{ path: string; auth: string; match: string }> = [];
    const registerTool = vi.fn();
    const on = vi.fn();
    plugin.register({
      registerHttpRoute(route) {
        routes.push(route as { path: string; auth: string; match: string });
      },
      registerTool,
      on,
      pluginConfig: {},
      logger: { info: vi.fn() },
    } as Parameters<typeof plugin.register>[0]);

    expect(routes.map((route) => route.path)).toEqual([
      "/api/ptds/init",
      "/api/ptds/reset",
      "/api/ptds/status",
      "/api/ptds/compliance/preview",
      "/api/ptds/compliance/import",
      "/api/ptds/compliance/import/bundled-glp1-v2",
      "/api/ptds/compliance/standards",
      "/api/ptds/compliance/rules",
      "/api/ptds/reference/preview",
      "/api/ptds/reference/sync",
      "/api/ptds/reference/status",
      "/api/ptds/reference/sync/bundled-glp1",
      "/api/ptds/device/preview",
      "/api/ptds/device/import",
      "/api/ptds/profile-summary",
      "/api/ptds/audit/events",
      "/api/ptds/ledger",
      "/api/ptds/tables",
      "/api/ptds/browse",
      "/api/ptds/agent-packs",
      "/api/ptds/agent-grants",
      "/api/ptds/session/agent-pack",
      "/api/agent/chat",
      "/trustclaw",
    ]);
    expect(routes.every((route) => route.auth === "plugin")).toBe(true);
    expect(routes.filter((route) => route.match === "exact").length).toBe(23);
    expect(routes.find((route) => route.path === "/trustclaw")?.match).toBe("prefix");
    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(on).toHaveBeenCalledWith("before_prompt_build", expect.any(Function));
    expect(on).toHaveBeenCalledWith("before_tool_call", expect.any(Function));
  });

  it("before_prompt_build injects mounted profile context when PTDS has data", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-plugin-guidance-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      const initHandler = createPtdsInitHandler({ dbPath });
      const initReq = {
        method: "POST",
        async *[Symbol.asyncIterator]() {
          yield JSON.stringify(sampleInitPayload);
        },
      } as IncomingMessage;
      const initRes = createMockResponse();
      await initHandler(initReq, initRes);

      let beforePromptBuild:
        | ((event: { messages: unknown[] }) => Promise<{ prependContext?: string }>)
        | undefined;
      plugin.register({
        registerHttpRoute() {},
        registerTool() {},
        on(event, handler) {
          if (event === "before_prompt_build") {
            beforePromptBuild = handler as typeof beforePromptBuild;
          }
        },
        pluginConfig: { dbPath },
        logger: { info: vi.fn() },
      } as Parameters<typeof plugin.register>[0]);

      const result = await beforePromptBuild!({ messages: [] });
      expect(result.prependContext).toContain("Mounted PTDS profile");
      expect(result.prependContext).toContain("PTDS profile briefing");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("before_prompt_build injects C3-PO PTDS system context", async () => {
    let beforePromptBuild: (() => Promise<{ prependSystemContext?: string }>) | undefined;
    plugin.register({
      registerHttpRoute() {},
      registerTool() {},
      on(event, handler) {
        if (event === "before_prompt_build") {
          beforePromptBuild = handler as typeof beforePromptBuild;
        }
      },
      pluginConfig: {},
      logger: { info: vi.fn() },
    } as Parameters<typeof plugin.register>[0]);

    expect(beforePromptBuild).toBeDefined();
    const result = await beforePromptBuild!();
    expect(result.prependSystemContext).toContain("C3-PO");
    expect(result.prependSystemContext).toContain("trustclaw_ptds_query");
    expect(result.prependSystemContext).toContain("trustclaw_ptds_write");
    expect(result.prependSystemContext).toMatch(/consent approval/i);
    expect(result.prependSystemContext).toMatch(/not.*Claude Code/i);
  });

  it("handles POST /api/ptds/init with frozen contract shape", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-plugin-init-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      const handler = createPtdsInitHandler({ dbPath });
      const req = {
        method: "POST",
        async *[Symbol.asyncIterator]() {
          yield JSON.stringify(sampleInitPayload);
        },
      } as IncomingMessage;
      const res = createMockResponse();
      const handled = await handler(req, res);
      expect(handled).toBe(true);
      expect(res.statusCode).toBe(200);
      const payload = JSON.parse(res.getBody()) as {
        status: string;
        records_inserted: number;
        db_file: string;
      };
      expect(payload.status).toBe("success");
      expect(payload.records_inserted).toBeGreaterThanOrEqual(4);
      expect(payload.db_file).toBe(dbPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles POST /api/agent/chat with Runtime Context contract", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-plugin-chat-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "ptds-audit");
    try {
      const initHandler = createPtdsInitHandler({ dbPath, auditDir });
      const initReq = {
        method: "POST",
        async *[Symbol.asyncIterator]() {
          yield JSON.stringify(sampleInitPayload);
        },
      } as IncomingMessage;
      const initRes = createMockResponse();
      await initHandler(initReq, initRes);
      expect(initRes.statusCode).toBe(200);

      const glp1Pack = getAgentPackRegistry().get("glp1-eligibility")!;
      setAgentDomainGrant(glp1Pack.id, deriveAgentDomainScopes(glp1Pack), { dbPath, auditDir });

      const chatHandler = createAgentChatHandler(
        { dbPath, auditDir },
        {
          llm: async () =>
            "SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = 'local_user' LIMIT 1",
        },
      );
      const chatReq = {
        method: "POST",
        async *[Symbol.asyncIterator]() {
          yield JSON.stringify({
            session_id: "sess_plugin_test",
            message: "我可以用司美格鲁肽吗？",
            agent_pack_id: glp1Pack.id,
          });
        },
      } as IncomingMessage;
      const chatRes = createMockResponse();
      const handled = await chatHandler(chatReq, chatRes);
      expect(handled).toBe(true);
      expect(chatRes.statusCode).toBe(200);
      const payload = JSON.parse(chatRes.getBody()) as {
        session_id: string;
        pipeline_stages: { agent_decision: { response: string } };
        audit_trail_id: string;
      };
      expect(payload.session_id).toBe("sess_plugin_test");
      expect(payload.pipeline_stages.agent_decision.response).toContain("Evidence");
      expect(payload.audit_trail_id).toMatch(/^aud_/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
