import { describe, expect, it } from "vitest";
import { auditEventMatchesAgentPack } from "./agent-pack-filter.js";

describe("auditEventMatchesAgentPack", () => {
  it("matches when input.agent_pack_id equals the requested pack", () => {
    expect(
      auditEventMatchesAgentPack(
        { input: { agent_pack_id: "glp1-eligibility" } },
        "glp1-eligibility",
      ),
    ).toBe(true);
  });

  it("rejects cross-agent rows and legacy rows without agent_pack_id", () => {
    expect(
      auditEventMatchesAgentPack(
        { input: { agent_pack_id: "compliance-auditor" } },
        "glp1-eligibility",
      ),
    ).toBe(false);
    expect(auditEventMatchesAgentPack({ input: { standard_id: "nrdl" } }, "glp1-eligibility")).toBe(
      false,
    );
  });
});
