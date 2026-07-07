import type { AgentPackValidationIssue } from "../api.js";

export function formatAgentPackValidationIssues(issues: AgentPackValidationIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
}

export function packDisplayLabel(
  pack: { id: string; displayName: { "zh-CN": string; en: string } },
  locale: string,
): string {
  return locale === "zh-CN" ? pack.displayName["zh-CN"] : pack.displayName.en;
}
