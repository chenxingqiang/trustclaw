import { describe, expect, it } from "vitest";
import {
  getAgentPackRegistry,
  loadAgentPackText2SqlTemplate,
  resetAgentPackRegistryCache,
} from "../../../trustclaw/runtime/agent-pack/index.js";
import { buildText2SqlPrompt } from "../../../trustclaw/runtime/text2sql/prompt.js";
import { loadTraSchemaSnippetForObjects } from "../../../trustclaw/runtime/text2sql/schema-context.js";

describe("agent pack Text2SQL prompts", () => {
  it("loads pack-specific templates and schema subsets", () => {
    resetAgentPackRegistryCache();
    const registry = getAgentPackRegistry();
    const compliance = registry.get("compliance-auditor");
    expect(compliance).toBeDefined();
    const template = loadAgentPackText2SqlTemplate(compliance!);
    expect(template).toContain("medication_compliance_standards");
    const schema = loadTraSchemaSnippetForObjects(compliance!.data.readTables);
    expect(schema).toContain("medication_compliance_standards");
    expect(schema).not.toContain("body_anthropometrics");

    const prompt = buildText2SqlPrompt({
      userQuery: "当前激活的标准是什么？",
      databaseSchema: schema,
      promptTemplate: template,
    });
    expect(prompt).toContain("当前激活的标准是什么？");
    expect(prompt).toContain("data_source_registry");
  });

  it("loads NRDL pack Text2SQL template", () => {
    resetAgentPackRegistryCache();
    const nrdl = getAgentPackRegistry().get("nrdl-reimburse");
    expect(nrdl).toBeDefined();
    const template = loadAgentPackText2SqlTemplate(nrdl!);
    expect(template).toContain("nrdl_payment_rules");
  });
});
