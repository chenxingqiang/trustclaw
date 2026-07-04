// PTDS workbench — OpenClaw native chat in center, TrustClaw config rails on sides.
import { html, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";

function buildTrustclawEmbedSrc(basePath: string, locale: string, embed: "left" | "right"): string {
  const prefix = basePath ? `${basePath.replace(/\/$/, "")}/trustclaw/` : "/trustclaw/";
  const url = new URL(prefix, window.location.origin);
  url.searchParams.set("locale", locale);
  url.searchParams.set("embed", embed);
  return `${url.pathname}${url.search}`;
}

function postLocaleToIframe(iframe: HTMLIFrameElement, locale: string): void {
  try {
    iframe.contentWindow?.postMessage(
      { type: "openclaw:i18n:locale", locale },
      window.location.origin,
    );
  } catch {
    // not loaded yet
  }
}

function postThemeToIframe(
  iframe: HTMLIFrameElement,
  resolved: string,
  themeMode: "light" | "dark",
): void {
  try {
    iframe.contentWindow?.postMessage(
      { type: "openclaw:theme", resolved, themeMode },
      window.location.origin,
    );
  } catch {
    // not loaded yet
  }
}

function syncIframeChrome(
  iframe: HTMLIFrameElement,
  locale: string,
  resolved: string,
  themeMode: "light" | "dark",
): void {
  postLocaleToIframe(iframe, locale);
  postThemeToIframe(iframe, resolved, themeMode);
}

export type TrustclawPtdsWorkbenchParams = {
  basePath: string;
  locale?: string;
  themeResolved?: string;
  themeMode?: "light" | "dark";
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  chatContent: TemplateResult;
};

export function renderTrustclawPtdsWorkbench(params: TrustclawPtdsWorkbenchParams) {
  const locale = params.locale ?? "en";
  const themeResolved = params.themeResolved ?? "dark";
  const themeMode = params.themeMode ?? (themeResolved.endsWith("light") ? "light" : "dark");
  const leftSrc = buildTrustclawEmbedSrc(params.basePath, locale, "left");
  const rightSrc = buildTrustclawEmbedSrc(params.basePath, locale, "right");

  return html`
    <section
      class="trustclaw-ptds-workbench ${params.leftOpen
        ? "trustclaw-ptds-workbench--left-open"
        : ""} ${params.rightOpen ? "trustclaw-ptds-workbench--right-open" : ""}"
      aria-label=${t("tabs.ptds")}
    >
      <aside
        class="trustclaw-ptds-rail trustclaw-ptds-rail--left ${params.leftOpen
          ? ""
          : "trustclaw-ptds-rail--collapsed"}"
      >
        ${params.leftOpen
          ? html`<div class="trustclaw-ptds-rail__header">
                <div class="trustclaw-ptds-rail__meta">
                  <span class="trustclaw-ptds-rail__eyebrow">PTDS</span>
                  <span class="trustclaw-ptds-rail__title">${t("ptdsPanel.leftRail")}</span>
                </div>
                <button
                  type="button"
                  class="btn btn--sm trustclaw-ptds-rail__toggle trustclaw-ptds-rail__toggle--collapse-left"
                  @click=${params.onToggleLeft}
                  aria-label=${t("ptdsPanel.collapseLeft")}
                  title=${t("ptdsPanel.collapseLeft")}
                >
                  ${icons.chevronRight}
                </button>
              </div>
              <iframe
                class="trustclaw-ptds-rail__frame"
                src=${leftSrc}
                title=${t("ptdsPanel.leftRail")}
                loading="lazy"
                @load=${(event: Event) => {
                  syncIframeChrome(
                    event.currentTarget as HTMLIFrameElement,
                    locale,
                    themeResolved,
                    themeMode,
                  );
                }}
              ></iframe>`
          : html`<div class="trustclaw-ptds-rail__header">
              <button
                type="button"
                class="btn btn--sm trustclaw-ptds-rail__toggle"
                @click=${params.onToggleLeft}
                aria-label=${t("ptdsPanel.expandLeft")}
                title=${t("ptdsPanel.expandLeft")}
              >
                ${icons.chevronRight}
              </button>
            </div>`}
      </aside>

      <div class="trustclaw-ptds-workbench__chat">${params.chatContent}</div>

      <aside
        class="trustclaw-ptds-rail trustclaw-ptds-rail--right ${params.rightOpen
          ? ""
          : "trustclaw-ptds-rail--collapsed"}"
      >
        ${params.rightOpen
          ? html`<div class="trustclaw-ptds-rail__header">
                <button
                  type="button"
                  class="btn btn--sm trustclaw-ptds-rail__toggle"
                  @click=${params.onToggleRight}
                  aria-label=${t("ptdsPanel.collapseRight")}
                  title=${t("ptdsPanel.collapseRight")}
                >
                  ${icons.chevronRight}
                </button>
                <div class="trustclaw-ptds-rail__meta trustclaw-ptds-rail__meta--right">
                  <span class="trustclaw-ptds-rail__eyebrow">PTDS</span>
                  <span class="trustclaw-ptds-rail__title">${t("ptdsPanel.rightRail")}</span>
                </div>
              </div>
              <iframe
                class="trustclaw-ptds-rail__frame"
                src=${rightSrc}
                title=${t("ptdsPanel.rightRail")}
                loading="lazy"
                @load=${(event: Event) => {
                  syncIframeChrome(
                    event.currentTarget as HTMLIFrameElement,
                    locale,
                    themeResolved,
                    themeMode,
                  );
                }}
              ></iframe>`
          : html`<div class="trustclaw-ptds-rail__header">
              <button
                type="button"
                class="btn btn--sm trustclaw-ptds-rail__toggle"
                @click=${params.onToggleRight}
                aria-label=${t("ptdsPanel.expandRight")}
                title=${t("ptdsPanel.expandRight")}
              >
                ${icons.chevronRight}
              </button>
            </div>`}
      </aside>
    </section>
  `;
}
