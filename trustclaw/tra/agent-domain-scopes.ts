import type { AgentPackDocument } from "../runtime/agent-pack/schema.js";

/** User-grantable scopes that gate Panel B/D/E/F and chat tool access per domain agent. */
export const AGENT_DOMAIN_SCOPES = [
  "panel.browse",
  "panel.audit",
  "panel.ledger",
  "panel.compliance",
  "tra.chat",
  "tra.write",
] as const;

export type AgentDomainScope = (typeof AGENT_DOMAIN_SCOPES)[number];

export const AGENT_DOMAIN_SCOPE_LABELS: Record<AgentDomainScope, { "zh-CN": string; en: string }> =
  {
    "panel.browse": {
      "zh-CN": "Panel B · 数据浏览（readTables）",
      en: "Panel B · data browser (readTables)",
    },
    "panel.audit": {
      "zh-CN": "Panel D · 审计时间线",
      en: "Panel D · audit timeline",
    },
    "panel.ledger": {
      "zh-CN": "Panel E · 证据账本",
      en: "Panel E · evidence ledger",
    },
    "panel.compliance": {
      "zh-CN": "Panel F · 合规订阅/导入",
      en: "Panel F · compliance subscription/import",
    },
    "tra.chat": {
      "zh-CN": "Chat / TRA 查询工具",
      en: "Chat / TRA query tool",
    },
    "tra.write": {
      "zh-CN": "TRA 写入工具",
      en: "TRA write tool",
    },
  };

/** Derive grantable scopes from a pack manifest (TRA runtime stays pack-agnostic). */
export function deriveAgentDomainScopes(pack: AgentPackDocument): AgentDomainScope[] {
  const scopes = new Set<AgentDomainScope>();

  if (pack.data.readTables.length > 0) {
    scopes.add("panel.browse");
    scopes.add("tra.chat");
  }
  if (pack.tools.write) {
    scopes.add("tra.write");
  }
  scopes.add("panel.audit");
  if (pack.pipeline.stages.includes("LEDGER_COMMIT")) {
    scopes.add("panel.ledger");
  }
  const domains = pack.domain ?? [];
  if (pack.id === "compliance-auditor" || domains.includes("compliance")) {
    scopes.add("panel.compliance");
  }

  return AGENT_DOMAIN_SCOPES.filter((scope) => scopes.has(scope));
}

export function isAgentDomainScope(value: string): value is AgentDomainScope {
  return (AGENT_DOMAIN_SCOPES as readonly string[]).includes(value);
}

/** Tables a pack may browse when `panel.browse` is granted. */
export function resolveAgentBrowseTables(pack: AgentPackDocument): readonly string[] {
  return pack.data.readTables;
}
