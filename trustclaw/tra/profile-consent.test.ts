import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildTraHealthProfileSummary,
  clearTraDataAccessGrants,
  grantTraDataAccess,
  hasTraDataAccessGrant,
  initializeTra,
  TRA_INIT_DEFAULTS,
  recordTraConsentAudit,
} from "./index.js";

describe("trustclaw/tra profile + consent", () => {
  it("builds health profile summary after init", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-profile-"));
    const dbPath = path.join(dir, "local_tra.db");
    const auditDir = path.join(dir, "audit");
    try {
      const init = initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          weight: 85,
          height: 170,
          hba1c: 7.2,
          hasType2Diabetes: true,
          usedMetforminBadControl: true,
        },
        dbPath,
      );
      expect(init.status).toBe("success");

      const profile = buildTraHealthProfileSummary({ dbPath, auditDir });
      expect(profile.mounted).toBe(true);
      expect(profile.patient_name).toBe("张三");
      expect(profile.hba1c_percent).toBe(7.2);
      expect(profile.private_data_fields).toContain("medication_history");
      expect(profile.analysis_notes.length).toBeGreaterThan(0);
      expect(profile.snapshot?.has_t2dm).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists allow-always consent grants and records audit", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-consent-"));
    const auditDir = path.join(dir, "audit");
    try {
      expect(hasTraDataAccessGrant("sess_a", "glp1-eligibility", { auditDir })).toBe(false);
      grantTraDataAccess("sess_a", "glp1-eligibility", "allow-always", { auditDir });
      expect(hasTraDataAccessGrant("sess_a", "glp1-eligibility", { auditDir })).toBe(true);

      recordTraConsentAudit({
        sessionId: "sess_a",
        agentPackId: "glp1-eligibility",
        question: "我能报销司美格鲁肽吗？",
        privateDataFields: ["hba1c", "clinical_diagnoses"],
        decision: "allow-once",
        granted: true,
        auditDir,
      });

      const auditLine = readFileSync(path.join(auditDir, "events.jsonl"), "utf8").trim();
      const event = JSON.parse(auditLine) as { step: string; component: string; status: string };
      expect(event.step).toBe("DATA_CONSENT");
      expect(event.component).toBe("TRA.Consent");
      expect(event.status).toBe("SUCCESS");

      expect(event.input.agent_pack_id).toBe("glp1-eligibility");

      clearTraDataAccessGrants({ auditDir });
      expect(hasTraDataAccessGrant("sess_a", "glp1-eligibility", { auditDir })).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
