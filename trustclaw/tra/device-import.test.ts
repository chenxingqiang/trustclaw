import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readAuditEvents } from "../audit/index.js";
import { applyTraInitRequest, bootstrapTraDatabase } from "./db.js";
import {
  executeDeviceImportStatements,
  hashDeviceImportStatements,
  importDeviceData,
  previewDeviceImport,
} from "./device-import.js";
import { TRA_INIT_DEFAULTS, type TraInitRequest } from "./types.js";

const initRequest: TraInitRequest = {
  ...TRA_INIT_DEFAULTS,
  patientName: "设备导入测试",
  gender: "男",
  age: 40,
  weight: 75,
  height: 175,
  hba1c: 6.1,
};

const sampleSql = [
  "INSERT OR IGNORE INTO data_source_registry (source_id, source_name, source_category, reliability_level) VALUES ('WEARABLE_API', 'Third-party device API', 'WEARABLE', 2)",
  "INSERT OR IGNORE INTO device_registry (device_id, brand_name, model_name) VALUES ('OURA_DEMO', 'Oura', 'Ring 4')",
  `INSERT INTO wearable_activity_metrics (device_id, recorded_date, steps, total_burn_kcal, active_burn_kcal)
   VALUES ('OURA_DEMO', '2026-07-01', 8432, 2100, 420)`,
];

const mockLlm = async () => sampleSql.join(";\n");

describe("device-import", () => {
  it("previews INSERT SQL from device API JSON via Text2SQL path", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-device-preview-"));
    const dbPath = path.join(dir, "local_tra.db");
    const db = bootstrapTraDatabase(dbPath);
    applyTraInitRequest(db, initRequest);
    db.close();

    const preview = await previewDeviceImport(
      {
        deviceHint: "Oura Ring demo export",
        package: {
          device: { id: "OURA_DEMO", brand: "Oura" },
          activity: { date: "2026-07-01", steps: 8432 },
        },
      },
      { llm: mockLlm, dbPathOrOverrides: { dbPath } },
    );

    expect(preview.status).toBe("success");
    expect(preview.sql_statements?.length).toBeGreaterThanOrEqual(2);
    expect(preview.tables).toContain("wearable_activity_metrics");
    expect(preview.sql_hash).toMatch(/^[a-f0-9]{64}$/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("imports device SQL after consent and writes audit", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-device-import-"));
    const dbPath = path.join(dir, "local_tra.db");
    const auditDir = path.join(dir, "audit");
    const db = bootstrapTraDatabase(dbPath);
    applyTraInitRequest(db, initRequest);
    db.close();

    const sqlHash = hashDeviceImportStatements(sampleSql);
    const result = await importDeviceData(
      {
        consentGranted: true,
        sessionId: "ui_device_test",
        agentPackId: "glp1-eligibility",
        sourceLabel: "demo-oura.json",
        package: { demo: true },
        sql_statements: sampleSql,
        sql_hash: sqlHash,
      },
      { dbPathOrOverrides: { dbPath, auditDir } },
    );

    expect(result.status).toBe("success");
    expect(result.rows_affected).toBeGreaterThan(0);

    const verifyDb = bootstrapTraDatabase(dbPath);
    const steps = verifyDb
      .prepare(
        "SELECT steps FROM wearable_activity_metrics WHERE device_id = 'OURA_DEMO' ORDER BY activity_log_id DESC LIMIT 1",
      )
      .get() as { steps: number };
    expect(steps.steps).toBe(8432);
    verifyDb.close();

    const events = readAuditEvents({ auditDir, steps: ["DEVICE_IMPORT"] });
    expect(events.at(-1)?.status).toBe("SUCCESS");
    rmSync(dir, { recursive: true, force: true });
  });

  it("blocks import without consent", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-device-block-"));
    const dbPath = path.join(dir, "local_tra.db");
    const auditDir = path.join(dir, "audit");
    const db = bootstrapTraDatabase(dbPath);
    applyTraInitRequest(db, initRequest);
    db.close();

    const sqlHash = hashDeviceImportStatements(sampleSql);
    const result = await importDeviceData(
      {
        consentGranted: false,
        sessionId: "ui_device_denied",
        agentPackId: "glp1-eligibility",
        sql_statements: sampleSql,
        sql_hash: sqlHash,
        package: {},
      },
      { dbPathOrOverrides: { dbPath, auditDir } },
    );
    expect(result.status).toBe("error");
    const events = readAuditEvents({ auditDir, steps: ["DEVICE_IMPORT"] });
    expect(events.at(-1)?.status).toBe("BLOCKED");
    rmSync(dir, { recursive: true, force: true });
  });

  it("executes validated INSERT statements in a transaction", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-device-exec-"));
    const dbPath = path.join(dir, "local_tra.db");
    const db = bootstrapTraDatabase(dbPath);
    applyTraInitRequest(db, initRequest);
    const rows = executeDeviceImportStatements(db, sampleSql);
    expect(rows).toBeGreaterThan(0);
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
