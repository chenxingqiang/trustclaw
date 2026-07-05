import type { Glp1CheckSnapshot, TraQueryResult } from "../../tra/types.js";
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
    raw_data: TraQueryResult | { snapshot: Glp1CheckSnapshot };
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
  agent_pack_id: string;
  pipeline_stages: PipelineStages;
  audit_trail_id: string;
  evidence_ledger_receipt?: {
    block_height: number;
    proof_hash: string;
    previous_evidence_hash: string | null;
  };
};

export type RunChatInput = {
  session_id: string;
  message: string;
  agent_pack_id?: string;
};

export type Text2SqlLlmCaller = (prompt: string) => Promise<string>;

export type RunChatOptions = {
  dbPath?: string;
  auditDir?: string;
  evidenceDir?: string;
  llm: Text2SqlLlmCaller;
  agentPack?: import("../agent-pack/index.js").ResolvedAgentPack;
};

export type RunChatResult =
  | { ok: true; context: RuntimeContext }
  | { ok: false; status: "tra_not_initialized" | "security_blocked"; message: string };
