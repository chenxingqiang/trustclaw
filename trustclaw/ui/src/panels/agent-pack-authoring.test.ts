import { describe, expect, it } from "vitest";
import {
  formatAgentPackValidationIssues,
  packDisplayLabel,
} from "./agent-pack-authoring-format.js";

describe("formatAgentPackValidationIssues", () => {
  it("joins zod issue paths and messages", () => {
    expect(
      formatAgentPackValidationIssues([
        { path: "id", message: "Invalid" },
        { path: "(root)", message: "Required" },
      ]),
    ).toBe("id: Invalid\n(root): Required");
  });
});

describe("packDisplayLabel", () => {
  it("picks zh-CN or en display name", () => {
    const pack = {
      id: "demo",
      displayName: { "zh-CN": "演示", en: "Demo" },
    };
    expect(packDisplayLabel(pack, "zh-CN")).toBe("演示");
    expect(packDisplayLabel(pack, "en")).toBe("Demo");
  });
});
