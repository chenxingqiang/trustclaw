import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAgentPackRegistry,
  resetAgentPackRegistryCache,
  resolveDefaultAgentsDir,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import { createAgentPacksHandler } from "./agent-pack-routes.js";

const tempAgentsDirs: string[] = [];

afterEach(() => {
  resetAgentPackRegistryCache();
  for (const dir of tempAgentsDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createWritableAgentsDir(): string {
  const agentsDir = mkdtempSync(path.join(tmpdir(), "trustclaw-agent-packs-"));
  cpSync(path.join(resolveDefaultAgentsDir(), "glp1"), path.join(agentsDir, "glp1"), {
    recursive: true,
  });
  tempAgentsDirs.push(agentsDir);
  return agentsDir;
}

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

describe("GET /api/tra/agent-packs", () => {
  const handler = createAgentPacksHandler(undefined);

  it("lists packs with extension_points for authoring", async () => {
    const req = { method: "GET", url: "/api/tra/agent-packs" } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.getBody()) as {
      packs: { id: string }[];
      extension_points: { ruleEngines: string[] };
      schema_ref: string;
    };
    expect(body.packs.map((pack) => pack.id)).toContain("glp1-eligibility");
    expect(body.extension_points.ruleEngines).toContain("none");
    expect(body.schema_ref).toContain("agent-pack.v1.json");
  });

  it("returns extension-points subpath", async () => {
    const req = {
      method: "GET",
      url: "/api/tra/agent-packs/extension-points",
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.getBody()) as { decisionBuilders: string[] };
    expect(body.decisionBuilders).toContain("pass-through");
  });

  it("returns pack detail by id", async () => {
    const req = {
      method: "GET",
      url: "/api/tra/agent-packs/compliance-auditor",
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.getBody()) as {
      pack: { id: string; rules: { engine: string }; prompts: { system: string } };
    };
    expect(body.pack.id).toBe("compliance-auditor");
    expect(body.pack.rules.engine).toBe("none");
    expect(body.pack.prompts.system).toContain("prompts/");
  });

  it("returns 404 for unknown pack id", async () => {
    const req = {
      method: "GET",
      url: "/api/tra/agent-packs/not-a-real-pack",
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/tra/agent-packs/validate", () => {
  const handler = createAgentPacksHandler(undefined);

  it("accepts a valid pack manifest without writing to disk", async () => {
    const pack = getAgentPackRegistry().get("nrdl-reimburse")!;
    const { packDir: _packDir, packFile: _packFile, ...manifest } = pack;
    const req = {
      method: "POST",
      url: "/api/tra/agent-packs/validate",
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify(manifest);
      },
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.getBody()) as { valid: boolean; pack: { id: string } };
    expect(body.valid).toBe(true);
    expect(body.pack.id).toBe("nrdl-reimburse");
  });

  it("returns structured validation issues for invalid manifests", async () => {
    const req = {
      method: "POST",
      url: "/api/tra/agent-packs/validate",
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify({ id: "BAD ID" });
      },
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.getBody()) as {
      code: string;
      valid: boolean;
      issues: { path: string; message: string }[];
    };
    expect(body.code).toBe("invalid_agent_pack");
    expect(body.valid).toBe(false);
    expect(body.issues.length).toBeGreaterThan(0);
  });
});

describe("PUT /api/tra/agent-packs/<packId>", () => {
  it("returns 403 when agentPacksDir is not configured", async () => {
    const handler = createAgentPacksHandler(undefined);
    const req = {
      method: "PUT",
      url: "/api/tra/agent-packs/glp1-eligibility",
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify({ id: "glp1-eligibility", version: "1.0.0" });
      },
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.getBody()) as { code: string };
    expect(body.code).toBe("pack_write_disabled");
  });

  it("writes a validated manifest under agentPacksDir", async () => {
    const agentsDir = createWritableAgentsDir();
    const handler = createAgentPacksHandler({
      agentPacksDir: agentsDir,
      defaultAgentPack: "glp1-eligibility",
    });
    const pack = getAgentPackRegistry({
      agentsDir,
      defaultAgentPack: "glp1-eligibility",
    }).get("glp1-eligibility")!;
    const { packDir: _packDir, packFile: _packFile, ...manifest } = pack;
    const updated = { ...manifest, version: "9.9.9-loop-test" };
    const req = {
      method: "PUT",
      url: "/api/tra/agent-packs/glp1-eligibility",
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify(updated);
      },
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.getBody()) as { pack: { version: string } };
    expect(body.pack.version).toBe("9.9.9-loop-test");
    const written = JSON.parse(
      readFileSync(path.join(agentsDir, "glp1", "agent.pack.json"), "utf8"),
    ) as { version: string };
    expect(written.version).toBe("9.9.9-loop-test");
  });
});

const LOOP_R32_PACK = {
  id: "loop-r32-pack",
  version: "0.0.1",
  displayName: { "zh-CN": "R32 测试包", en: "R32 test pack" },
  tools: { read: "trustclaw_tra_query" },
  prompts: { system: "prompts/system.v1.md" },
  data: { readTables: ["data_source_registry"] },
  rules: { engine: "none" as const },
  pipeline: {
    stages: ["TEXT2SQL_GEN", "DB_QUERY", "AGENT_DECISION"],
    decisionBuilder: "pass-through" as const,
  },
  consent: { read: { allowAlways: false } },
  audit: {
    businessComponent: "TRA.Agent.LoopR32",
    decisionComponent: "Agent.LoopR32Decision",
  },
};

describe("POST /api/tra/agent-packs", () => {
  it("creates a new pack under agentPacksDir", async () => {
    const agentsDir = createWritableAgentsDir();
    const handler = createAgentPacksHandler({
      agentPacksDir: agentsDir,
      defaultAgentPack: "glp1-eligibility",
    });
    const req = {
      method: "POST",
      url: "/api/tra/agent-packs",
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify(LOOP_R32_PACK);
      },
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    resetAgentPackRegistryCache();
    const registry = getAgentPackRegistry({
      agentsDir,
      defaultAgentPack: "glp1-eligibility",
    });
    expect(registry.get("loop-r32-pack")?.id).toBe("loop-r32-pack");
  });

  it("returns 409 when pack id already exists", async () => {
    const agentsDir = createWritableAgentsDir();
    const handler = createAgentPacksHandler({
      agentPacksDir: agentsDir,
      defaultAgentPack: "glp1-eligibility",
    });
    const req = {
      method: "POST",
      url: "/api/tra/agent-packs",
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify(LOOP_R32_PACK);
      },
    } as IncomingMessage;
    await handler(req, createMockResponse());
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(409);
  });
});

