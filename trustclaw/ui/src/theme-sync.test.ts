/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  applyTrustclawTheme,
  initTrustclawThemeSync,
  readControlUiThemeFromStorage,
  resolveControlUiTheme,
} from "./theme-sync.js";

describe("trustclaw theme sync", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      store,
      get length() {
        return store.size;
      },
      key(index: number) {
        return [...store.keys()][index] ?? null;
      },
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
    });
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.classList.remove("theme-light", "theme-claw-light");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves claw light mode from Control UI settings shape", () => {
    expect(resolveControlUiTheme("claw", "light")).toEqual({
      resolved: "light",
      themeMode: "light",
    });
  });

  it("reads theme from scoped openclaw.control.settings storage key", () => {
    localStorage.setItem(
      "openclaw.control.settings.v1:http://127.0.0.1:19001",
      JSON.stringify({ theme: "claw", themeMode: "light" }),
    );
    expect(readControlUiThemeFromStorage()).toEqual({
      resolved: "light",
      themeMode: "light",
    });
  });

  it("applies data-theme-mode light to documentElement", () => {
    applyTrustclawTheme("light", "light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.themeMode).toBe("light");
    expect(document.documentElement.classList.contains("theme-light")).toBe(true);
  });

  it("accepts openclaw:theme postMessage from parent Control UI", () => {
    initTrustclawThemeSync();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: { type: "openclaw:theme", resolved: "light", themeMode: "light" },
      }),
    );
    expect(document.documentElement.dataset.themeMode).toBe("light");
  });
});
