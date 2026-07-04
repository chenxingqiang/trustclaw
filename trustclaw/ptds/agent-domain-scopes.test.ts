import { describe, expect, it } from "vitest";
import { getAgentPackRegistry } from "../runtime/agent-pack/index.js";
import { deriveAgentDomainScopes } from "./agent-domain-scopes.js";

describe("deriveAgentDomainScopes", () => {
  it("derives distinct scopes per bundled pack", () => {
    const registry = getAgentPackRegistry();
    const glp1 = registry.get("glp1-eligibility")!;
    const auditor = registry.get("compliance-auditor")!;

    expect(deriveAgentDomainScopes(glp1)).toContain("ptds.chat");
    expect(deriveAgentDomainScopes(glp1)).toContain("panel.browse");
    expect(deriveAgentDomainScopes(glp1)).not.toContain("panel.compliance");

    expect(deriveAgentDomainScopes(auditor)).toContain("panel.compliance");
    expect(deriveAgentDomainScopes(auditor)).not.toContain("ptds.write");
  });
});
