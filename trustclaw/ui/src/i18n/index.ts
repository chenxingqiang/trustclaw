// TrustClaw TRA Runtime Console i18n — shares OpenClaw Control UI locale storage (`openclaw.i18n.locale`).
import { en } from "./locales/en.js";
import { zh_CN } from "./locales/zh-CN.js";
import type { TrustclawLocale, TrustclawMessages } from "./types.js";

export type { TrustclawLocale, TrustclawMessages };

const LOCALE_STORAGE_KEY = "openclaw.i18n.locale";
const DEFAULT_LOCALE: TrustclawLocale = "en";

const MESSAGES: Record<TrustclawLocale, TrustclawMessages> = {
  en,
  "zh-CN": zh_CN,
};

type LocaleListener = (locale: TrustclawLocale) => void;

function readStorageLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorageLocale(locale: TrustclawLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // private mode / blocked storage
  }
}

/** Map OpenClaw locale ids to TrustClaw bundles (zh-TW → zh-CN). */
export function normalizeTrustclawLocale(raw: string | null | undefined): TrustclawLocale {
  if (!raw) {
    return DEFAULT_LOCALE;
  }
  if (raw === "en") {
    return "en";
  }
  if (raw === "zh-CN" || raw === "zh-TW" || raw.startsWith("zh")) {
    return "zh-CN";
  }
  return DEFAULT_LOCALE;
}

function resolveInitialLocale(): TrustclawLocale {
  const fromUrl = new URLSearchParams(window.location.search).get("locale");
  if (fromUrl) {
    return normalizeTrustclawLocale(fromUrl);
  }
  return normalizeTrustclawLocale(readStorageLocale());
}

class TrustclawI18n {
  private locale: TrustclawLocale = resolveInitialLocale();
  private listeners = new Set<LocaleListener>();

  constructor() {
    document.documentElement.lang = this.locale === "zh-CN" ? "zh-CN" : "en";
    window.addEventListener("storage", (event) => {
      if (event.key !== LOCALE_STORAGE_KEY) {
        return;
      }
      this.applyLocale(normalizeTrustclawLocale(event.newValue), { persist: false });
    });
    window.addEventListener("message", (event) => {
      const data = event.data as { type?: string; locale?: string } | null;
      if (data?.type !== "openclaw:i18n:locale" || typeof data.locale !== "string") {
        return;
      }
      this.applyLocale(normalizeTrustclawLocale(data.locale), { persist: false });
    });
  }

  getLocale(): TrustclawLocale {
    return this.locale;
  }

  messages(): TrustclawMessages {
    return MESSAGES[this.locale];
  }

  setLocale(next: TrustclawLocale): void {
    this.applyLocale(next, { persist: true });
  }

  subscribe(listener: LocaleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private applyLocale(next: TrustclawLocale, options: { persist: boolean }): void {
    if (this.locale === next) {
      return;
    }
    this.locale = next;
    document.documentElement.lang = next === "zh-CN" ? "zh-CN" : "en";
    if (options.persist) {
      writeStorageLocale(next);
    }
    for (const listener of this.listeners) {
      listener(next);
    }
  }
}

export const i18n = new TrustclawI18n();

/** Shorthand for current locale message bundle. */
export function msg(): TrustclawMessages {
  return i18n.messages();
}
