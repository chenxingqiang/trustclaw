import { randomBytes } from "node:crypto";
import { AuditRecorder } from "../../audit/index.js";
import { commitEvidenceReceipt, hashEvidenceContent } from "../../ledger/index.js";
import { getActiveComplianceStandard } from "../../tra/compliance-import.js";
import { bootstrapTraDatabase } from "../../tra/db.js";
import { resolveTraAuditDir, resolveTraDbPath, resolveTraEvidenceDir } from "../../tra/paths.js";
import { readGlp1CheckSnapshot, queryTra } from "../../tra/query.js";
import { getAgentPackRegistry } from "../agent-pack/index.js";
import { loadAgentPackText2SqlTemplate } from "../agent-pack/text2sql-prompt.js";
import { evaluateGlp1RulesFromDb } from "../rules/index.js";
import { resolveGlp1EvalDrugId } from "../rules/resolve-glp1-drug-id.js";
import type { RuleEvaluationMatrix } from "../rules/types.js";
import { generateText2Sql } from "../text2sql/generate.js";
import { loadTraSchemaSnippetForObjects } from "../text2sql/schema-context.js";
import { buildPackAgentDecision, packIncludesStage } from "./pack-decision.js";
import type { RunChatInput, RunChatOptions, RunChatResult, RuntimeContext } from "./types.js";

function createAuditTrailId(): string {
  return `aud_${randomBytes(8).toString("hex")}`;
}

function resolveEvidenceDir(options: RunChatOptions): string {
  if (options.evidenceDir?.trim()) {
    return options.evidenceDir;
  }
  return resolveTraEvidenceDir({});
}

function resolveAuditDir(options: RunChatOptions): string {
  if (options.auditDir?.trim()) {
    return options.auditDir;
  }
  return resolveTraAuditDir({});
}

function resolveAgentPack(input: RunChatInput, options: RunChatOptions) {
  if (options.agentPack) {
    return options.agentPack;
  }
  const registry = getAgentPackRegistry();
  return registry.resolve({ packId: input.agent_pack_id });
}

function evaluateRulesForPack(
  pack: ReturnType<typeof resolveAgentPack>,
  params: {
    message: string;
    dbOverrides: { dbPath?: string };
  },
): RuleEvaluationMatrix {
  if (pack.rules.engine === "none") {
    return {
      active_ruleset: "skipped",
      drug_id: "none",
      evaluated_rules: [],
      overall_status: "PASS",
    };
  }

  const dbPath = resolveTraDbPath(params.dbOverrides);
  const evalDb = bootstrapTraDatabase(dbPath);
  let evalDrugId: string;
  try {
    evalDrugId = resolveGlp1EvalDrugId({
      userQuery: params.message,
      hasActiveComplianceStandard: getActiveComplianceStandard(evalDb) !== null,
    });
  } finally {
    evalDb.close();
  }
  return evaluateGlp1RulesFromDb(params.dbOverrides, process.env, evalDrugId).matrix;
}

