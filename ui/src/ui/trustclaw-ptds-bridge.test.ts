import { describe, expect, it } from "vitest";
import {
  parseRuntimeContextFromToolResult,
  TRUSTCLAW_PTDS_QUERY_TOOL,
} from "./trustclaw-ptds-bridge.ts";

describe("trustclaw-ptds-bridge", () => {
  it("exports the PTDS tool name used by the plugin", () => {
    expect(TRUSTCLAW_PTDS_QUERY_TOOL).toBe("trustclaw_ptds_query");
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
});
