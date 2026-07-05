import type {
  EvaluateGlp1RulesInput,
  NrdlPaymentRuleRow,
  RuleEvaluationEntry,
  RuleEvaluationMatrix,
  RuleEvaluationResult,
  RuleEvaluationStatus,
} from "./types.js";

const DEFAULT_DRUG_ID = "GLP1_SEMA";
const DEFAULT_RULESET_ID = "glp1_indications_rules_v1";

function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatThreshold(rule: NrdlPaymentRuleRow): string {
  return `${rule.comparison_operator}${rule.comparison_value}`;
}

function compareRule(
  rule: NrdlPaymentRuleRow,
  snapshotValue: unknown,
): { status: RuleEvaluationStatus; value: number | string | null } {
  const actual = snapshotValue ?? null;
  const operator = rule.comparison_operator.trim();
  const expectedRaw = rule.comparison_value.trim();

  if (operator === "NOT_IN") {
    const blocked = expectedRaw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const actualText = actual === null ? "" : String(actual);
    const status: RuleEvaluationStatus = blocked.includes(actualText) ? "FAIL" : "PASS";
    return { status, value: actualText || null };
  }

  const expectedNum = parseNumeric(expectedRaw);
  const actualNum = parseNumeric(actual);

  if (expectedNum === null || actualNum === null) {
    return { status: "FAIL", value: actualNum ?? (actual === null ? null : String(actual)) };
  }

  let passed = false;
  switch (operator) {
    case "==":
      passed = actualNum === expectedNum;
      break;
    case ">=":
      passed = actualNum >= expectedNum;
      break;
    case "<=":
      passed = actualNum <= expectedNum;
      break;
    case ">":
      passed = actualNum > expectedNum;
      break;
    case "<":
      passed = actualNum < expectedNum;
      break;
    default:
      passed = false;
  }

  return { status: passed ? "PASS" : "FAIL", value: actualNum };
}

function snapshotValueForKey(snapshot: Record<string, unknown>, targetKey: string): unknown {
  if (targetKey in snapshot) {
    return snapshot[targetKey];
  }
  return null;
}

export function evaluateGlp1Rules(input: EvaluateGlp1RulesInput): RuleEvaluationResult {
  const drugId = input.drugId ?? DEFAULT_DRUG_ID;
  const rulesetId = input.rulesetId ?? DEFAULT_RULESET_ID;
  const snapshotRecord = input.snapshot
    ? (input.snapshot as unknown as Record<string, unknown>)
    : {};

  const applicableRules = input.rules.filter((rule) => rule.drug_id === drugId);
  const evaluatedRules: RuleEvaluationEntry[] = applicableRules.map((rule) => {
    const value = snapshotValueForKey(snapshotRecord, rule.target_key);
    const compared = compareRule(rule, value);
    return {
      rule_id: rule.rule_id,
      name: rule.alert_message,
      status: compared.status,
      value: compared.value,
      threshold: formatThreshold(rule),
      rule_category: rule.rule_category,
      target_key: rule.target_key,
    };
  });

  const overallStatus: RuleEvaluationStatus = evaluatedRules.every(
    (entry) => entry.status === "PASS",
  )
    ? "PASS"
    : "FAIL";

  const matrix: RuleEvaluationMatrix = {
    active_ruleset: rulesetId,
    drug_id: drugId,
    evaluated_rules: evaluatedRules,
    overall_status: overallStatus,
  };

  return {
    matrix,
    handshake: {
      source_system: "TRA_SQLite_Engine",
      target_agent: "RuleEvaluationAgent",
      handshake_payload: {
        biometric_snapshot: snapshotRecord,
        active_ruleset: rulesetId,
      },
    },
  };
}
