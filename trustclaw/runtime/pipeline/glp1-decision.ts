import type { Glp1CheckSnapshot } from "../../tra/types.js";
import type { RuleEvaluationMatrix } from "../rules/types.js";
import type { Glp1Citation, Glp1DecisionStage } from "./types.js";

export const TRA_MISSING_VITALS_MESSAGE =
  "由于本地数据空间缺少关键健康指标（如体重/血糖），无法做出用药评估，请先完善本地数据空间配置。";

export function buildGlp1Decision(params: {
  userQuery: string;
  snapshot: Glp1CheckSnapshot | null;
  matrix: RuleEvaluationMatrix;
}): Glp1DecisionStage {
  if (!params.snapshot) {
    return {
      response: TRA_MISSING_VITALS_MESSAGE,
      citations: [],
    };
  }

  const citations: Glp1Citation[] = params.matrix.evaluated_rules.map((rule, index) => ({
    index: index + 1,
    label: rule.name,
    value: rule.value,
    rule_id: rule.rule_id,
    source: "nrdl_payment_rules",
  }));

  const failed = params.matrix.evaluated_rules.filter((rule) => rule.status === "FAIL");
  const passed = params.matrix.evaluated_rules.filter((rule) => rule.status === "PASS");

  if (params.matrix.overall_status === "PASS") {
    const evidenceRefs = citations.map((c) => `[Evidence #${c.index}]`).join("");
    return {
      response:
        `根据您本地 TRA 数据与 NRDL 司美格鲁肽规则评估，当前指标满足用药路径的前置条件。${evidenceRefs} ` +
        `如需正式用药决策，请结合临床医生意见。`,
      citations,
    };
  }

  const failSummary = failed
    .map((rule) => {
      const citation = citations.find((entry) => entry.rule_id === rule.rule_id);
      const tag = citation ? `[Evidence #${citation.index}]` : "";
      return `${tag}${rule.name}（当前值 ${rule.value ?? "缺失"}，要求 ${rule.threshold}）`;
    })
    .join("；");

  const passNote = passed.length > 0 ? `已满足 ${passed.length} 项条件。` : "";

  return {
    response:
      `基于本地数据空间与 NRDL 规则，当前尚不满足司美格鲁肽用药路径：${failSummary}。${passNote}` +
      `您的问题「${params.userQuery.trim()}」需先补齐或修正相关指标后再评估。`,
    citations,
  };
}
