import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readAuditEvents } from "../audit/index.js";
import { bootstrapPtdsDatabase } from "./db.js";
import { PTDS_SEED_NRDL_REFERENCE_GLP1_JSON } from "./paths.js";
import {
  getNrdlReferenceStatus,
  isAllowedReferenceFetchUrl,
  previewNrdlReferencePackage,
  syncNrdlReferencePackage,
} from "./reference-import.js";

describe("trustclaw/ptds reference sync", () => {
  const seedPackage = JSON.parse(readFileSync(PTDS_SEED_NRDL_REFERENCE_GLP1_JSON, "utf8"));

  it("previews bundled NRDL reference package", () => {
    const preview = previewNrdlReferencePackage(seedPackage);
    expect(preview.status).toBe("success");
    expect(preview.drug_count).toBe(1);
    expect(preview.rule_count).toBe(4);
    expect(preview.metadata?.version_id).toBe("nrdl_ref_glp1_v1");
  });

  it("requires user consent before sync", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-reference-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      const result = await syncNrdlReferencePackage(
        {
          consentGranted: false,
          sessionId: "sess_no_consent",
          package: seedPackage,
        },
        dbPath,
      );
      expect(result.status).toBe("error");
      expect(result.message).toContain("consent");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("syncs reference tables and writes REFERENCE_SYNC audit", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-reference-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "audit");
    try {
      const synced = await syncNrdlReferencePackage(
        {
          consentGranted: true,
          sessionId: "sess_ref_sync",
          agentPackId: "compliance-auditor",
          sourceLabel: "nrdl-reference-glp1-v1.json",
          package: seedPackage,
        },
        { dbPath, auditDir },
      );
      expect(synced.status).toBe("success");
      expect(synced.rules_synced).toBe(4);

      const status = getNrdlReferenceStatus({ dbPath, auditDir });
      expect(status.local_drug_count).toBeGreaterThanOrEqual(1);
      expect(status.local_rule_count).toBeGreaterThanOrEqual(4);
      expect(status.last_sync?.version_id).toBe("nrdl_ref_glp1_v1");

      const db = bootstrapPtdsDatabase(dbPath);
      const rule = db
        .prepare("SELECT alert_message FROM nrdl_payment_rules WHERE rule_id = ?")
        .get("GLP1_R02") as { alert_message: string } | undefined;
      db.close();
      expect(rule?.alert_message).toContain("HbA1c");

      const events = readAuditEvents({
        auditDir,
        limit: 10,
        steps: ["REFERENCE_SYNC"],
      });
      expect(events.some((event) => event.step === "REFERENCE_SYNC")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips sync when package hash unchanged", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-reference-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      const first = await syncNrdlReferencePackage(
        {
          consentGranted: true,
          sessionId: "sess_ref_1",
          agentPackId: "compliance-auditor",
          package: seedPackage,
        },
        dbPath,
      );
      expect(first.status).toBe("success");

      const second = await syncNrdlReferencePackage(
        {
          consentGranted: true,
          sessionId: "sess_ref_2",
          agentPackId: "compliance-auditor",
          package: seedPackage,
        },
        dbPath,
      );
      expect(second.status).toBe("success");
      expect(second.skipped_unchanged).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows https and localhost http subscription URLs", () => {
    expect(isAllowedReferenceFetchUrl("https://example.com/nrdl.json")).toBe(true);
    expect(isAllowedReferenceFetchUrl("http://127.0.0.1:8080/nrdl.json")).toBe(true);
    expect(isAllowedReferenceFetchUrl("http://evil.example.com/nrdl.json")).toBe(false);
    expect(isAllowedReferenceFetchUrl("ftp://example.com/nrdl.json")).toBe(false);
  });
});
