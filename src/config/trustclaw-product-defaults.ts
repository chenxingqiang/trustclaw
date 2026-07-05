// TrustClaw fork product defaults (TRA plugin + gateway port).
import type { OpenClawConfig } from "./types.openclaw.js";

export const TRUSTCLAW_PLUGIN_ID = "trustclaw-tra";
export const TRUSTCLAW_DEFAULT_GATEWAY_PORT = 19001;

/** Applies TrustClaw product defaults without overriding explicit operator choices. */
export function applyTrustclawProductDefaults(cfg: OpenClawConfig): OpenClawConfig {
  let next: OpenClawConfig = { ...cfg };

  if (next.gateway?.port === undefined) {
    next = {
      ...next,
      gateway: {
        ...next.gateway,
        port: TRUSTCLAW_DEFAULT_GATEWAY_PORT,
      },
    };
  }

  const plugins = next.plugins ?? {};
  const existing = plugins.entries?.[TRUSTCLAW_PLUGIN_ID];
  if (existing?.enabled === false) {
    return next;
  }

  return {
    ...next,
    plugins: {
      ...plugins,
      entries: {
        ...plugins.entries,
        [TRUSTCLAW_PLUGIN_ID]: {
          ...existing,
          enabled: true,
        },
      },
    },
  };
}
