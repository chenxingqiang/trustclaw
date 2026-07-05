import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { setSessionAgentPackId } from "../../../trustclaw/tra/session-agent-pack.js";
import { buildTrustclawTraAgentGuidance } from "./agent-guidance.js";

describe("trustclaw TRA agent guidance", () => {
  it("defines C3-PO TRA identity and rejects Claude Code persona", () => {
    const guidance = buildTrustclawTraAgentGuidance({});
    expect(guidance.prependSystemContext).toContain("C3-PO");
    expect(guidance.prependSystemContext).toContain("TRA Console");
    expect(guidance.prependSystemContext).toContain("trustclaw_tra_query");
    expect(guidance.prependSystemContext).toContain("trustclaw_tra_write");
    expect(guidance.agentPackId).toBe("glp1-eligibility");
    expect(guidance.prependSystemContext).toMatch(/not.*Claude Code/i);
  });

  it("includes what-can-you-do capability guidance", () => {
    const guidance = buildTrustclawTraAgentGuidance({});
    expect(guidance.prependSystemContext).toMatch(/what you can do/i);
    expect(guidance.prependSystemContext).toContain("Panel A");
    expect(guidance.prependSystemContext).toContain("evidence ledger");
  });

  it("selects compliance auditor pack by OpenClaw agentId", () => {
    const guidance = buildTrustclawTraAgentGuidance({ openclawAgentId: "compliance-auditor" });
    expect(guidance.agentPackId).toBe("compliance-auditor");
    expect(guidance.prependSystemContext).toContain("compliance and security audit");
    expect(guidance.prependSystemContext).not.toContain("trustclaw_tra_write");
  });

  it("prefers session-bound pack over OpenClaw agentId", () => {
    const auditDir = mkdtempSync(path.join(tmpdir(), "tra-guidance-pack-"));
    try {
      setSessionAgentPackId("sess_guidance", "nrdl-reimburse", { auditDir });
      const guidance = buildTrustclawTraAgentGuidance({
        sessionKey: "sess_guidance",
        openclawAgentId: "compliance-auditor",
        pluginConfig: { auditDir },
      });
      expect(guidance.agentPackId).toBe("nrdl-reimburse");
    } finally {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });
});
