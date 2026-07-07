import path from "node:path";

/** TrustClaw product defaults (OpenClaw fork). */
export const TRUSTCLAW_DEFAULT_GATEWAY_PORT = "19001";
export const TRUSTCLAW_DEFAULT_UI_PORT = "5174";
/** Packaged DMG/zip default; loopback-only demo token — override via TRUSTCLAW_PACKAGED_GATEWAY_TOKEN. */
export const TRUSTCLAW_DEFAULT_GATEWAY_TOKEN = "trustclaw-local-default";

export function resolveTrustclawGatewayPort(env = process.env) {
  return env.OPENCLAW_GATEWAY_PORT ?? env.TRUSTCLAW_GATEWAY_PORT ?? TRUSTCLAW_DEFAULT_GATEWAY_PORT;
}

export function resolveTrustclawPackagedGatewayToken(env = process.env) {
  const override = env.TRUSTCLAW_PACKAGED_GATEWAY_TOKEN?.trim();
  return override || TRUSTCLAW_DEFAULT_GATEWAY_TOKEN;
}

export function buildTrustclawDashboardUrl(port, token, env = process.env) {
  const resolvedPort = port ?? Number(resolveTrustclawGatewayPort(env));
  const resolvedToken = token ?? resolveTrustclawPackagedGatewayToken(env);
  return `http://127.0.0.1:${resolvedPort}/#token=${encodeURIComponent(resolvedToken)}`;
}

/** OpenClaw state dir for default or `--dev` profile (matches CLI `--dev`). */
export function resolveTrustclawProfileStateDir(homeDir, profileArgs = []) {
  const isDev = profileArgs.includes("--dev");
  return path.join(homeDir, isDev ? ".openclaw-dev" : ".openclaw");
}

/** Migrate legacy plugins.entries.trustclaw-ptds → trustclaw-tra and drop stale id. */
export function migrateTrustclawPluginEntry(entries) {
  const legacy = entries["trustclaw-ptds"];
  if (!legacy) {
    return entries;
  }
  const tra = entries["trustclaw-tra"] ?? {};
  const next = { ...entries };
  delete next["trustclaw-ptds"];
  next["trustclaw-tra"] = {
    ...legacy,
    ...tra,
    enabled: tra.enabled ?? legacy.enabled ?? true,
    config: {
      ...(legacy.config ?? {}),
      ...(tra.config ?? {}),
    },
  };
  return next;
}
