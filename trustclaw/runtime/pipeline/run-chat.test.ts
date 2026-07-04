import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initializePtds } from "../../ptds/init.js";
import { buildGlp1Decision } from "./glp1-decision.js";
import { runTrustclawChat } from "./run-chat.js";

describe("trustclaw/runtime/pipeline", () => {
  it("builds GLP-1 decision with Evidence citations from rule matrix", () => {
    const decision = buildGlp1Decision({
      userQuery: "我可以用司美格鲁肽吗？",
      snapshot: {
        user_id: "local_user",
        name: "本地用户",
        has_t2dm: 1,
        prior_oral_therapy_status: 0,
        latest_hospital_hba1c: null,
        has_cardiovascular_comorbidity: 0,
        has_absolute_contraindication: 0,
      },
      matrix: {
        active_ruleset: "glp1_indications_rules_v1",
        drug_id: "GLP1_SEMA",
        overall_status: "FAIL",
        evaluated_rules: [
          {
            rule_id: "GLP1_R02",
            name: "临床级HbA1c需≥6.5%",
            status: "FAIL",
            value: null,
            threshold: ">=6.5",
            rule_category: "LAB_LIMIT",
            target_key: "latest_hospital_hba1c",
          },
        ],
      },
    });

    expect(decision.citations).toHaveLength(1);
    expect(decision.citations[0]?.index).toBe(1);
    expect(decision.response).toContain("[Evidence #1]");
    expect(decision.response).toContain("尚不满足");
  });

  it("runs chat pipeline end-to-end on initialized PTDS", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-pipeline-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      initializePtds(
        {
          weight: 85,
          height: 170,
          hba1c: 6.8,
          thyroid_cancer_history: 0,
          pancreatitis_history: 0,
          include_t2dm_diagnosis: true,
        },
        { dbPath },
      );

      const result = await runTrustclawChat(
        {
          session_id: "sess_test_01",
          message: "我可以用司美格鲁肽吗？",
        },
        {
          dbPath,
          auditDir: path.join(dir, "ptds-audit"),
          llm: async () =>
            "SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = 'local_user' LIMIT 1",
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.context.session_id).toBe("sess_test_01");
      expect(result.context.pipeline_stages.text2sql.sql).toMatch(/^SELECT\b/i);
      expect(result.context.pipeline_stages.rule_evaluation.evaluated_rules.length).toBeGreaterThan(
        0,
      );
      expect(result.context.pipeline_stages.agent_decision.response.length).toBeGreaterThan(0);
      expect(result.context.audit_trail_id).toMatch(/^aud_/);
      expect(result.context.evidence_ledger_receipt.proof_hash).toMatch(/^[a-f0-9]{64}$/);

      const auditLines = readFileSync(path.join(dir, "ptds-audit", "events.jsonl"), "utf8")
        .trim()
        .split("\n");
      expect(auditLines.length).toBeGreaterThanOrEqual(5);
      const trailIds = auditLines.map(
        (line) => (JSON.parse(line) as { audit_trail_id: string }).audit_trail_id,
      );
      expect(new Set(trailIds)).toEqual(new Set([result.context.audit_trail_id]));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks chat when PTDS is not initialized", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-pipeline-empty-"));
    const dbPath = path.join(dir, "missing.db");
    try {
      const result = await runTrustclawChat(
        { session_id: "sess_x", message: "hello" },
        { dbPath, llm: async () => "SELECT 1" },
      );
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.status).toBe("ptds_not_initialized");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks chat on Text2SQL security violation", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-pipeline-sec-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      initializePtds(
        {
          weight: 85,
          height: 170,
          hba1c: 6.8,
          thyroid_cancer_history: 0,
          pancreatitis_history: 0,
        },
        { dbPath },
      );

      const result = await runTrustclawChat(
        { session_id: "sess_sec", message: "malicious" },
        { dbPath, llm: async () => "DROP TABLE user_profile" },
      );

      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.status).toBe("security_blocked");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