export async function runTrustclawChat(
  input: RunChatInput,
  options: RunChatOptions,
): Promise<RunChatResult> {
  const pack = resolveAgentPack(input, options);
  const dbOverrides = options.dbPath ? { dbPath: options.dbPath } : {};
  const auditTrailId = createAuditTrailId();
  const auditDir = resolveAuditDir(options);
  const snapshot = readGlp1CheckSnapshot(dbOverrides);
  if (!snapshot) {
    const audit = new AuditRecorder({
      auditDir,
      auditTrailId,
      sessionId: input.session_id,
    });
    const gateStep = pack.pipeline.stages[0] ?? "TEXT2SQL_GEN";
    audit.record({
      step: gateStep,
      component: "TRA.Query",
      input: { user_query: input.message, agent_pack_id: pack.id },
      output: { reason: "tra_not_initialized" },
      status: "BLOCKED",
    });
    return {
      ok: false,
      status: "tra_not_initialized",
      message: "Trust runtime is not initialized. Call POST /api/tra/init first.",
      audit_trail_id: auditTrailId,
    };
  }

  const audit = new AuditRecorder({
    auditDir,
    auditTrailId,
    sessionId: input.session_id,
  });

  const text2sql = await generateText2Sql(
    {
      userQuery: input.message,
      databaseSchema: loadTraSchemaSnippetForObjects(pack.data.readTables),
      promptTemplate: loadAgentPackText2SqlTemplate(pack),
    },
    { llm: options.llm },
  );

  if (text2sql.security_error || !text2sql.handshake.handshake_payload.read_only_verification) {
    audit.record({
      step: "TEXT2SQL_GEN",
      component: "AgentRuntime.Text2SQL",
      input: { user_query: input.message, agent_pack_id: pack.id },
      output: {
        sql: text2sql.sql,
        security_error: text2sql.security_error ?? "read_only_verification failed",
      },
      status: "BLOCKED",
    });
    return {
      ok: false,
      status: "security_blocked",
      message: text2sql.security_error ?? "Text2SQL failed read-only verification.",
      audit_trail_id: auditTrailId,
    };
  }

  audit.record({
    step: "TEXT2SQL_GEN",
    component: "AgentRuntime.Text2SQL",
    input: { user_query: input.message, agent_pack_id: pack.id },
    output: {
      sql: text2sql.sql,
      duration_ms: text2sql.duration_ms,
      allowed_tables: text2sql.handshake.handshake_payload.allowed_tables,
    },
    status: "SUCCESS",
  });

  const dbQuery =
    text2sql.sql.length > 0
      ? { raw_data: queryTra(text2sql.sql, dbOverrides) }
      : { raw_data: { snapshot }, skipped: true as const };

  audit.record({
    step: "DB_QUERY",
    component: "TRA.Query",
    input: { sql: text2sql.sql, skipped: text2sql.sql.length === 0, agent_pack_id: pack.id },
    output:
      "row_count" in dbQuery.raw_data
        ? { row_count: dbQuery.raw_data.row_count, columns: dbQuery.raw_data.columns }
        : { snapshot_user_id: snapshot.user_id },
    status: "SUCCESS",
  });

  const ruleMatrix = packIncludesStage(pack, "RULE_EVAL")
    ? evaluateRulesForPack(pack, { message: input.message, dbOverrides })
    : {
        active_ruleset: "skipped",
        drug_id: "none",
        evaluated_rules: [],
        overall_status: "PASS" as const,
      };

  if (packIncludesStage(pack, "RULE_EVAL")) {
    audit.record({
      step: "RULE_EVAL",
      component: pack.audit.ruleEvalComponent ?? "AgentRuntime.ExecRule",
      input: { active_ruleset: ruleMatrix.active_ruleset, agent_pack_id: pack.id },
      output: {
        overall_status: ruleMatrix.overall_status,
        evaluated_rule_count: ruleMatrix.evaluated_rules.length,
        failed_rule_count: ruleMatrix.evaluated_rules.filter((rule) => rule.status === "FAIL")
          .length,
      },
      // FAIL records FAILURE (monitor) but pipeline continues to AGENT_DECISION soft conclusion (G6).
      status: ruleMatrix.overall_status === "FAIL" ? "FAILURE" : "SUCCESS",
    });
  }

  const agentDecision = buildPackAgentDecision(pack, {
    userQuery: input.message,
    snapshot,
    matrix: ruleMatrix,
  });

  audit.record({
    step: "AGENT_DECISION",
    component: pack.audit.decisionComponent,
    input: { user_query: input.message, agent_pack_id: pack.id },
    output: {
      response_preview: agentDecision.response.slice(0, 200),
      citation_count: agentDecision.citations.length,
      citations: agentDecision.citations,
      ...(packIncludesStage(pack, "RULE_EVAL")
        ? {
            rule_outcome: ruleMatrix.overall_status === "FAIL" ? "soft_fail" : "pass",
          }
        : {}),
    },
    status: "SUCCESS",
  });

  const partialContext = {
    session_id: input.session_id,
    user_query: input.message,
    agent_pack_id: pack.id,
    pipeline_stages: {
      text2sql: {
        sql: text2sql.sql,
        duration_ms: text2sql.duration_ms,
        source: text2sql.source,
      },
      db_query: dbQuery,
      rule_evaluation: {
        evaluated_rules: ruleMatrix.evaluated_rules,
        overall_status: ruleMatrix.overall_status,
        active_ruleset: ruleMatrix.active_ruleset,
      },
      agent_decision: agentDecision,
    },
    audit_trail_id: auditTrailId,
  };

  const contentHash = hashEvidenceContent(partialContext);

  let evidence_ledger_receipt: RuntimeContext["evidence_ledger_receipt"] | undefined;

  if (packIncludesStage(pack, "LEDGER_COMMIT")) {
    const committed = commitEvidenceReceipt({
      evidenceDir: resolveEvidenceDir(options),
      audit_trail_id: auditTrailId,
      session_id: input.session_id,
      agent_pack_id: pack.id,
      content_hash: contentHash,
    });
    evidence_ledger_receipt = {
      block_height: committed.block_height,
      proof_hash: committed.proof_hash,
      previous_evidence_hash: committed.previous_evidence_hash,
    };
    audit.record({
      step: "LEDGER_COMMIT",
      component: "EvidenceLedger.Commit",
      input: { audit_trail_id: auditTrailId, agent_pack_id: pack.id },
      output: {
        block_height: committed.block_height,
        proof_hash: committed.proof_hash,
        previous_evidence_hash: committed.previous_evidence_hash,
        content_hash: committed.content_hash,
      },
      status: "SUCCESS",
    });
  }

  const context: RuntimeContext = {
    ...partialContext,
    declared_pipeline_steps: pack.pipeline.stages,
    ...(evidence_ledger_receipt ? { evidence_ledger_receipt } : {}),
  };

  return { ok: true, context };
}
