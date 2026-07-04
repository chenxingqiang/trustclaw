import { describe, expect, it } from "vitest";
import { TRUSTCLAW_PTDS_AGENT_GUIDANCE } from "./agent-guidance.js";

describe("trustclaw PTDS agent guidance", () => {
  it("defines C3-PO PTDS identity and rejects Claude Code persona", () => {
    expect(TRUSTCLAW_PTDS_AGENT_GUIDANCE).toContain("C3-PO");
    expect(TRUSTCLAW_PTDS_AGENT_GUIDANCE).toContain("PTDS Console");
    expect(TRUSTCLAW_PTDS_AGENT_GUIDANCE).toContain("trustclaw_ptds_query");
    expect(TRUSTCLAW_PTDS_AGENT_GUIDANCE).toMatch(/not.*Claude Code/i);
  });

  it("includes what-can-you-do capability guidance", () => {
    expect(TRUSTCLAW_PTDS_AGENT_GUIDANCE).toMatch(/what you can do/i);
    expect(TRUSTCLAW_PTDS_AGENT_GUIDANCE).toContain("Panel A");
    expect(TRUSTCLAW_PTDS_AGENT_GUIDANCE).toContain("evidence ledger");
  });
});
