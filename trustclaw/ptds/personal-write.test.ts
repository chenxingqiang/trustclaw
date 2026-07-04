import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readAuditEvents } from "../audit/index.js";
import { applyPtdsInitRequest, bootstrapPtdsDatabase } from "./db.js";
import { executePersonalWrite, previewPersonalWrite } from "./personal-write.js";
import { PTDS_INIT_DEFAULTS, type PtdsInitRequest } from "./types.js";

const initRequest: PtdsInitRequest = {
  ...PTDS_INIT_DEFAULTS,
  patientName: "写入测试",
  gender: "男",
  age: 45,
  weight: 82,
  height: 170,
  hba1c: 6.8,
};

const personalWriteSql = [
  `INSERT INTO body_anthropometrics (recorded_at, height_m, weight_kg, source_id, provenance_level, recorder_user_id)
   VALUES ('2026-10-03T00:00:00Z', 1.70, 72, 'PATIENT_SELF_REPORT', 1, 'local_user')`,
  `INSERT INTO lab_test_results (recorded_at, test_code, test_value, test_unit, clinical_status, source_id, provenance_level)
   VALUES ('2026-10-03T00:00:00Z', 'HbA1c', 6.5, '%', 'HIGH', 'PATIENT_SELF_REPORT', 1)`,
];

const mockLlm = async () => personalWriteSql.join(";\n");

describe("personal-write", () => {
  it("previews INSERT SQL from chat write request via Text2SQL", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-personal-preview-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const db = bootstrapPtdsDatabase(dbPath);
    applyPtdsInitRequest(db, initRequest);
    db.close();

    const preview = await previewPersonalWrite("90天后体重72kg，HbA1c 6.5%", {
      llm: mockLlm,
      dbPathOrOverrides: { dbPath },
    });

    expect(preview.status).toBe("success");
    expect(preview.tables).toContain("body_anthropometrics");
    expect(preview.tables).toContain("lab_test_results");
    rmSync(dir, { recursive: true, force: true });
  });

  it("executes personal write after consent and records DEVICE_IMPORT audit", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-personal-exec-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "audit");
    const db = bootstrapPtdsDatabase(dbPath);
    applyPtdsInitRequest(db, initRequest);
    db.close();

    const result = await executePersonalWrite(
      {
        message: "90天后体重72kg，HbA1c 6.5%",
        consentGranted: true,
        sessionId: "chat_write_test",
        agentPackId: "glp1-eligibility",
      },
      { llm: mockLlm, dbPathOrOverrides: { dbPath, auditDir } },
    );

    expect(result.status).toBe("success");
    expect(result.rows_affected).toBeGreaterThanOrEqual(2);

    const events = readAuditEvents({ auditDir, steps: ["DEVICE_IMPORT"] });
    const importEvent = events.find((event) => event.step === "DEVICE_IMPORT");
    expect(importEvent?.input.agent_pack_id).toBe("glp1-eligibility");
    expect(importEvent?.status).toBe("SUCCESS");

    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects write when consent is not granted", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-personal-deny-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "audit");
    const db = bootstrapPtdsDatabase(dbPath);
    applyPtdsInitRequest(db, initRequest);
    db.close();

    const result = await executePersonalWrite(
      {
        message: "record weight 72kg",
        consentGranted: false,
        sessionId: "chat_deny",
        agentPackId: "glp1-eligibility",
      },
      { llm: mockLlm, dbPathOrOverrides: { dbPath, auditDir } },
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("consent");
    rmSync(dir, { recursive: true, force: true });
  });
});
