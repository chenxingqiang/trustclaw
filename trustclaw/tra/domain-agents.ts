import { openTraDatabase } from "./db.js";
import { resolveTraDbPath, type TraPathOverrides } from "./paths.js";

export type DomainAgentEnabled = "false" | "partial" | "true" | string;

export type DomainAgentRow = {
  agent_id: string;
  agent_name: string;
  domain: string;
  subdomain: string | null;
  region: string | null;
  insurance_type: string | null;
  enabled: DomainAgentEnabled;
  tra_scopes: string | null;
  tra_write: number | null;
  pack_id: string | null;
  pack_version: string | null;
  registered_at: string | null;
};

export type DomainAgentSummary = {
  total: number;
  by_enabled: Record<string, number>;
  by_pack: Record<string, number>;
};

export type DomainAgentListResult = {
  available: boolean;
  agents: DomainAgentRow[];
  summary: DomainAgentSummary;
};

export type DomainAgentListFilters = {
  pack_id?: string;
  enabled?: string;
  domain?: string;
};

function domainAgentsTableExists(dbPath: string): boolean {
  const db = openTraDatabase(dbPath);
  try {
    const row = db
      .prepare(
        "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'domain_agents' LIMIT 1",
      )
      .get() as { ok: number } | undefined;
    return row?.ok === 1;
  } finally {
    db.close();
  }
}

function emptySummary(): DomainAgentSummary {
  return { total: 0, by_enabled: {}, by_pack: {} };
}

function summarizeAgents(agents: DomainAgentRow[]): DomainAgentSummary {
  const by_enabled: Record<string, number> = {};
  const by_pack: Record<string, number> = {};
  for (const agent of agents) {
    by_enabled[agent.enabled] = (by_enabled[agent.enabled] ?? 0) + 1;
    const packKey = agent.pack_id?.trim() || "(unassigned)";
    by_pack[packKey] = (by_pack[packKey] ?? 0) + 1;
  }
  return { total: agents.length, by_enabled, by_pack };
}

export function listDomainAgents(
  overrides: TraPathOverrides = {},
  filters: DomainAgentListFilters = {},
  env: NodeJS.ProcessEnv = process.env,
): DomainAgentListResult {
  const dbPath = resolveTraDbPath(overrides, env);
  if (!domainAgentsTableExists(dbPath)) {
    return { available: false, agents: [], summary: emptySummary() };
  }

  const db = openTraDatabase(dbPath);
  try {
    const clauses: string[] = [];
    const params: string[] = [];
    if (filters.pack_id?.trim()) {
      clauses.push("pack_id = ?");
      params.push(filters.pack_id.trim());
    }
    if (filters.enabled?.trim()) {
      clauses.push("enabled = ?");
      params.push(filters.enabled.trim());
    }
    if (filters.domain?.trim()) {
      clauses.push("domain = ?");
      params.push(filters.domain.trim());
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db
      .prepare(
        `SELECT agent_id, agent_name, domain, subdomain, region, insurance_type, enabled, tra_scopes, tra_write, pack_id, pack_version, registered_at
         FROM domain_agents
         ${where}
         ORDER BY domain ASC, agent_id ASC`,
      )
      .all(...params) as DomainAgentRow[];

    return {
      available: true,
      agents: rows,
      summary: summarizeAgents(rows),
    };
  } finally {
    db.close();
  }
}
