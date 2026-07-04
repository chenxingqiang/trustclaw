import { describe, expect, it } from "vitest";
import { chatPipelineStepStates, CHAT_PIPELINE_STEP_ORDER } from "./audit-pipeline.js";

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
