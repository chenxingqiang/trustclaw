import { describe, expect, it } from "vitest";
import {
  chatPipelineStepStates,
  CHAT_PIPELINE_STEP_ORDER,
  isChatPipelineComplete,
  resolveChatPipelineStepOrder,
} from "./audit-pipeline.js";

describe("chatPipelineStepStates", () => {
  it("marks missing steps as pending", () => {
    const states = chatPipelineStepStates([
      { step: "TEXT2SQL_GEN", status: "SUCCESS" },
      { step: "DB_QUERY", status: "SUCCESS" },
    ]);
    expect(states).toHaveLength(CHAT_PIPELINE_STEP_ORDER.length);
    expect(states[0]).toBe("ok");
    expect(states[1]).toBe("ok");
    expect(states[2]).toBe("pending");
  });

  it("marks BLOCKED and FAIL distinctly from pending", () => {
    const blocked = chatPipelineStepStates([{ step: "TEXT2SQL_GEN", status: "BLOCKED" }]);
    expect(blocked[0]).toBe("blocked");

    const fail = chatPipelineStepStates([{ step: "DB_QUERY", status: "FAIL" }]);
    expect(fail[1]).toBe("fail");
  });
});

describe("resolveChatPipelineStepOrder (G10)", () => {
  it("returns pack-declared subset in canonical order", () => {
    expect(
      resolveChatPipelineStepOrder(["AGENT_DECISION", "TEXT2SQL_GEN", "DB_QUERY", "LEDGER_COMMIT"]),
    ).toEqual(["TEXT2SQL_GEN", "DB_QUERY", "AGENT_DECISION", "LEDGER_COMMIT"]);
  });

  it("omits undeclared RULE_EVAL for compliance-auditor packs", () => {
    const order = resolveChatPipelineStepOrder([
      "TEXT2SQL_GEN",
      "DB_QUERY",
      "AGENT_DECISION",
      "LEDGER_COMMIT",
    ]);
    expect(order).not.toContain("RULE_EVAL");
    expect(order).toHaveLength(4);
  });

  it("treats pack trail as complete when only declared stages succeed", () => {
    const order = resolveChatPipelineStepOrder([
      "TEXT2SQL_GEN",
      "DB_QUERY",
      "AGENT_DECISION",
      "LEDGER_COMMIT",
    ]);
    const events = [
      { step: "TEXT2SQL_GEN", status: "SUCCESS" },
      { step: "DB_QUERY", status: "SUCCESS" },
      { step: "AGENT_DECISION", status: "SUCCESS" },
      { step: "LEDGER_COMMIT", status: "SUCCESS" },
    ];
    expect(isChatPipelineComplete(events, order)).toBe(true);
    expect(isChatPipelineComplete(events, CHAT_PIPELINE_STEP_ORDER)).toBe(false);
  });
});
