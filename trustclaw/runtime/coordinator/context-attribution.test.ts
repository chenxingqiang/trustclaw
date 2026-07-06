import { describe, expect, it } from "vitest";
import { getAgentPackRegistry } from "../agent-pack/index.js";
import { withCoordinatorAttribution } from "./context-attribution.js";
import { resolveCoordinatorAgentPack } from "./session-pack-coordinator.js";

describe("withCoordinatorAttribution", () => {
  it("copies coordinator fields onto RuntimeContext", () => {
    const pack = getAgentPackRegistry().get("glp1-eligibility")!;
    const coordinator = resolveCoordinatorAgentPack({
      sessionKey: "sess_attr",
      openclawAgentId: "compliance-auditor",
      bindLock: false,
    });
    const enriched = withCoordinatorAttribution(
      {
        session_id: "sess_attr",
        user_query: "q",
        agent_pack_id: pack.id,
        declared_pipeline_steps: pack.pipeline.stages,
        pipeline_stages: {} as never,
        audit_trail_id: "aud_test",
      },
      coordinator,
    );
    expect(enriched.agent_pack_source).toBe(coordinator.source);
    expect(enriched.agent_pack_locked).toBe(coordinator.locked);
    expect(enriched.agent_pack_mismatch).toBe(coordinator.agent_pack_mismatch);
    expect(enriched.openclaw_suggested_pack_id).toBe(coordinator.openclaw_suggested_pack_id);
  });
});