describe("DELETE /api/tra/agent-packs/<packId>", () => {
  it("deletes a non-default pack from agentPacksDir", async () => {
    const agentsDir = createWritableAgentsDir();
    const handler = createAgentPacksHandler({
      agentPacksDir: agentsDir,
      defaultAgentPack: "glp1-eligibility",
    });
    const createReq = {
      method: "POST",
      url: "/api/tra/agent-packs",
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify(LOOP_R32_PACK);
      },
    } as IncomingMessage;
    await handler(createReq, createMockResponse());
    const deleteReq = {
      method: "DELETE",
      url: "/api/tra/agent-packs/loop-r32-pack",
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(deleteReq, res);
    expect(res.statusCode).toBe(200);
    resetAgentPackRegistryCache();
    const registry = getAgentPackRegistry({
      agentsDir,
      defaultAgentPack: "glp1-eligibility",
    });
    expect(registry.get("loop-r32-pack")).toBeUndefined();
  });

  it("refuses to delete the default pack", async () => {
    const agentsDir = createWritableAgentsDir();
    const handler = createAgentPacksHandler({
      agentPacksDir: agentsDir,
      defaultAgentPack: "glp1-eligibility",
    });
    const req = {
      method: "DELETE",
      url: "/api/tra/agent-packs/glp1-eligibility",
    } as IncomingMessage;
    const res = createMockResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.getBody()) as { code: string };
    expect(body.code).toBe("default_pack_protected");
  });
});
