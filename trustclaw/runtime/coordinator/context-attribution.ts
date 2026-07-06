import type { RuntimeContext } from "../pipeline/types.js";
import type { CoordinatorPackResolution } from "./session-pack-coordinator.js";

/** Attach D15 coordinator facts to chat Runtime Context for MCA ops traceability. */
export function withCoordinatorAttribution(
  context: RuntimeContext,
  coordinator: CoordinatorPackResolution,
): RuntimeContext {
  return {
    ...context,
    agent_pack_source: coordinator.source,
    agent_pack_locked: coordinator.locked,
    agent_pack_mismatch: coordinator.agent_pack_mismatch,
    openclaw_suggested_pack_id: coordinator.openclaw_suggested_pack_id,
  };
}
