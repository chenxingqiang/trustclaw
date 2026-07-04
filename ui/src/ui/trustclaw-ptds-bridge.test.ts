import { describe, expect, it } from "vitest";
import {
  decorateTrustclawEvidenceTags,
  extractTrustclawEvidenceCitations,
  parsePersonalWriteFromToolResult,
  parseRuntimeContextFromToolResult,
  TRUSTCLAW_PTDS_QUERY_TOOL,
  TRUSTCLAW_PTDS_WRITE_TOOL,
} from "./trustclaw-ptds-bridge.ts";

describe("trustclaw-ptds-bridge", () => {
  it("exports the PTDS tool names used by the plugin", () => {
    expect(TRUSTCLAW_PTDS_QUERY_TOOL).toBe("trustclaw_ptds_query");
    expect(TRUSTCLAW_PTDS_WRITE_TOOL).toBe("trustclaw_ptds_write");
  });

  it("parses Runtime Context from tool result details", () => {
    const context = {
      session_id: "sess_1",
      user_query: "hello",
      pipeline_stages: { agent_decision: { response: "ok", citations: [] } },
      audit_trail_id: "aud_1",
      evidence_ledger_receipt: { block_height: 0, proof_hash: "abc" },
    };
    const parsed = parseRuntimeContextFromToolResult({
      content: [{ type: "text", text: "ok" }],
      details: { trustclaw: { runtime_context: context } },
    });
    expect(parsed).toEqual(context);
  });

  it("extracts evidence citations from runtime context", () => {
    const citations = extractTrustclawEvidenceCitations({
      session_id: "s",
      user_query: "q",
      audit_trail_id: "a",
      pipeline_stages: {
        agent_decision: {
          citations: [
            {
              index: 1,
              label: "HbA1c",
              value: 6.8,
              rule_id: "GLP1_R02",
              source: "nrdl_payment_rules",
            },
          ],
        },
      },
    });
    expect(citations).toHaveLength(1);
    expect(citations[0]?.rule_id).toBe("GLP1_R02");
  });

  it("decorates [Evidence #N] tags for chat markdown", () => {
    const html = decorateTrustclawEvidenceTags("结论 [Evidence #1] 参考", [
      {
        index: 1,
        label: "HbA1c",
        value: 6.8,
        rule_id: "GLP1_R02",
        source: "nrdl_payment_rules",
      },
    ]);
    expect(html).toContain('class="trustclaw-evidence-tag"');
    expect(html).toContain("GLP1_R02");
  });

  it("parses successful personal write from tool result details", () => {
    const parsed = parsePersonalWriteFromToolResult({
      details: {
        trustclaw: {
          personal_write: {
            status: "success",
            tables: ["body_anthropometrics"],
            rows_affected: 1,
          },
        },
      },
    });
    expect(parsed).toEqual({
      status: "success",
      tables: ["body_anthropometrics"],
      rows_affected: 1,
    });
  });
});
