import type { Glp1CheckSnapshot } from "../../tra/types.js";
import type { ResolvedAgentPack } from "../agent-pack/index.js";
import type { RuleEvaluationMatrix } from "../rules/types.js";
import { buildGlp1Decision } from "./glp1-decision.js";
import type { Glp1DecisionStage } from "./types.js";

export function buildPackAgentDecision(
  pack: ResolvedAgentPack,
  params: {
    userQuery: string;
    snapshot: Glp1CheckSnapshot | null;
    matrix: RuleEvaluationMatrix;
  },
): Glp1DecisionStage {
  if (pack.pipeline.decisionBuilder === "pass-through") {
    return {
      response:
        `(${pack.displayName.en}) Query recorded. Summarize TRA query results and audit metadata only; ` +
        `do not provide clinical prescribing advice. User question: ${params.userQuery}`,
      citations: [],
    };
  }
  return buildGlp1Decision(params);
}

export function packIncludesStage(
  pack: ResolvedAgentPack,
  stage: ResolvedAgentPack["pipeline"]["stages"][number],
): boolean {
  return pack.pipeline.stages.includes(stage);
}
