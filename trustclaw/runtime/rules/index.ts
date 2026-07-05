import type { DatabaseSync } from "node:sqlite";
import { getActiveComplianceStandard } from "../../tra/compliance-import.js";
import { bootstrapTraDatabase } from "../../tra/db.js";
import { resolveTraDbPath, type TraPathOverrides } from "../../tra/paths.js";
import { readGlp1CheckSnapshot } from "../../tra/query.js";
import { evaluateComplianceAstRulesFromDb } from "./evaluate-ast.js";
import { evaluateGlp1Rules } from "./evaluate.js";
import type { NrdlPaymentRuleRow, RuleEvaluationResult } from "./types.js";

const DEFAULT_FLAT_DRUG_ID = "GLP1_SEMA";
/** Semaglutide drug_id in imported NRDL AST handshake package v2. */
const DEFAULT_AST_DRUG_ID = "29";

export function loadNrdlPaymentRules(
  db: DatabaseSync,
  drugId = DEFAULT_FLAT_DRUG_ID,
): NrdlPaymentRuleRow[] {
  return db
    .prepare(
      `SELECT rule_id, drug_id, rule_category, target_key, comparison_operator, comparison_value, alert_message
       FROM nrdl_payment_rules
       WHERE drug_id = ?
       ORDER BY rule_id`,
    )
    .all(drugId) as NrdlPaymentRuleRow[];
}

export function evaluateGlp1RulesFromDb(
  dbPathOrOverrides?: string | TraPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
  drugId = DEFAULT_FLAT_DRUG_ID,
): RuleEvaluationResult {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolveTraDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolveTraDbPath(dbPathOrOverrides, env);
  const db = bootstrapTraDatabase(dbPath);
  try {
    const snapshot = readGlp1CheckSnapshot(dbPath, env);
    const activeStandard = getActiveComplianceStandard(db);
    if (activeStandard) {
      const astDrugId = drugId === DEFAULT_FLAT_DRUG_ID ? DEFAULT_AST_DRUG_ID : drugId;
      const astResult = evaluateComplianceAstRulesFromDb({
        db,
        standardId: activeStandard.standard_id,
        drugId: astDrugId,
        snapshot: snapshot as unknown as Record<string, unknown> | null,
      });
      if (astResult) {
        return astResult;
      }
    }
    const rules = loadNrdlPaymentRules(db, drugId);
    return evaluateGlp1Rules({ snapshot, rules, drugId });
  } finally {
    db.close();
  }
}

export {
  evaluateComplianceAstNode,
  evaluateComplianceAstRules,
  evaluateComplianceAstRulesFromDb,
} from "./evaluate-ast.js";
export { buildComplianceEvalContext, buildComplianceEvalContextFromDb } from "./ast-context.js";

export { evaluateGlp1Rules } from "./evaluate.js";
export {
  DEFAULT_AST_DRUG_ID,
  DEFAULT_FLAT_DRUG_ID,
  detectGlp1DrugIdFromQuery,
  resolveGlp1EvalDrugId,
} from "./resolve-glp1-drug-id.js";
export type {
  EvaluateGlp1RulesInput,
  NrdlPaymentRuleRow,
  RuleEvaluationEntry,
  RuleEvaluationMatrix,
  RuleEvaluationResult,
  RuleEvaluationStatus,
  RuleEvaluatorHandshake,
} from "./types.js";
