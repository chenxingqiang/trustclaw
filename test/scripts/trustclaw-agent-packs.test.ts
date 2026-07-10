import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isNonWritableAgentPacksDir,
  resolveOperatorAgentPacksDir,
  resolveTrustclawTraPluginConfig,
  seedBundledAgentPacksIfMissing,
} from "../../scripts/lib/trustclaw-agent-packs.mjs";
import { resolveTrustclawProfileStateDir } from "../../scripts/lib/trustclaw-defaults.mjs";

function writePackDir(root: string, folderName: string, packId: string) {
  const packDir = path.join(root, folderName);
  mkdirSync(path.join(packDir, "prompts"), { recursive: true });
  writeFileSync(
    path.join(packDir, "agent.pack.json"),
    JSON.stringify({ id: packId, version: "1.0.0" }, null, 2),
  );
  writeFileSync(path.join(packDir, "prompts", "system.md"), "# test");
}

describe("trustclaw profile paths", () => {
  it("resolveTrustclawProfileStateDir maps default and dev profiles", () => {
    expect(resolveTrustclawProfileStateDir("/home/op", [])).toBe("/home/op/.openclaw");
    expect(resolveTrustclawProfileStateDir("/home/op", ["--dev"])).toBe("/home/op/.openclaw-dev");
  });
});

