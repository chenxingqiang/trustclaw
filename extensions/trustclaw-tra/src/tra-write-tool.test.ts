import { mkdtempSync, rmSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createTraInitHandler } from "./tra-routes.js";
import { createTrustclawTraWriteToolFactory } from "./tra-write-tool.js";

const sampleInitPayload = {
  patientName: "张三",
  gender: "男",
  age: 45,
  weight: 82,
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

const personalWriteSql = [
  `INSERT INTO body_anthropometrics (recorded_at, height_m, weight_kg, source_id, provenance_level, recorder_user_id)
   VALUES ('2026-10-03T00:00:00Z', 1.70, 72, 'PATIENT_SELF_REPORT', 1, 'local_user')`,
];

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

describe("trustclaw_tra_write tool", () => {
  it("writes personal data and returns row counts in tool details", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-write-tool-"));
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

      const factory = createTrustclawTraWriteToolFactory(
        { dbPath },
        { llm: async () => personalWriteSql.join(";\n") },
      );
      const tool = factory({ sessionKey: "agent:main:main", sandboxed: false });
      expect(tool).not.toBeNull();

      const result = await tool!.execute("call-write-1", {
        message: "90天后体重72kg",
      });
      const text = (result as { content: Array<{ text: string }> }).content[0]?.text ?? "";
      expect(text).toContain("已写入可信运行时");
      const details = (
        result as { details?: { trustclaw?: { personal_write?: { status: string } } } }
      ).details;
      expect(details?.trustclaw?.personal_write?.status).toBe("success");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
