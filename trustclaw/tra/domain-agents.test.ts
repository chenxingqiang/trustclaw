import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openTraDatabase } from "./db.js";
import { listDomainAgents } from "./domain-agents.js";

function seedDomainAgentsTable(dbPath: string): void {
  const db = openTraDatabase(dbPath);
  try {
    db.exec(`
      CREATE TABLE domain_agents (
        agent_id TEXT PRIMARY KEY,
        agent_name TEXT NOT NULL,
        domain TEXT NOT NULL,
        subdomain TEXT,
        region TEXT,
        insurance_type TEXT,
        enabled TEXT NOT NULL,
        tra_scopes TEXT,
        tra_write INTEGER,
        pack_id TEXT,
        pack_version TEXT,
        registered_at TEXT
      );
    `);
    db.prepare(
      `INSERT INTO domain_agents (agent_id, agent_name, domain, enabled, pack_id)
       VALUES (?, ?, ?, ?, ?)`,
    ).run("op-001", "Outpatient 1", "outpatient", "partial", "tra-outpatient");
    db.prepare(
      `INSERT INTO domain_agents (agent_id, agent_name, domain, enabled, pack_id)
       VALUES (?, ?, ?, ?, ?)`,
    ).run("op-002", "Outpatient 2", "outpatient", "false", "tra-outpatient");
    db.prepare(
      `INSERT INTO domain_agents (agent_id, agent_name, domain, enabled, pack_id)
       VALUES (?, ?, ?, ?, ?)`,
    ).run("drg-001", "Drug 1", "pharmacy", "partial", "tra-pharmacy");
  } finally {
    db.close();
  }
}

describe("listDomainAgents", () => {
  it("returns unavailable when domain_agents table is missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-domain-agents-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      openTraDatabase(dbPath).close();
      const result = listDomainAgents({ dbPath });
      expect(result.available).toBe(false);
      expect(result.agents).toEqual([]);
      expect(result.summary.total).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists agents with filters and summary", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-domain-agents-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      seedDomainAgentsTable(dbPath);
      const all = listDomainAgents({ dbPath });
      expect(all.available).toBe(true);
      expect(all.agents).toHaveLength(3);
      expect(all.summary.total).toBe(3);
      expect(all.summary.by_enabled.partial).toBe(2);
      expect(all.summary.by_enabled.false).toBe(1);

      const partial = listDomainAgents({ dbPath }, { enabled: "partial" });
      expect(partial.agents).toHaveLength(2);
      expect(partial.agents.every((row) => row.enabled === "partial")).toBe(true);

      const pack = listDomainAgents({ dbPath }, { pack_id: "tra-outpatient" });
      expect(pack.agents).toHaveLength(2);
      expect(pack.summary.by_pack["tra-outpatient"]).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
