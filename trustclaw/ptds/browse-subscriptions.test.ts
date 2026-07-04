import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getBrowseSubscriptionSnapshot,
  importComplianceStandardPackage,
  initializePtds,
  PTDS_INIT_DEFAULTS,
  PTDS_SEED_GLP1_AST_V2_JSON,
  syncNrdlReferencePackage,
  PTDS_SEED_NRDL_REFERENCE_GLP1_JSON,
} from "./index.js";

describe("trustclaw/ptds browse subscriptions", () => {
  const seedCompliance = JSON.parse(readFileSync(PTDS_SEED_GLP1_AST_V2_JSON, "utf8"));
  const seedReference = JSON.parse(readFileSync(PTDS_SEED_NRDL_REFERENCE_GLP1_JSON, "utf8"));

  it("reports inactive pharma and unsynced NRDL before Panel F imports", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-browse-sub-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      initializePtds(PTDS_INIT_DEFAULTS, dbPath);
      const snapshot = getBrowseSubscriptionSnapshot(dbPath);
      expect(snapshot.pharma.active).toBe(false);
      expect(snapshot.nrdl.synced).toBe(false);
      expect(snapshot.quick_tables.some((row) => row.table === "nrdl_payment_rules")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reflects compliance and NRDL imports in browse subscription snapshot", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-browse-sub-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "audit");
    try {
      initializePtds(PTDS_INIT_DEFAULTS, dbPath);

      const compliance = importComplianceStandardPackage(
        {
          consentGranted: true,
          sessionId: "sess_browse_sub",
          agentPackId: "glp1",
          package: seedCompliance,
        },
        { dbPath, auditDir },
      );
      expect(compliance.status).toBe("success");

      const reference = await syncNrdlReferencePackage(
        {
          consentGranted: true,
          sessionId: "sess_browse_sub_nrdl",
          agentPackId: "nrdl-reimburse",
          package: seedReference,
        },
        { dbPath, auditDir },
      );
      expect(reference.status).toBe("success");

      const snapshot = getBrowseSubscriptionSnapshot({ dbPath, auditDir });
      expect(snapshot.pharma.active).toBe(true);
      expect(snapshot.pharma.standard_id).toBe("nrdl_2025_v1.0.0");
      expect(snapshot.nrdl.synced).toBe(true);
      expect(snapshot.nrdl.drug_count).toBeGreaterThan(0);
      expect(snapshot.nrdl.rule_count).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
