import type { DatabaseSync } from "node:sqlite";
import { loadComplianceAstRules } from "../../tra/compliance-import.js";
import type {
  ComplianceAstNode,
  MedicationComplianceAstRuleRow,
} from "../../tra/compliance-types.js";
import { buildComplianceEvalContext, resolveComplianceFieldValue } from "./ast-context.js";
import type {
  RuleEvaluationEntry,
  RuleEvaluationMatrix,
  RuleEvaluationResult,
  RuleEvaluationStatus,
  RuleEvaluatorHandshake,
} from "./types.js";

function isAstLeaf(node: ComplianceAstNode): node is Extract<ComplianceAstNode, { field: string }> {
  return "field" in node;
}

function compareLeaf(actual: unknown, operator: string, expected: unknown): boolean {
  const op = operator.trim().toUpperCase();
  if (op === "EQUALS" || op === "==") {
    return actual === expected || String(actual) === String(expected);
  }
  const actualNum = typeof actual === "number" ? actual : Number(actual);
  const expectedNum = typeof expected === "number" ? expected : Number(expected);
  if (!Number.isFinite(actualNum) || !Number.isFinite(expectedNum)) {
    return false;
  }
  switch (op) {
    case ">=":
      return actualNum >= expectedNum;
    case "<=":
      return actualNum <= expectedNum;
    case ">":
      return actualNum > expectedNum;
    case "<":
      return actualNum < expectedNum;
    default:
      return false;
  }
}

export function evaluateComplianceAstNode(
  node: ComplianceAstNode,
  context: Record<string, unknown>,
): boolean {
  if (isAstLeaf(node)) {
    const actual = resolveComplianceFieldValue(context, node.field);
    return compareLeaf(actual, node.operator, node.value);
  }
  const results = node.children.map((child) => evaluateComplianceAstNode(child, context));
  return node.operator === "AND" ? results.every(Boolean) : results.some(Boolean);
}

function formatAstThreshold(node: ComplianceAstNode): string {
  if (isAstLeaf(node)) {
    return `${node.field} ${node.operator} ${String(node.value)}`;
  }
  return node.operator;
}

function flattenAstLeaves(
  node: ComplianceAstNode,
  out: Extract<ComplianceAstNode, { field: string }>[] = [],
): Extract<ComplianceAstNode, { field: string }>[] {
  if (isAstLeaf(node)) {
    out.push(node);
    return out;
  }
  for (const child of node.children) {
    flattenAstLeaves(child, out);
  }
  return out;
}

export function evaluateComplianceAstRules(params: {
  rules: MedicationComplianceAstRuleRow[];
  context: Record<string, unknown>;
  standardId: string;
  drugId: string;
  snapshot?: Record<string, unknown> | null;
}): RuleEvaluationResult {
  const evaluatedRules: RuleEvaluationEntry[] = params.rules.map((rule) => {
    const astRoot = JSON.parse(rule.ast_root_json) as ComplianceAstNode;
    const passed = evaluateComplianceAstNode(astRoot, params.context);
    const firstLeaf = flattenAstLeaves(astRoot)[0];
    const actual = firstLeaf ? resolveComplianceFieldValue(params.context, firstLeaf.field) : null;
    return {
      rule_id: rule.rule_id,
      name: rule.drug_name,
      status: (passed ? "PASS" : "FAIL") as RuleEvaluationStatus,
      value: typeof actual === "number" || typeof actual === "string" ? actual : null,
      threshold: formatAstThreshold(astRoot),
      rule_category: "COMPLIANCE_AST",
      target_key: firstLeaf?.field ?? rule.rule_id,
    };
  });

  const overallStatus: RuleEvaluationStatus = evaluatedRules.every(
    (entry) => entry.status === "PASS",
  )
    ? "PASS"
    : "FAIL";

  const matrix: RuleEvaluationMatrix = {
    active_ruleset: params.standardId,
    drug_id: params.drugId,
    evaluated_rules: evaluatedRules,
    overall_status: overallStatus,
  };

  const handshake: RuleEvaluatorHandshake = {
    source_system: "TRA_SQLite_Engine",
    target_agent: "RuleEvaluationAgent",
    handshake_payload: {
      biometric_snapshot: params.snapshot ?? params.context,
      active_ruleset: params.standardId,
    },
  };

  return { matrix, handshake };
}

export function evaluateComplianceAstRulesFromDb(params: {
  db: DatabaseSync;
  standardId: string;
  drugId: string;
  snapshot?: Record<string, unknown> | null;
}): RuleEvaluationResult | null {
  const rules = loadComplianceAstRules(params.db, params.standardId, params.drugId);
  if (rules.length === 0) {
    return null;
  }
  const context = buildComplianceEvalContext(params.db);
  return evaluateComplianceAstRules({
    rules,
    context,
    standardId: params.standardId,
    drugId: params.drugId,
    snapshot: params.snapshot,
  });
}
