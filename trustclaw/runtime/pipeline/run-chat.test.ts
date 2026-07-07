import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { missingChatPipelineSteps } from "../../audit/index.js";
import { readAuditEvents } from "../../audit/read-events.js";
import { readEvidenceReceipts, verifyEvidenceChain } from "../../ledger/index.js";
import { initializeTra } from "../../tra/init.js";
import { TRA_INIT_DEFAULTS } from "../../tra/types.js";
import { getAgentPackRegistry } from "../agent-pack/index.js";
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

  it("runs chat pipeline end-to-end on initialized TRA", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-pipeline-"));
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
        { dbPath },
      );

      const result = await runTrustclawChat(
        {
          session_id: "sess_test_01",
          message: "我可以用司美格鲁肽吗？",
        },
        {
          dbPath,
          auditDir: path.join(dir, "tra-audit"),
          evidenceDir: path.join(dir, "tra-evidence"),
          llm: async () =>
            "SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = 'local_user' LIMIT 1",
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.context.session_id).toBe("sess_test_01");
      expect(result.context.agent_pack_id).toBe("glp1-eligibility");
      expect(result.context.pipeline_stages.text2sql.sql).toMatch(/^SELECT\b/i);
      expect(result.context.pipeline_stages.rule_evaluation.evaluated_rules.length).toBeGreaterThan(
        0,
      );
      expect(result.context.pipeline_stages.agent_decision.response.length).toBeGreaterThan(0);
      expect(result.context.audit_trail_id).toMatch(/^aud_/);
      expect(result.context.evidence_ledger_receipt?.proof_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.context.evidence_ledger_receipt?.block_height).toBe(0);
      expect(result.context.evidence_ledger_receipt?.previous_evidence_hash).toBeNull();

      const receipts = readEvidenceReceipts(path.join(dir, "tra-evidence"));
      expect(receipts).toHaveLength(1);
      expect(verifyEvidenceChain(receipts)).toEqual({ ok: true });

      const auditLines = readFileSync(path.join(dir, "tra-audit", "events.jsonl"), "utf8")
        .trim()
        .split("\n");
      expect(auditLines.length).toBeGreaterThanOrEqual(5);
      const pack = getAgentPackRegistry().get(result.context.agent_pack_id);
      expect(result.context.declared_pipeline_steps).toEqual(pack?.pipeline.stages);
      expect(
        missingChatPipelineSteps(path.join(dir, "tra-audit"), result.context.audit_trail_id, {
          expectedSteps: pack?.pipeline.stages,
        }),
      ).toEqual([]);
      const trailIds = auditLines.map(
        (line) => (JSON.parse(line) as { audit_trail_id: string }).audit_trail_id,
      );
      expect(new Set(trailIds)).toEqual(new Set([result.context.audit_trail_id]));

      const decisionLine = auditLines
        .map((line) => JSON.parse(line) as { step: string; output: { citations?: unknown[] } })
        .find((event) => event.step === "AGENT_DECISION");
      expect(decisionLine?.output.citations?.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("links consecutive chat receipts in the evidence ledger", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-pipeline-chain-"));
    const dbPath = path.join(dir, "local_tra.db");
    const evidenceDir = path.join(dir, "tra-evidence");
    try {
      initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          weight: 85,
          height: 170,
          hba1c: 6.8,
          hasType2Diabetes: true,
        },
        { dbPath },
      );

      const chatOpts = {
        dbPath,
        auditDir: path.join(dir, "tra-audit"),
        evidenceDir,
        llm: async () =>
          "SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = 'local_user' LIMIT 1",
      };

      const first = await runTrustclawChat(
        { session_id: "sess_chain", message: "我的BMI是多少？" },
        chatOpts,
      );
      const second = await runTrustclawChat(
        { session_id: "sess_chain", message: "我可以用司美格鲁肽吗？" },
        chatOpts,
      );

      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) {
        return;
      }

      expect(first.context.evidence_ledger_receipt?.block_height).toBe(0);
      expect(second.context.evidence_ledger_receipt?.block_height).toBe(1);
      expect(second.context.evidence_ledger_receipt?.previous_evidence_hash).toBe(
        first.context.evidence_ledger_receipt?.proof_hash,
      );

      const receipts = readEvidenceReceipts(evidenceDir);
      expect(receipts).toHaveLength(2);
      expect(verifyEvidenceChain(receipts)).toEqual({ ok: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks chat when TRA is not initialized", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-pipeline-empty-"));
    const dbPath = path.join(dir, "missing.db");
    try {
      const result = await runTrustclawChat(
        { session_id: "sess_x", message: "hello" },
        { dbPath, auditDir: path.join(dir, "tra-audit"), llm: async () => "SELECT 1" },
      );
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.status).toBe("tra_not_initialized");
      expect(result.audit_trail_id).toMatch(/^aud_/);
      const auditLines = readFileSync(path.join(dir, "tra-audit", "events.jsonl"), "utf8")
        .trim()
        .split("\n");
      expect(auditLines).toHaveLength(1);
      const blocked = JSON.parse(auditLines[0]!) as { status: string; output: { reason?: string } };
      expect(blocked.status).toBe("BLOCKED");
      expect(blocked.output.reason).toBe("tra_not_initialized");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records RULE_EVAL FAILURE and soft-fail AGENT_DECISION when rules fail (G6)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-pipeline-rule-fail-"));
    const dbPath = path.join(dir, "local_tra.db");
    const auditDir = path.join(dir, "tra-audit");
    try {
      initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          weight: 85,
          height: 170,
          hba1c: 5.4,
          hasType2Diabetes: true,
        },
        { dbPath },
      );

      const result = await runTrustclawChat(
        { session_id: "sess_rule_fail", message: "我可以用司美格鲁肽吗？" },
        {
          dbPath,
          auditDir,
          evidenceDir: path.join(dir, "tra-evidence"),
          llm: async () =>
            "SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = 'local_user' LIMIT 1",
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      const events = readAuditEvents({ auditDir, limit: 20 }).filter(
        (event) => event.audit_trail_id === result.context.audit_trail_id,
      );
      const ruleEval = events.find((event) => event.step === "RULE_EVAL");
      const decision = events.find((event) => event.step === "AGENT_DECISION");
      expect(ruleEval?.status).toBe("FAILURE");
      expect(decision?.status).toBe("SUCCESS");
      expect(decision?.output.rule_outcome).toBe("soft_fail");
      expect(result.context.pipeline_stages.rule_evaluation.overall_status).toBe("FAIL");
      expect(result.context.pipeline_stages.agent_decision.citations.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs nrdl-reimburse pack with full RULE_EVAL pipeline (Phase 3)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-pipeline-nrdl-"));
    const dbPath = path.join(dir, "local_tra.db");
    const auditDir = path.join(dir, "tra-audit");
    const nrdlPack = getAgentPackRegistry().get("nrdl-reimburse")!;
    try {
      initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          weight: 85,
          height: 170,
          hba1c: 6.8,
          hasType2Diabetes: true,
        },
        { dbPath },
      );

      const result = await runTrustclawChat(
        {
          session_id: "sess_nrdl",
          message: "司美格鲁肽医保报销条件是什么？",
          agent_pack_id: nrdlPack.id,
        },
        {
          dbPath,
          auditDir,
          evidenceDir: path.join(dir, "tra-evidence"),
          llm: async () =>
            "SELECT * FROM v_glp1_nrdl_check_snapshot WHERE user_id = 'local_user' LIMIT 1",
          agentPack: nrdlPack,
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.context.agent_pack_id).toBe(nrdlPack.id);
      expect(result.context.declared_pipeline_steps).toEqual(nrdlPack.pipeline.stages);
      expect(result.context.pipeline_stages.rule_evaluation.evaluated_rules.length).toBeGreaterThan(
        0,
      );

      const missing = missingChatPipelineSteps(auditDir, result.context.audit_trail_id, {
        expectedSteps: nrdlPack.pipeline.stages,
      });
      expect(missing).toEqual([]);

      const steps = readAuditEvents({ auditDir, limit: 20 })
        .filter((event) => event.audit_trail_id === result.context.audit_trail_id)
        .map((event) => event.step);
      expect(steps).toContain("RULE_EVAL");
      expect(steps).toContain("AGENT_DECISION");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs compliance-auditor pack without RULE_EVAL audit steps (Phase 3)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-pipeline-compliance-"));
    const dbPath = path.join(dir, "local_tra.db");
    const auditDir = path.join(dir, "tra-audit");
    const compliancePack = getAgentPackRegistry().get("compliance-auditor")!;
    try {
      initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          weight: 85,
          height: 170,
          hba1c: 6.8,
        },
        { dbPath },
      );

      const result = await runTrustclawChat(
        {
          session_id: "sess_compliance",
          message: "当前有哪些数据源？",
          agent_pack_id: compliancePack.id,
        },
        {
          dbPath,
          auditDir,
          evidenceDir: path.join(dir, "tra-evidence"),
          llm: async () => "SELECT source_id, label FROM data_source_registry LIMIT 5",
          agentPack: compliancePack,
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.context.agent_pack_id).toBe(compliancePack.id);
      expect(result.context.pipeline_stages.rule_evaluation).toBeUndefined();

      const missing = missingChatPipelineSteps(auditDir, result.context.audit_trail_id, {
        expectedSteps: compliancePack.pipeline.stages,
      });
      expect(missing).toEqual([]);

      const steps = readAuditEvents({ auditDir, limit: 20 })
        .filter((event) => event.audit_trail_id === result.context.audit_trail_id)
        .map((event) => event.step);
      expect(steps).not.toContain("RULE_EVAL");
      expect(steps).toContain("AGENT_DECISION");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks chat on Text2SQL security violation", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-pipeline-sec-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      initializeTra(
        {
          ...TRA_INIT_DEFAULTS,
          weight: 85,
          height: 170,
          hba1c: 6.8,
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
