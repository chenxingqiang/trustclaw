import type { Glp1CheckSnapshot } from "../../tra/types.js";

export type RuleEvaluationStatus = "PASS" | "FAIL";

export type RuleEvaluationEntry = {
  rule_id: string;
  name: string;
  status: RuleEvaluationStatus;
  value: number | string | null;
  threshold: string;
  rule_category: string;
  target_key: string;
};

export type RuleEvaluationMatrix = {
  active_ruleset: string;
  drug_id: string;
  evaluated_rules: RuleEvaluationEntry[];
  overall_status: RuleEvaluationStatus;
};

export type NrdlPaymentRuleRow = {
  rule_id: string;
  drug_id: string;
  rule_category: string;
  target_key: string;
  comparison_operator: string;
  comparison_value: string;
  alert_message: string;
};

export type RuleEvaluatorHandshake = {
  source_system: "TRA_SQLite_Engine";
  target_agent: "RuleEvaluationAgent";
  handshake_payload: {
    biometric_snapshot: Record<string, unknown>;
    active_ruleset: string;
  };
};

export type RuleEvaluationResult = {
  matrix: RuleEvaluationMatrix;
  handshake: RuleEvaluatorHandshake;
};

export type EvaluateGlp1RulesInput = {
  snapshot: Glp1CheckSnapshot | null;
  rules: NrdlPaymentRuleRow[];
  drugId?: string;
  rulesetId?: string;
};