describe("trustclaw-agent-packs", () => {
  it("resolveTrustclawTraPluginConfig defaults agentPacksDir under state dir", () => {
    const merged = resolveTrustclawTraPluginConfig({}, "/home/op/.openclaw");
    expect(merged.enabled).toBe(true);
    expect(merged.config?.agentPacksDir).toBe("/home/op/.openclaw/agent-packs");
    expect(merged.config?.defaultAgentPack).toBe("glp1-eligibility");
  });

  it("resolveTrustclawTraPluginConfig preserves operator agentPacksDir override", () => {
    const merged = resolveTrustclawTraPluginConfig(
      { config: { agentPacksDir: "/srv/packs", defaultAgentPack: "custom-pack" } },
      "/home/op/.openclaw",
    );
    expect(merged.config?.agentPacksDir).toBe("/srv/packs");
    expect(merged.config?.defaultAgentPack).toBe("custom-pack");
  });

  it("rewrites image-bundled and legacy merged dirs to writable agent-packs", () => {
    expect(isNonWritableAgentPacksDir("/app/trustclaw/agents")).toBe(true);
    expect(isNonWritableAgentPacksDir("/home/node/.openclaw/state/trustclaw-agents-merged")).toBe(
      true,
    );
    expect(isNonWritableAgentPacksDir("/home/node/.openclaw/agent-packs")).toBe(false);

    const fromImage = resolveTrustclawTraPluginConfig(
      { config: { agentPacksDir: "/app/trustclaw/agents" } },
      "/home/node/.openclaw",
    );
    expect(fromImage.config?.agentPacksDir).toBe("/home/node/.openclaw/agent-packs");

    const fromMerged = resolveTrustclawTraPluginConfig(
      { config: { agentPacksDir: "/home/node/.openclaw/state/trustclaw-agents-merged" } },
      "/home/node/.openclaw",
    );
    expect(fromMerged.config?.agentPacksDir).toBe("/home/node/.openclaw/agent-packs");
  });

  it("resolveOperatorAgentPacksDir nests under state dir", () => {
    expect(resolveOperatorAgentPacksDir("/home/operator/.openclaw")).toBe(
      path.join("/home/operator/.openclaw", "agent-packs"),
    );
  });

  it("seedBundledAgentPacksIfMissing copies packs once and skips scaffolding", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tc-agent-packs-"));
    const bundled = path.join(root, "bundled");
    const target = path.join(root, "target");
    try {
      writePackDir(bundled, "glp1", "glp1-eligibility");
      writePackDir(bundled, "compliance-auditor", "compliance-auditor");
      mkdirSync(path.join(bundled, "_template"), { recursive: true });
      writeFileSync(path.join(bundled, "_template", "agent.pack.json"), "{}");

      const first = seedBundledAgentPacksIfMissing(bundled, target);
      expect(first.seeded.sort()).toEqual(["compliance-auditor", "glp1"]);
      expect(first.skipped).toEqual([]);
      expect(readFileSync(path.join(target, "glp1", "prompts", "system.md"), "utf8")).toBe(
        "# test",
      );

      const second = seedBundledAgentPacksIfMissing(bundled, target);
      expect(second.seeded).toEqual([]);
      expect(second.skipped.sort()).toEqual(["compliance-auditor", "glp1"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("seedBundledAgentPacksIfMissing is a no-op when bundled dir is missing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tc-agent-packs-missing-"));
    try {
      const result = seedBundledAgentPacksIfMissing(
        path.join(root, "missing-bundled"),
        path.join(root, "target"),
      );
      expect(result).toEqual({ seeded: [], skipped: [] });
      expect(existsSync(path.join(root, "target"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves operator edits by not overwriting existing pack folders", () => {
    const root = mkdtempSync(path.join(tmpdir(), "tc-agent-packs-edit-"));
    const bundled = path.join(root, "bundled");
    const target = path.join(root, "target");
    try {
      writePackDir(bundled, "glp1", "glp1-eligibility");
      writePackDir(target, "glp1", "glp1-eligibility");
      writeFileSync(path.join(target, "glp1", "prompts", "system.md"), "# operator-owned");

      const result = seedBundledAgentPacksIfMissing(bundled, target);
      expect(result.seeded).toEqual([]);
      expect(result.skipped).toEqual(["glp1"]);
      expect(readFileSync(path.join(target, "glp1", "prompts", "system.md"), "utf8")).toBe(
        "# operator-owned",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("normalize-domain-agent-pack", () => {
  it("maps legacy ptds folder names to tra pack ids", async () => {
    const mod = await import("../../scripts/lib/normalize-domain-agent-pack.mjs");
    expect(mod.resolveTargetPackId("ptds-outpatient")).toBe("tra-outpatient");
    expect(mod.resolveTargetPackId("tra-audit")).toBe("tra-audit");
    expect(mod.resolveTargetPackId("glp1")).toBeNull();
    expect(mod.DOMAIN_AGENT_PACK_IDS).toHaveLength(10);
  });

  it("migrates legacy ptds agent ids in agents.list to tra-*", async () => {
    const mod = await import("../../scripts/lib/normalize-domain-agent-pack.mjs");
    const result = mod.migrateLegacyAgentsList(
      [
        { id: "main", default: true },
        { id: "ptds-audit", model: "sonnet" },
        { id: "tra-audit", model: "sonnet" },
        {
          id: "ptds-outpatient",
          workspace: "/home/node/.openclaw/workspace/trustclaw-agents/ptds-outpatient",
        },
      ],
      "/home/node/.openclaw",
    );
    expect(result.changed).toBe(true);
    expect(result.migrated).toEqual(["ptds-audit→tra-audit", "ptds-outpatient→tra-outpatient"]);
    expect(result.agentsList.map((entry) => entry.id)).toEqual([
      "main",
      "tra-audit",
      "tra-outpatient",
    ]);
    expect(result.agentsList[2].workspace).toBe(
      "/home/node/.openclaw/workspace/trustclaw-agents/tra-outpatient",
    );
  });

  it("normalizes legacy pack manifest tools and audit ids", async () => {
    const mod = await import("../../scripts/lib/normalize-domain-agent-pack.mjs");
    const pack = mod.normalizeLegacyPackManifest(
      {
        id: "ptds-pharmacy",
        openclaw: { agentId: "ptds-pharmacy" },
        tools: { read: "trustclaw_ptds_query" },
        audit: { businessComponent: "PTDS.Agent.Pharmacy" },
      },
      "tra-pharmacy",
    );
    expect(pack.id).toBe("tra-pharmacy");
    expect(pack.openclaw.agentId).toBe("tra-pharmacy");
    expect(pack.tools.read).toBe("trustclaw_tra_query");
    expect(pack.audit.businessComponent).toBe("TRA.Agent.Pharmacy");
  });
});

describe("seedDomainAgentPackWorkspace", () => {
  it("copies only tra-* packs into workspace trustclaw-agents", async () => {
    const { seedDomainAgentPackWorkspace } =
      await import("../../scripts/lib/trustclaw-agent-packs.mjs");
    const root = mkdtempSync(path.join(tmpdir(), "tc-domain-workspace-"));
    const bundled = path.join(root, "bundled");
    const workspace = path.join(root, "workspace");
    try {
      writePackDir(bundled, "tra-audit", "tra-audit");
      writePackDir(bundled, "glp1", "glp1-eligibility");
      const result = seedDomainAgentPackWorkspace(bundled, workspace);
      expect(result.seeded).toEqual(["tra-audit"]);
      expect(existsSync(path.join(workspace, "tra-audit", "agent.pack.json"))).toBe(true);
      expect(existsSync(path.join(workspace, "glp1", "agent.pack.json"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
