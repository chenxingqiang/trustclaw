import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TRA_LOCAL_USER_ID } from "../../tra/db.js";
import { initializeTra } from "../../tra/init.js";
import { TRA_INIT_DEFAULTS } from "../../tra/types.js";
import { evaluateGlp1Rules, evaluateGlp1RulesFromDb } from "./index.js";
import type { NrdlPaymentRuleRow } from "./types.js";

const NRDL_GLP1_RULES: NrdlPaymentRuleRow[] = [
  {
    rule_id: "GLP1_R01",
    drug_id: "GLP1_SEMA",
    rule_category: "DIAGNOSIS",
    target_key: "has_t2dm",
    comparison_operator: "==",
    comparison_value: "1",
    alert_message: "需确诊且处于活动期的2型糖尿病（ICD-10 E11）",
  },
  {
    rule_id: "GLP1_R02",
    drug_id: "GLP1_SEMA",
    rule_category: "LAB_LIMIT",
    target_key: "latest_hospital_hba1c",
    comparison_operator: ">=",
    comparison_value: "6.5",
    alert_message: "临床级HbA1c需≥6.5%",
  },
  {
    rule_id: "GLP1_R03",
    drug_id: "GLP1_SEMA",
    rule_category: "SAFETY_LIMIT",
    target_key: "has_absolute_contraindication",
    comparison_operator: "==",
    comparison_value: "0",
    alert_message: "存在甲状腺髓样癌或重度胰腺炎禁忌",
  },
];

describe("trustclaw/runtime/rules", () => {
  it("evaluates NRDL rules against snapshot with PASS/FAIL matrix", () => {
    const result = evaluateGlp1Rules({
      snapshot: {
        user_id: TRA_LOCAL_USER_ID,
        name: "本地用户",
        has_t2dm: 1,
        prior_oral_therapy_status: 0,
        latest_hospital_hba1c: null,
        has_cardiovascular_comorbidity: 0,
        has_absolute_contraindication: 0,
      },
      rules: NRDL_GLP1_RULES,
    });

    expect(result.matrix.evaluated_rules).toHaveLength(3);
    expect(result.matrix.evaluated_rules.find((r) => r.rule_id === "GLP1_R01")?.status).toBe(
      "PASS",
    );
    expect(result.matrix.evaluated_rules.find((r) => r.rule_id === "GLP1_R02")?.status).toBe(
      "FAIL",
    );
    expect(result.matrix.evaluated_rules.find((r) => r.rule_id === "GLP1_R03")?.status).toBe(
      "PASS",
    );
    expect(result.matrix.overall_status).toBe("FAIL");
    expect(result.handshake.handshake_payload.active_ruleset).toBe("glp1_indications_rules_v1");
  });

  it("loads rules from initialized TRA database", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-rules-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          weight: 85,
          height: 170,
          hba1c: 6.8,
          hasType2Diabetes: true,
        },
        dbPath,
      );

      const result = evaluateGlp1RulesFromDb(dbPath);
      expect(result.matrix.evaluated_rules.length).toBeGreaterThanOrEqual(4);
      expect(
        result.matrix.evaluated_rules.every(
          (entry) => entry.status === "PASS" || entry.status === "FAIL",
        ),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
