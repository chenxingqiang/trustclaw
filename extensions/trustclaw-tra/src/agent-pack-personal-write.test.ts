import { describe, expect, it } from "vitest";
import {
  getAgentPackRegistry,
  loadAgentPackPersonalWriteTemplate,
  resetAgentPackRegistryCache,
} from "../../../trustclaw/runtime/agent-pack/index.js";

describe("agent pack personal write prompts", () => {
  it("loads glp1 personal write template from pack", () => {
    resetAgentPackRegistryCache();
    const pack = getAgentPackRegistry().get("glp1-eligibility");
    expect(pack).toBeDefined();
    const template = loadAgentPackPersonalWriteTemplate(pack!);
    expect(template).toContain("{{WRITE_REQUEST}}");
    expect(template).toContain("INSERT");
  });
});
