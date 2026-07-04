import { createHash, randomBytes } from "node:crypto";
import { AuditRecorder } from "../../audit/index.js";
import { resolvePtdsAuditDir } from "../../ptds/paths.js";
import { readGlp1CheckSnapshot, queryPtds } from "../../ptds/query.js";
import { evaluateGlp1RulesFromDb } from "../rules/index.js";
import { generateText2Sql } from "../text2sql/generate.js";
import { buildGlp1Decision } from "./glp1-decision.js";
import type { RunChatInput, RunChatOptions, RunChatResult, RuntimeContext } from "./types.js";

function createAuditTrailId(): string {
  return `aud_${randomBytes(8).toString("hex")}`;
}

function buildProofHash(context: Omit<RuntimeContext, "evidence_ledger_receipt">): string {
  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
}

function resolveAuditDir(options: RunChatOptions): string {
  if (options.auditDir?.trim()) {
    return options.auditDir;
  }
  return resolvePtdsAuditDir({});
}

export async function runTrustclawChat(
  input: RunChatInput,
  options: RunChatOptions,
): Promise<RunChatResult> {
  const dbOverrides = options.dbPath ? { dbPath: options.dbPath } : {};
  const snapshot = readGlp1CheckSnapshot(dbOverrides);
  if (!snapshot) {
    return {
      ok: false,
      status: "ptds_not_initialized",
      message: "PTDS is not initialized. Call POST /api/ptds/init first.",
    };
  }

  const auditTrailId = createAuditTrailId();
  const audit = new AuditRecorder({
    auditDir: resolveAuditDir(options),
    auditTrailId,
    sessionId: input.session_id,
  });

  const text2sql = await generateText2Sql({ userQuery: input.message }, { llm: options.llm });

  if (text2sql.security_error || !text2sql.handshake.handshake_payload.read_only_verification) {
    audit.record({
      step: "TEXT2SQL_GEN",
      component: "AgentRuntime.Text2SQL",
      input: { user_query: input.message },
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
    };
  }

  audit.record({
    step: "TEXT2SQL_GEN",
    component: "AgentRuntime.Text2SQL",
    input: { user_query: input.message },
    output: {
      sql: text2sql.sql,
      duration_ms: text2sql.duration_ms,
      allowed_tables: text2sql.handshake.handshake_payload.allowed_tables,
    },
    status: "SUCCESS",
  });

  const dbQuery =
    text2sql.sql.length > 0
      ? { raw_data: queryPtds(text2sql.sql, dbOverrides) }
      : { raw_data: { snapshot }, skipped: true as const };

  audit.record({
    step: "DB_QUERY",
    component: "PTDS.Query",
    input: { sql: text2sql.sql, skipped: text2sql.sql.length === 0 },
    output:
      "row_count" in dbQuery.raw_data
        ? { row_count: dbQuery.raw_data.row_count, columns: dbQuery.raw_data.columns }
        : { snapshot_user_id: snapshot.user_id },
    status: "SUCCESS",
  });

  const ruleResult = evaluateGlp1RulesFromDb(dbOverrides);

  audit.record({
    step: "RULE_EVAL",
    component: "AgentRuntime.ExecRule",
    input: { active_ruleset: ruleResult.matrix.active_ruleset },
    output: {
      overall_status: ruleResult.matrix.overall_status,
      evaluated_rule_count: ruleResult.matrix.evaluated_rules.length,
    },
    status: "SUCCESS",
  });

  const agentDecision = buildGlp1Decision({
    userQuery: input.message,
    snapshot,
    matrix: ruleResult.matrix,
  });

  audit.record({
    step: "AGENT_DECISION",
    component: "Agent.GLP1Decision",
    input: { user_query: input.message },
    output: {
      response_preview: agentDecision.response.slice(0, 200),
      citation_count: agentDecision.citations.length,
    },
    status: "SUCCESS",
  });

  const partialContext = {
    session_id: input.session_id,
    user_query: input.message,
    pipeline_stages: {
      text2sql: {
        sql: text2sql.sql,
        duration_ms: text2sql.duration_ms,
        source: text2sql.source,
      },
      db_query: dbQuery,
      rule_evaluation: {
        evaluated_rules: ruleResult.matrix.evaluated_rules,
        overall_status: ruleResult.matrix.overall_status,
        active_ruleset: ruleResult.matrix.active_ruleset,
      },
      agent_decision: agentDecision,
    },
    audit_trail_id: auditTrailId,
  };

  const proofHash = buildProofHash(partialContext);

  audit.record({
    step: "LEDGER_COMMIT",
    component: "EvidenceLedger.Commit",
    input: { audit_trail_id: auditTrailId },
    output: { block_height: 0, proof_hash: proofHash },
    status: "SUCCESS",
  });

  const context: RuntimeContext = {
    ...partialContext,
    evidence_ledger_receipt: {
      block_height: 0,
      proof_hash: proofHash,
    },
  };

  return { ok: true, context };
}
