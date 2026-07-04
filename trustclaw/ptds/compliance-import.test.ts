import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateGlp1RulesFromDb } from "../runtime/rules/index.js";
import {
  getActiveComplianceStandard,
  importComplianceStandardPackage,
  loadComplianceAstRules,
  previewComplianceStandardPackage,
} from "./compliance-import.js";
import { bootstrapPtdsDatabase } from "./db.js";
import { initializePtds, PTDS_INIT_DEFAULTS, PTDS_SEED_GLP1_AST_V2_JSON } from "./index.js";

describe("trustclaw/ptds compliance import", () => {
  const seedPackage = JSON.parse(readFileSync(PTDS_SEED_GLP1_AST_V2_JSON, "utf8"));

  it("previews bundled GLP-1 AST handshake package", () => {
    const preview = previewComplianceStandardPackage(seedPackage);
    expect(preview.status).toBe("success");
    expect(preview.rule_count).toBe(4);
    expect(preview.metadata?.version_id).toBe("nrdl_2025_v1.0.0");
  });

  it("requires user consent before import", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-compliance-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      const result = importComplianceStandardPackage(
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

  it("imports external standard and evaluates semaglutide AST rules", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-compliance-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "audit");
    try {
      initializePtds(
        {
          ...PTDS_INIT_DEFAULTS,
          weight: 85,
          height: 170,
          hba1c: 7.2,
          hasType2Diabetes: true,
          usedMetforminBadControl: true,
        },
        dbPath,
      );

      const imported = importComplianceStandardPackage(
        {
          consentGranted: true,
          sessionId: "sess_import_ok",
          agentPackId: "compliance-auditor",
          sourceLabel: "glp1-nrdl-ast-handshake-v2.json",
          package: seedPackage,
        },
        { dbPath, auditDir },
      );
      expect(imported.status).toBe("success");
      expect(imported.rules_imported).toBe(4);

      const db = bootstrapPtdsDatabase(dbPath);
      const active = getActiveComplianceStandard(db);
      expect(active?.standard_id).toBe("nrdl_2025_v1.0.0");
      const rules = loadComplianceAstRules(db, active!.standard_id, "29");
      expect(rules.some((rule) => rule.rule_id === "R_GLP1_SEMA_29")).toBe(true);
      db.close();

      const evaluation = evaluateGlp1RulesFromDb({ dbPath, auditDir });
      expect(evaluation.matrix.active_ruleset).toBe("nrdl_2025_v1.0.0");
      expect(evaluation.matrix.drug_id).toBe("29");
      expect(evaluation.matrix.evaluated_rules.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
