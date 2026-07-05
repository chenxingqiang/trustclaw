import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  bootstrapTraDatabase,
  initializeTra,
  listTraTables,
  TRA_LOCAL_USER_ID,
  TraQuerySecurityError,
  queryTra,
  readGlp1CheckSnapshot,
  assertReadOnlySelectSql,
  buildTableLineage,
  classifyTraTable,
  TRA_BROWSER_DEFAULT_TABLES,
} from "./index.js";
import { TRA_INIT_DEFAULTS } from "./types.js";

describe("trustclaw/tra", () => {
  it("bootstraps schema v1.1 and NRDL seed rules", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-tra-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      const db = bootstrapTraDatabase(dbPath);
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='data_source_registry'",
        )
        .get();
      expect(tables).toBeTruthy();

      const drugCount = db.prepare("SELECT COUNT(*) AS count FROM nrdl_drug_registry").get() as {
        count: number;
      };
      expect(drugCount.count).toBeGreaterThan(0);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("initializes personal data from frozen init API shape", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-tra-init-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      const result = initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          weight: 85,
          height: 170,
          hba1c: 6.8,
          hasType2Diabetes: true,
        },
        dbPath,
      );
      expect(result.status).toBe("success");
      expect(result.records_inserted).toBeGreaterThanOrEqual(4);

      const snapshot = readGlp1CheckSnapshot(dbPath);
      expect(snapshot).toMatchObject({
        user_id: TRA_LOCAL_USER_ID,
        has_t2dm: 1,
        has_absolute_contraindication: 0,
      });
      expect(snapshot?.latest_hospital_hba1c).toBeNull();

      const db = new DatabaseSync(dbPath);
      const bmiRow = db
        .prepare("SELECT bmi FROM body_anthropometrics ORDER BY body_id DESC LIMIT 1")
        .get() as { bmi: number };
      expect(bmiRow.bmi).toBeCloseTo(29.4, 1);

      const profile = db
        .prepare("SELECT name, biological_sex FROM user_profile WHERE user_id = ?")
        .get(TRA_LOCAL_USER_ID) as { name: string; biological_sex: number };
      expect(profile.name).toBe("张三");
      expect(profile.biological_sex).toBe(1);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records absolute contraindications in snapshot view", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-tra-contra-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          weight: 80,
          height: 175,
          hba1c: 7.2,
          hasType2Diabetes: false,
          thyroidHistory: true,
        },
        dbPath,
      );
      const snapshot = readGlp1CheckSnapshot(dbPath);
      expect(snapshot?.has_absolute_contraindication).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores prior oral therapy flags in snapshot view", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-tra-med-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          hasType2Diabetes: true,
          usedMetforminBadControl: true,
          usedSulfonylureaBadControl: true,
        },
        dbPath,
      );
      const snapshot = readGlp1CheckSnapshot(dbPath);
      expect(snapshot?.prior_oral_therapy_status).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows SELECT-only queries and blocks writes", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-tra-query-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          weight: 85,
          height: 170,
          hba1c: 6.8,
        },
        dbPath,
      );

      const result = queryTra(
        "SELECT weight_kg, bmi FROM body_anthropometrics ORDER BY body_id DESC LIMIT 1",
        dbPath,
      );
      expect(result.row_count).toBe(1);
      expect(result.rows[0]?.weight_kg).toBe(85);

      expect(() => assertReadOnlySelectSql("DELETE FROM user_profile")).toThrow(
        TraQuerySecurityError,
      );
      expect(() =>
        queryTra(
          `UPDATE user_profile SET name = 'x' WHERE user_id = '${TRA_LOCAL_USER_ID}'`,
          dbPath,
        ),
      ).toThrow(TraQuerySecurityError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists tables for TRA browser", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-tra-list-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      bootstrapTraDatabase(dbPath);
      const tables = listTraTables(dbPath);
      expect(tables).toContain("body_anthropometrics");
      expect(tables).toContain("v_glp1_nrdl_check_snapshot");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("classifies subscribed tables for Panel B browser defaults", () => {
    expect(classifyTraTable("medication_compliance_standards")).toBe("subscribed");
    expect(classifyTraTable("nrdl_payment_rules")).toBe("subscribed");
    expect(TRA_BROWSER_DEFAULT_TABLES).toContain("nrdl_reference_sync_state");
  });

  it("builds lineage graph with source registry after init", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-tra-lineage-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      bootstrapTraDatabase(dbPath);
      initializeTra({ ...TRA_INIT_DEFAULTS, weight: 80, height: 170, hba1c: 6.5 }, dbPath);
      const lineage = buildTableLineage("lab_test_results", dbPath);
      expect(lineage.provenance_fields).toContain("source_id");
      expect(lineage.live?.source_ids?.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
