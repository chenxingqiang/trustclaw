import { randomBytes } from "node:crypto";
import { AuditRecorder } from "../../audit/index.js";
import { commitEvidenceReceipt, hashEvidenceContent } from "../../ledger/index.js";
import { getActiveComplianceStandard } from "../../ptds/compliance-import.js";
import { bootstrapPtdsDatabase } from "../../ptds/db.js";
import {
  resolvePtdsAuditDir,
  resolvePtdsDbPath,
  resolvePtdsEvidenceDir,
} from "../../ptds/paths.js";
import { readGlp1CheckSnapshot, queryPtds } from "../../ptds/query.js";
import { getAgentPackRegistry } from "../agent-pack/index.js";
import { loadAgentPackText2SqlTemplate } from "../agent-pack/text2sql-prompt.js";
import { evaluateGlp1RulesFromDb } from "../rules/index.js";
import { resolveGlp1EvalDrugId } from "../rules/resolve-glp1-drug-id.js";
import type { RuleEvaluationMatrix } from "../rules/types.js";
import { generateText2Sql } from "../text2sql/generate.js";
import { loadPtdsSchemaSnippetForObjects } from "../text2sql/schema-context.js";
import { buildPackAgentDecision, packIncludesStage } from "./pack-decision.js";
import type { RunChatInput, RunChatOptions, RunChatResult, RuntimeContext } from "./types.js";

function createAuditTrailId(): string {
  return `aud_${randomBytes(8).toString("hex")}`;
}

function resolveEvidenceDir(options: RunChatOptions): string {
  if (options.evidenceDir?.trim()) {
    return options.evidenceDir;
  }
  return resolvePtdsEvidenceDir({});
}

function resolveAuditDir(options: RunChatOptions): string {
  if (options.auditDir?.trim()) {
    return options.auditDir;
  }
  return resolvePtdsAuditDir({});
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

  const dbPath = resolvePtdsDbPath(params.dbOverrides);
  const evalDb = bootstrapPtdsDatabase(dbPath);
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
  const snapshot = readGlp1CheckSnapshot(dbOverrides);
  if (!snapshot) {
    return {
      ok: false,
      status: "ptds_not_initialized",
      message: "Trust runtime is not initialized. Call POST /api/ptds/init first.",
    };
  }

  const auditTrailId = createAuditTrailId();
  const audit = new AuditRecorder({
    auditDir: resolveAuditDir(options),
    auditTrailId,
    sessionId: input.session_id,
  });

  const text2sql = await generateText2Sql(
    {
      userQuery: input.message,
      databaseSchema: loadPtdsSchemaSnippetForObjects(pack.data.readTables),
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
      ? { raw_data: queryPtds(text2sql.sql, dbOverrides) }
      : { raw_data: { snapshot }, skipped: true as const };

  audit.record({
    step: "DB_QUERY",
    component: "PTDS.Query",
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
      },
      status: "SUCCESS",
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
    ...(evidence_ledger_receipt ? { evidence_ledger_receipt } : {}),
  };

  return { ok: true, context };
}
