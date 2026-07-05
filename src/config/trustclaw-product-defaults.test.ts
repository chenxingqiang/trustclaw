import { describe, expect, it } from "vitest";
import {
  TRUSTCLAW_DEFAULT_GATEWAY_PORT,
  TRUSTCLAW_PLUGIN_ID,
  applyTrustclawProductDefaults,
} from "./trustclaw-product-defaults.js";

describe("applyTrustclawProductDefaults", () => {
  it("sets gateway port and enables trustclaw-tra when unset", () => {
    const next = applyTrustclawProductDefaults({});
    expect(next.gateway?.port).toBe(TRUSTCLAW_DEFAULT_GATEWAY_PORT);
    expect(next.plugins?.entries?.[TRUSTCLAW_PLUGIN_ID]?.enabled).toBe(true);
  });

  it("does not override an explicit gateway port", () => {
    const next = applyTrustclawProductDefaults({ gateway: { port: 18789 } });
    expect(next.gateway?.port).toBe(18789);
  });

  it("respects explicit plugin disable", () => {
    const next = applyTrustclawProductDefaults({
      plugins: {
        entries: {
          [TRUSTCLAW_PLUGIN_ID]: { enabled: false },
        },
      },
    });
    expect(next.plugins?.entries?.[TRUSTCLAW_PLUGIN_ID]?.enabled).toBe(false);
  });
});
