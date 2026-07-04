import type { Glp1CheckSnapshot, PtdsQueryResult } from "../../ptds/types.js";
import type { RuleEvaluationMatrix } from "../rules/types.js";
import type { Text2SqlGenerateResult } from "../text2sql/types.js";

export type Glp1Citation = {
  index: number;
  label: string;
  value: string | number | null;
  rule_id: string;
  source: "nrdl_payment_rules" | "v_glp1_nrdl_check_snapshot";
};

export type Glp1DecisionStage = {
  response: string;
  citations: Glp1Citation[];
};

export type PipelineStages = {
  text2sql: Pick<Text2SqlGenerateResult, "sql" | "duration_ms"> & {
    source: Text2SqlGenerateResult["source"];
    security_error?: string;
  };
  db_query: {
    raw_data: PtdsQueryResult | { snapshot: Glp1CheckSnapshot };
    skipped?: boolean;
  };
  rule_evaluation: {
    evaluated_rules: RuleEvaluationMatrix["evaluated_rules"];
    overall_status: RuleEvaluationMatrix["overall_status"];
    active_ruleset: string;
  };
  agent_decision: Glp1DecisionStage;
};

export type RuntimeContext = {
  session_id: string;
  user_query: string;
  pipeline_stages: PipelineStages;
  audit_trail_id: string;
  evidence_ledger_receipt: {
    block_height: number;
    proof_hash: string;
  };
};

export type RunChatInput = {
  session_id: string;
  message: string;
};

export type Text2SqlLlmCaller = (prompt: string) => Promise<string>;

export type RunChatOptions = {
  dbPath?: string;
  auditDir?: string;
  llm: Text2SqlLlmCaller;
};

export type RunChatResult =
  | { ok: true; context: RuntimeContext }
  | { ok: false; status: "ptds_not_initialized" | "security_blocked"; message: string };
