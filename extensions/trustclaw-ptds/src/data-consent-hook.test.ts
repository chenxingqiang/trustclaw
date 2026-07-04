import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveAgentDomainScopes } from "../../../trustclaw/ptds/agent-domain-scopes.js";
import {
  initializePtds,
  PTDS_INIT_DEFAULTS,
  setAgentDomainGrant,
} from "../../../trustclaw/ptds/index.js";
import { getAgentPackRegistry } from "../../../trustclaw/runtime/agent-pack/index.js";
import {
  buildPtdsDataConsentDescription,
  createTrustclawPtdsDataConsentHook,
} from "./data-consent-hook.js";

const sampleInitPayload = {
  ...PTDS_INIT_DEFAULTS,
  weight: 85,
  height: 170,
  hba1c: 6.8,
  hasType2Diabetes: true,
};

describe("trustclaw-ptds data consent hook", () => {
  it("blocks trustclaw_ptds_query when domain agent is not granted", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-consent-no-grant-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "audit");
    try {
      initializePtds(sampleInitPayload, dbPath);
      const hook = createTrustclawPtdsDataConsentHook({ dbPath, auditDir });
      const result = await hook(
        { toolName: "trustclaw_ptds_query", params: { message: "test" } },
        { sessionKey: "sess_no_grant" },
      );
      expect(result?.block).toBe(true);
      expect(result?.blockReason).toContain("Panel C");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks trustclaw_ptds_query when PTDS is not mounted", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-consent-hook-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "audit");
    try {
      const hook = createTrustclawPtdsDataConsentHook({ dbPath, auditDir });
      const result = await hook(
        { toolName: "trustclaw_ptds_query", params: { message: "test" } },
        { sessionKey: "sess_1" },
      );
      expect(result?.block).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("requires approval listing private data fields when mounted", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-consent-hook-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "audit");
    try {
      initializePtds(sampleInitPayload, dbPath);
      const pack = getAgentPackRegistry().get("glp1-eligibility")!;
      setAgentDomainGrant(pack.id, deriveAgentDomainScopes(pack), { dbPath, auditDir });
      const hook = createTrustclawPtdsDataConsentHook({ dbPath, auditDir });
      const result = await hook(
        {
          toolName: "trustclaw_ptds_query",
          params: { message: "我可以用司美格鲁肽吗？" },
        },
        { sessionKey: "sess_2" },
      );
      expect(result?.requireApproval?.title).toContain("个人健康数据");
      expect(result?.requireApproval?.description).toContain("HbA1c");
      expect(result?.requireApproval?.allowedDecisions).toContain("allow-once");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("requires write approval when mounted (no allow-always)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-consent-write-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "audit");
    try {
      initializePtds(sampleInitPayload, dbPath);
      const pack = getAgentPackRegistry().get("glp1-eligibility")!;
      setAgentDomainGrant(pack.id, deriveAgentDomainScopes(pack), { dbPath, auditDir });
      const hook = createTrustclawPtdsDataConsentHook({ dbPath, auditDir });
      const result = await hook(
        {
          toolName: "trustclaw_ptds_write",
          params: { message: "90天后体重72kg，HbA1c 6.5%" },
        },
        { sessionKey: "sess_write" },
      );
      expect(result?.requireApproval?.title).toContain("写入");
      expect(result?.requireApproval?.allowedDecisions).toEqual(["allow-once", "deny"]);
      expect(result?.requireApproval?.description).toContain("INSERT");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks trustclaw_ptds_write when PTDS is not mounted", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-consent-write-block-"));
    const dbPath = path.join(dir, "local_ptds.db");
    const auditDir = path.join(dir, "audit");
    try {
      const hook = createTrustclawPtdsDataConsentHook({ dbPath, auditDir });
      const result = await hook(
        { toolName: "trustclaw_ptds_write", params: { message: "record weight 72kg" } },
        { sessionKey: "sess_3" },
      );
      expect(result?.block).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds bounded consent descriptions", () => {
    const description = buildPtdsDataConsentDescription("x".repeat(200), [
      "患者姓名",
      "糖化血红蛋白 HbA1c",
    ]);
    expect(description.length).toBeLessThanOrEqual(256);
    expect(description).toContain("患者姓名");
  });
});
