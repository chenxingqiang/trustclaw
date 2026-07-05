import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bootstrapTraDatabase } from "./db.js";
import { countDomainAgents, importDomainAgentsRegistrySql } from "./domain-agents-import.js";
import {
  migrateLegacyDomainAgentsTable,
  migrateLegacyTraStateFiles,
  normalizeLegacyTraNaming,
} from "./legacy-state-migration.js";

describe("normalizeLegacyTraNaming", () => {
  it("rewrites PTDS column and scope names to TRA", () => {
    const sql =
      "SELECT ptds_scopes, ptds_write FROM domain_agents WHERE pack_id = 'ptds-outpatient' AND scopes LIKE 'ptds.read'";
    const normalized = normalizeLegacyTraNaming(sql);
    expect(normalized).toContain("tra_scopes");
    expect(normalized).toContain("tra_write");
    expect(normalized).toContain("'tra-outpatient'");
    expect(normalized).toContain("tra.read");
    expect(normalized).not.toContain("ptds_scopes");
  });
});

describe("migrateLegacyTraStateFiles", () => {
  it("renames legacy TRA db file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-legacy-state-"));
    const stateDir = path.join(dir, "state");
    try {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(path.join(stateDir, "local_ptds.db"), "legacy");
      const result = migrateLegacyTraStateFiles(stateDir);
      expect(result.dbRenamed).toBe(true);
      expect(existsSync(path.join(stateDir, "local_tra.db"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("domain agents registry seed", () => {
  it("bootstraps 1000 domain_agents from bundled registry SQL", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-domain-seed-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      const db = bootstrapTraDatabase(dbPath);
      const total = countDomainAgents(db);
      db.close();
      expect(total).toBe(1000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("migrates legacy ptds_scopes column to tra_scopes", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-domain-migrate-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      const db = bootstrapTraDatabase(dbPath);
      db.exec("DROP TABLE IF EXISTS domain_agents");
      db.exec(`
        CREATE TABLE domain_agents (
          agent_id TEXT PRIMARY KEY,
          agent_name TEXT NOT NULL,
          domain TEXT NOT NULL,
          enabled TEXT NOT NULL,
          ptds_scopes TEXT,
          ptds_write INTEGER,
          pack_id TEXT
        );
      `);
      db.prepare(
        `INSERT INTO domain_agents (agent_id, agent_name, domain, enabled, ptds_scopes, ptds_write, pack_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run("legacy-1", "Legacy", "audit", "false", "ptds.read,ptds.chat", 0, "ptds-audit");
      migrateLegacyDomainAgentsTable(db);
      const row = db
        .prepare("SELECT tra_scopes, pack_id FROM domain_agents WHERE agent_id = ?")
        .get("legacy-1") as { tra_scopes: string; pack_id: string };
      expect(row.tra_scopes).toContain("tra.read");
      expect(row.pack_id).toBe("tra-audit");
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("imports legacy SQL payloads after normalization", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-domain-import-"));
    const dbPath = path.join(dir, "local_tra.db");
    try {
      const db = bootstrapTraDatabase(dbPath);
      db.exec("DROP TABLE IF EXISTS domain_agents");
      const total = importDomainAgentsRegistrySql(
        db,
        `
        CREATE TABLE domain_agents (
          agent_id TEXT PRIMARY KEY,
          agent_name TEXT NOT NULL,
          domain TEXT NOT NULL,
          enabled TEXT NOT NULL,
          ptds_scopes TEXT
        );
        INSERT INTO domain_agents (agent_id, agent_name, domain, enabled, ptds_scopes)
        VALUES ('x-1', 'Legacy Agent', 'audit', 'false', 'ptds.read');
      `,
        { replace: true },
      );
      expect(total).toBe(1);
      const row = db
        .prepare("SELECT tra_scopes FROM domain_agents WHERE agent_id = ?")
        .get("x-1") as { tra_scopes: string };
      expect(row.tra_scopes).toBe("tra.read");
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
