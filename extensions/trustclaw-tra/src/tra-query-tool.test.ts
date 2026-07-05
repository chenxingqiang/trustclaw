import { mkdtempSync, rmSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { createTrustclawTraQueryToolFactory } from "./tra-query-tool.js";
import { createTraInitHandler } from "./tra-routes.js";

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

describe("trustclaw_tra_query tool", () => {
  it("runs the TRA pipeline and returns Runtime Context in tool details", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-tool-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      const initHandler = createTraInitHandler({ dbPath });
      const initReq = {
        method: "POST",
        async *[Symbol.asyncIterator]() {
          yield JSON.stringify(sampleInitPayload);
        },
      } as IncomingMessage;
      const initRes = createMockResponse();
      await initHandler(initReq, initRes);
      expect(initRes.statusCode).toBe(200);

      const factory = createTrustclawTraQueryToolFactory(
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
