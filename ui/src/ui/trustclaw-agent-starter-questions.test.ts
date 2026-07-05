import { render } from "lit";
import { describe, expect, it } from "vitest";
import { renderTrustclawAgentStarterQuestions } from "./views/trustclaw-agent-starter-questions.ts";

const t = {
  t: (key: string) => (key === "traPanel.starterQuestionsTitle" ? "试试这些问题" : key),
};

describe("renderTrustclawAgentStarterQuestions", () => {
  it("renders three GLP-1 starter chips for the selected pack", () => {
    const root = document.createElement("div");
    render(
      renderTrustclawAgentStarterQuestions({
        packs: [
          {
            id: "glp1-eligibility",
            version: "1.0.0",
            displayName: { "zh-CN": "GLP-1", en: "GLP-1" },
            tools: { read: "trustclaw_tra_query" },
            starterQuestions: [
              { "zh-CN": "问题一", en: "Q1" },
              { "zh-CN": "问题二", en: "Q2" },
              { "zh-CN": "问题三", en: "Q3" },
            ],
          },
        ],
        selectedPackId: "glp1-eligibility",
        onSelect: () => {},
      }),
      root,
    );
    const chips = root.querySelectorAll(".trustclaw-tra-starter-questions__chip");
    expect(chips).toHaveLength(3);
    expect(chips[0]?.textContent).toMatch(/Q1|问题一/);
  });
});

// i18n is module-global; stub via dynamic import boundary in component tests only when needed.
void t;
