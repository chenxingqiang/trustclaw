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

export function isAgentPackWriteDisabledError(message: string): boolean {
  return message.includes("pack_write_disabled") || message.includes("403");
}

/** Minimal authoring starter aligned with `trustclaw/agents/_template/agent.pack.json`. */
export function buildNewAgentPackDraft(packId = "new-pack-id"): Record<string, unknown> {
  return {
    id: packId,
    version: "0.0.1",
    displayName: {
      "zh-CN": "新业务 Agent Pack",
      en: "New business agent pack",
    },
    domain: ["your-domain-slug"],
    starterQuestions: [
      {
        "zh-CN": "请用一句话描述你要查询的数据范围。",
        en: "Describe the data scope you want to query in one sentence.",
      },
      {
        "zh-CN": "本次对话需要读取哪些本地表？",
        en: "Which local tables should this conversation read?",
      },
      {
        "zh-CN": "是否需要写入个人数据？",
        en: "Do you need to write personal data?",
      },
    ],
    openclaw: {
      agentId: packId,
      persona: "Replace with pack-specific persona id or label.",
    },
    tools: {
      read: "trustclaw_tra_query",
    },
    prompts: {
      system: "prompts/system.v1.md",
      text2sql: "prompts/text2sql.v1.md",
    },
    data: {
      readTables: ["REPLACE_WITH_YOUR_TABLE"],
    },
    rules: {
      engine: "none",
    },
    pipeline: {
      stages: ["TEXT2SQL_GEN", "DB_QUERY", "AGENT_DECISION"],
      decisionBuilder: "pass-through",
    },
    consent: {
      read: { allowAlways: false },
      write: { allowAlways: false },
    },
    audit: {
      businessComponent: "TRA.Agent.NewPack",
      decisionComponent: "Agent.NewPackDecision",
    },
  };
}
