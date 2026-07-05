import { describe, expect, it } from "vitest";
import {
  AgentPackRegistry,
  DEFAULT_AGENT_PACK_ID,
  loadAgentPackFromFile,
  resetAgentPackRegistryCache,
  resolveDefaultAgentsDir,
  summarizeAgentPack,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import path from "node:path";

describe("agent pack registry", () => {
  it("loads bundled GLP-1 pack from trustclaw/agents", () => {
    const packFile = path.join(resolveDefaultAgentsDir(), "glp1", "agent.pack.json");
    const pack = loadAgentPackFromFile(packFile);
    expect(pack.id).toBe(DEFAULT_AGENT_PACK_ID);
    expect(pack.tools.read).toBe("trustclaw_ptds_query");
    expect(pack.tools.write).toBe("trustclaw_ptds_write");
    expect(pack.starterQuestions).toHaveLength(3);
    const zh = pack.starterQuestions?.map((question) => question["zh-CN"]) ?? [];
    expect(zh[0]).toContain("GLP-1");
    expect(zh[0]).toContain("司美格鲁肽");
    expect(zh[1]).toContain("度拉糖肽");
    expect(zh[2]).toContain("90 天后");
  });

  it("summarizes starter questions for agent pack API", () => {
    resetAgentPackRegistryCache();
    const registry = AgentPackRegistry.load();
    const pack = registry.get("glp1-eligibility");
    expect(pack).toBeDefined();
    const summary = summarizeAgentPack(pack!);
    expect(summary.starterQuestions).toHaveLength(3);
  });

  it("discovers multiple healthcare agent packs", () => {
    resetAgentPackRegistryCache();
    const registry = AgentPackRegistry.load();
    const ids = registry.list().map((pack) => pack.id);
    expect(ids).toContain("glp1-eligibility");
    expect(ids).toContain("nrdl-reimburse");
    expect(ids).toContain("compliance-auditor");
  });

  it("resolves pack by OpenClaw agentId", () => {
    resetAgentPackRegistryCache();
    const registry = AgentPackRegistry.load();
    expect(registry.resolve({ openclawAgentId: "compliance-auditor" }).id).toBe(
      "compliance-auditor",
    );
    expect(registry.resolve({ openclawAgentId: "unknown-agent" }).id).toBe(DEFAULT_AGENT_PACK_ID);
  });
});
