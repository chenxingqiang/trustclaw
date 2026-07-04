import { mkdtempSync, rmSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { createTrustclawPtdsQueryToolFactory } from "./ptds-query-tool.js";
import { createPtdsInitHandler } from "./ptds-routes.js";

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

describe("trustclaw_ptds_query tool", () => {
  it("runs the PTDS pipeline and returns Runtime Context in tool details", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-tool-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      const initHandler = createPtdsInitHandler({ dbPath });
      const initReq = {
        method: "POST",
        async *[Symbol.asyncIterator]() {
          yield JSON.stringify({
            weight: 85,
            height: 170,
            hba1c: 6.8,
            thyroid_cancer_history: 0,
            pancreatitis_history: 0,
            include_t2dm_diagnosis: true,
          });
        },
      } as IncomingMessage;
      const initRes = createMockResponse();
      await initHandler(initReq, initRes);
      expect(initRes.statusCode).toBe(200);

      const factory = createTrustclawPtdsQueryToolFactory(
        { dbPath },
        {
          llm: async () =>
            "SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = 'local_user' LIMIT 1",
        },
      );
      const tool = factory({ sessionKey: "agent:main:main", sandboxed: false });
      expect(tool).not.toBeNull();
      const result = await tool!.execute("call-1", {
        message: "Can I use semaglutide?",
      });
      const details = (result as { details?: { trustclaw?: { runtime_context?: unknown } } })
        .details;
      const context = details?.trustclaw?.runtime_context as {
        audit_trail_id: string;
        pipeline_stages: { agent_decision: { response: string } };
      };
      expect(context.audit_trail_id).toMatch(/^aud_/);
      expect(context.pipeline_stages.agent_decision.response).toContain("Evidence");
      expect((result as { content: Array<{ text: string }> }).content[0]?.text).toContain(
        "Evidence",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
