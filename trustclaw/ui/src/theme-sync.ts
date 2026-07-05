// TrustClaw TRA theme — mirrors OpenClaw Control UI settings + postMessage bridge.

export type TrustclawThemeMode = "light" | "dark";

export type TrustclawResolvedTheme =
  | "dark"
  | "light"
  | "openknot"
  | "openknot-light"
  | "dash"
  | "dash-light"
  | "custom"
  | "custom-light";

const SETTINGS_KEY_PREFIX = "openclaw.control.settings.v1";

const VALID_THEMES = new Set(["claw", "knot", "dash", "custom"]);
const VALID_MODES = new Set(["system", "light", "dark"]);

const LEGACY_MAP: Record<string, { theme: string; mode: string }> = {
  dark: { theme: "claw", mode: "dark" },
  light: { theme: "claw", mode: "light" },
  openknot: { theme: "knot", mode: "dark" },
  fieldmanual: { theme: "dash", mode: "dark" },
  clawdash: { theme: "dash", mode: "light" },
  system: { theme: "claw", mode: "system" },
};

function prefersLightScheme(): boolean {
  if (typeof globalThis.matchMedia !== "function") {
    return false;
  }
  return globalThis.matchMedia("(prefers-color-scheme: light)").matches;
}

function resolveMode(mode: string): TrustclawThemeMode {
  if (mode === "light") {
    return "light";
  }
  if (mode === "dark") {
    return "dark";
  }
  return prefersLightScheme() ? "light" : "dark";
}

export function parseControlUiTheme(
  themeRaw: unknown,
  modeRaw: unknown,
): { theme: string; mode: string } {
  const theme = typeof themeRaw === "string" ? themeRaw : "";
  const mode = typeof modeRaw === "string" ? modeRaw : "";
  const legacy = LEGACY_MAP[theme];
  return {
    theme: VALID_THEMES.has(theme) ? theme : (legacy?.theme ?? "claw"),
    mode: VALID_MODES.has(mode) ? mode : (legacy?.mode ?? "system"),
  };
}

export function resolveControlUiTheme(
  themeRaw: unknown,
  modeRaw: unknown,
): { resolved: TrustclawResolvedTheme; themeMode: TrustclawThemeMode } {
  const { theme, mode } = parseControlUiTheme(themeRaw, modeRaw);
  const themeMode = resolveMode(mode);
  if (theme === "knot") {
    return { resolved: themeMode === "light" ? "openknot-light" : "openknot", themeMode };
  }
  if (theme === "dash") {
    return { resolved: themeMode === "light" ? "dash-light" : "dash", themeMode };
  }
  if (theme === "custom") {
    return { resolved: themeMode === "light" ? "custom-light" : "custom", themeMode };
  }
  return { resolved: themeMode === "light" ? "light" : "dark", themeMode };
}

function listControlUiSettingsKeys(): string[] {
  try {
    const keys: string[] = [];
    const storage = localStorage;
    if (typeof storage.length === "number" && typeof storage.key === "function") {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(SETTINGS_KEY_PREFIX)) {
          keys.push(key);
        }
      }
    }
    if (keys.length === 0) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith(SETTINGS_KEY_PREFIX)) {
          keys.push(key);
        }
      }
    }
    return keys;
  } catch {
    return [];
  }
}

export function readControlUiSettingsRaw(): string | null {
  try {
    for (const key of listControlUiSettingsKeys()) {
      const raw = localStorage.getItem(key);
      if (raw) {
        return raw;
      }
    }
  } catch {
    // blocked storage
  }
  return null;
}

export function readControlUiThemeFromStorage(): {
  resolved: TrustclawResolvedTheme;
  themeMode: TrustclawThemeMode;
} | null {
  const raw = readControlUiSettingsRaw();
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { theme?: unknown; themeMode?: unknown };
    return resolveControlUiTheme(parsed.theme, parsed.themeMode);
  } catch {
    return null;
  }
}

export function applyTrustclawTheme(
  resolved: TrustclawResolvedTheme,
  themeMode: TrustclawThemeMode,
): void {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themeMode = themeMode;
  root.style.colorScheme = themeMode;
  root.classList.toggle("theme-light", themeMode === "light");
  root.classList.toggle("theme-claw-light", themeMode === "light");
}

export function syncTrustclawThemeFromStorage(): void {
  const next = readControlUiThemeFromStorage();
  if (!next) {
    applyTrustclawTheme("dark", "dark");
    return;
  }
  applyTrustclawTheme(next.resolved, next.themeMode);
}

type ThemeListener = (themeMode: TrustclawThemeMode) => void;

let systemThemeCleanup: (() => void) | null = null;
const listeners = new Set<ThemeListener>();

export function subscribeTrustclawTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyThemeListeners(themeMode: TrustclawThemeMode): void {
  for (const listener of listeners) {
    listener(themeMode);
  }
}

function syncSystemThemeListener(storedMode: string): void {
  systemThemeCleanup?.();
  systemThemeCleanup = null;
  if (storedMode !== "system") {
    return;
  }
  if (typeof globalThis.matchMedia !== "function") {
    return;
  }
  const mql = globalThis.matchMedia("(prefers-color-scheme: light)");
  const onChange = () => {
    syncTrustclawThemeFromStorage();
  };
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onChange);
    systemThemeCleanup = () => mql.removeEventListener("change", onChange);
    return;
  }
  if (typeof mql.addListener === "function") {
    mql.addListener(onChange);
    systemThemeCleanup = () => mql.removeListener(onChange);
  }
}

function applyFromStorageAndNotify(): void {
  const raw = readControlUiSettingsRaw();
  let storedMode = "system";
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { themeMode?: unknown };
      if (typeof parsed.themeMode === "string") {
        storedMode = parsed.themeMode;
      }
    } catch {
      // ignore
    }
  }
  const before = document.documentElement.dataset.themeMode;
  syncTrustclawThemeFromStorage();
  syncSystemThemeListener(storedMode);
  const after = document.documentElement.dataset.themeMode;
  if (after === "light" || after === "dark") {
    if (before !== after) {
      notifyThemeListeners(after);
    }
  }
}

export function initTrustclawThemeSync(): void {
  applyFromStorageAndNotify();
  window.addEventListener("storage", (event) => {
    if (!event.key?.startsWith(SETTINGS_KEY_PREFIX)) {
      return;
    }
    applyFromStorageAndNotify();
  });
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }
    const data = event.data as {
      type?: string;
      resolved?: string;
      themeMode?: string;
      theme?: string;
    } | null;
    if (data?.type !== "openclaw:theme") {
      return;
    }
    if (
      typeof data.resolved === "string" &&
      (data.themeMode === "light" || data.themeMode === "dark")
    ) {
      applyTrustclawTheme(data.resolved as TrustclawResolvedTheme, data.themeMode);
      notifyThemeListeners(data.themeMode);
      return;
    }
    if (data.theme !== undefined || data.themeMode !== undefined) {
      const next = resolveControlUiTheme(data.theme, data.themeMode);
      applyTrustclawTheme(next.resolved, next.themeMode);
      notifyThemeListeners(next.themeMode);
    }
  });
}

/** Inline bootstrap for index.html — keep in sync with resolveControlUiTheme. */
export function bootstrapTrustclawThemeFromStorage(): void {
  syncTrustclawThemeFromStorage();
}
