/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { normalizeTrustclawLocale } from "./index.js";

describe("trustclaw i18n locale normalization", () => {
  it("maps OpenClaw zh locales to zh-CN bundle", () => {
    expect(normalizeTrustclawLocale("zh-CN")).toBe("zh-CN");
    expect(normalizeTrustclawLocale("zh-TW")).toBe("zh-CN");
    expect(normalizeTrustclawLocale("zh-HK")).toBe("zh-CN");
  });

  it("defaults unknown locales to en", () => {
    expect(normalizeTrustclawLocale("ja-JP")).toBe("en");
    expect(normalizeTrustclawLocale(null)).toBe("en");
  });
});

describe("trustclaw i18n storage sync", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: new Map<string, string>(),
      getItem(key: string) {
        return this.store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.store.set(key, value);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the same key as OpenClaw Control UI", async () => {
    localStorage.setItem("openclaw.i18n.locale", "zh-CN");
    vi.resetModules();
    const { i18n } = await import("./index.js");
    expect(i18n.getLocale()).toBe("zh-CN");
  });
});
