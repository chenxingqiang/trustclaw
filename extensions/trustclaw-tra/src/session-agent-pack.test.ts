import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resetAgentPackRegistryCache } from "../../../trustclaw/runtime/agent-pack/index.js";
import { resolveCoordinatorAgentPack } from "../../../trustclaw/runtime/coordinator/index.js";
import {
  clearSessionAgentPackId,
  getSessionAgentPackId,
  getSessionAgentPackLock,
  setSessionAgentPackBinding,
  setSessionAgentPackId,
} from "../../../trustclaw/tra/session-agent-pack.js";

describe("session agent pack store", () => {
  let auditDir = "";

  afterEach(() => {
    if (auditDir) {
      rmSync(auditDir, { recursive: true, force: true });
      auditDir = "";
    }
    resetAgentPackRegistryCache();
  });

  it("persists pack id and lock per session key", () => {
    auditDir = mkdtempSync(path.join(tmpdir(), "tra-session-pack-"));
    const overrides = { auditDir };

    expect(getSessionAgentPackId("sess_a", overrides)).toBeUndefined();
    setSessionAgentPackBinding("sess_a", "nrdl-reimburse", overrides);
    expect(getSessionAgentPackId("sess_a", overrides)).toBe("nrdl-reimburse");
    expect(getSessionAgentPackLock("sess_a", overrides)).toBe("nrdl-reimburse");

    clearSessionAgentPackId("sess_a", overrides);
    expect(getSessionAgentPackId("sess_a", overrides)).toBeUndefined();
    expect(getSessionAgentPackLock("sess_a", overrides)).toBeUndefined();
  });
});

describe("resolveCoordinatorAgentPack", () => {
  afterEach(() => {
    resetAgentPackRegistryCache();
  });

  it("prefers session override over OpenClaw agent mapping", () => {
    const auditDir = mkdtempSync(path.join(tmpdir(), "tra-resolve-pack-"));
    try {
      setSessionAgentPackBinding("sess_override", "glp1-eligibility", { auditDir });
      const resolved = resolveCoordinatorAgentPack({
        sessionKey: "sess_override",
        openclawAgentId: "compliance-auditor",
        pluginConfig: { auditDir },
        bindLock: false,
      });
      expect(resolved.source).toBe("session");
      expect(resolved.pack.id).toBe("glp1-eligibility");
    } finally {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  it("maps OpenClaw agent id when no session override", () => {
    const resolved = resolveCoordinatorAgentPack({
      sessionKey: "sess_agent",
      openclawAgentId: "compliance-auditor",
      bindLock: false,
    });
    expect(resolved.source).toBe("openclaw_agent");
    expect(resolved.pack.id).toBe("compliance-auditor");
  });
});
