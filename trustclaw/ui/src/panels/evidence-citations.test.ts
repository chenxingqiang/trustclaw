import { describe, expect, it } from "vitest";
import {
  buildEvidenceTooltip,
  parseEvidenceCitations,
  parseEvidenceCitationsFromAuditOutput,
  renderEvidenceCitationList,
} from "./evidence-citations.js";

describe("evidence-citations", () => {
  it("parses citations from agent_decision stage", () => {
    const citations = parseEvidenceCitations({
      response: "…[Evidence #1]…",
      citations: [
        {
          index: 1,
          label: "临床级HbA1c需≥6.5%",
          value: null,
          rule_id: "GLP1_R02",
          source: "nrdl_payment_rules",
        },
      ],
    });
    expect(citations).toHaveLength(1);
    expect(citations[0]?.index).toBe(1);
  });

  it("parses citations from AGENT_DECISION audit output", () => {
    const citations = parseEvidenceCitationsFromAuditOutput({
      response_preview: "…",
      citation_count: 1,
      citations: [
        {
          index: 1,
          label: "HbA1c",
          value: 6.8,
          rule_id: "GLP1_R02",
          source: "nrdl_payment_rules",
        },
      ],
    });
    expect(citations).toHaveLength(1);
    expect(citations[0]?.rule_id).toBe("GLP1_R02");
  });

  it("renders hoverable evidence tags for Panel D", () => {
    const html = renderEvidenceCitationList(
      [
        {
          index: 1,
          label: "BMI threshold",
          value: 28.4,
          rule_id: "GLP1_R01",
          source: "nrdl_payment_rules",
        },
      ],
      {
        title: "Evidence",
        tag: (index) => `[Evidence #${index}]`,
        missingValue: "missing",
      },
    );
    expect(html).toContain("evidence-tag");
    expect(html).toContain("[Evidence #1]");
    expect(html).toContain("GLP1_R01");
  });

  it("builds tooltip with rule id and source", () => {
    const tip = buildEvidenceTooltip(
      {
        index: 2,
        label: "T2DM",
        value: 1,
        rule_id: "GLP1_R03",
        source: "v_glp1_nrdl_check_snapshot",
      },
      "missing",
    );
    expect(tip).toContain("GLP1_R03");
    expect(tip).toContain("v_glp1_nrdl_check_snapshot");
  });
});
