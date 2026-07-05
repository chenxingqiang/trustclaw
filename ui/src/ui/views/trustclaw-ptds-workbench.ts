// PTDS workbench — OpenClaw native chat in center, TrustClaw config rails on sides.
import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import { renderTrustclawAgentPackSelector } from "./trustclaw-agent-pack-selector.ts";
import type { TrustclawAgentPackSelectorParams } from "./trustclaw-agent-pack-selector.ts";
import { renderTrustclawAgentStarterQuestions } from "./trustclaw-agent-starter-questions.ts";
import type { TrustclawAgentStarterQuestionsParams } from "./trustclaw-agent-starter-questions.ts";

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
  agentPackSelector?: TrustclawAgentPackSelectorParams;
  starterQuestions?: TrustclawAgentStarterQuestionsParams;
};

function renderRailHeader(params: {
  side: "left" | "right";
  open: boolean;
  onToggle: () => void;
  title: string;
}): TemplateResult {
  const collapseLabel =
    params.side === "left" ? t("ptdsPanel.collapseLeft") : t("ptdsPanel.collapseRight");
  const expandLabel =
    params.side === "left" ? t("ptdsPanel.expandLeft") : t("ptdsPanel.expandRight");
  if (params.open) {
    if (params.side === "left") {
      return html`<div class="trustclaw-ptds-rail__header">
        <div class="trustclaw-ptds-rail__meta">
          <span class="trustclaw-ptds-rail__eyebrow">PTDS</span>
          <span class="trustclaw-ptds-rail__title">${params.title}</span>
        </div>
        <button
          type="button"
          class="btn btn--sm trustclaw-ptds-rail__toggle trustclaw-ptds-rail__toggle--collapse-left"
          @click=${params.onToggle}
          aria-label=${collapseLabel}
          title=${collapseLabel}
        >
          ${icons.chevronRight}
        </button>
      </div>`;
    }
    return html`<div class="trustclaw-ptds-rail__header">
      <button
        type="button"
        class="btn btn--sm trustclaw-ptds-rail__toggle"
        @click=${params.onToggle}
        aria-label=${collapseLabel}
        title=${collapseLabel}
      >
        ${icons.chevronRight}
      </button>
      <div class="trustclaw-ptds-rail__meta trustclaw-ptds-rail__meta--right">
        <span class="trustclaw-ptds-rail__eyebrow">PTDS</span>
        <span class="trustclaw-ptds-rail__title">${params.title}</span>
      </div>
    </div>`;
  }
  return html`<div class="trustclaw-ptds-rail__header">
    <button
      type="button"
      class="btn btn--sm trustclaw-ptds-rail__toggle"
      @click=${params.onToggle}
      aria-label=${expandLabel}
      title=${expandLabel}
    >
      ${icons.chevronRight}
    </button>
  </div>`;
}

function renderRailFrame(params: {
  src: string;
  title: string;
  locale: string;
  themeResolved: string;
  themeMode: "light" | "dark";
}): TemplateResult {
  return html`<iframe
    class="trustclaw-ptds-rail__frame"
    src=${params.src}
    title=${params.title}
    loading="lazy"
    @load=${(event: Event) => {
      syncIframeChrome(
        event.currentTarget as HTMLIFrameElement,
        params.locale,
        params.themeResolved,
        params.themeMode,
      );
    }}
  ></iframe>`;
}

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
        ${renderRailHeader({
          side: "left",
          open: params.leftOpen,
          onToggle: params.onToggleLeft,
          title: t("ptdsPanel.leftRail"),
        })}
        ${renderRailFrame({
          src: leftSrc,
          title: t("ptdsPanel.leftRail"),
          locale,
          themeResolved,
          themeMode,
        })}
      </aside>

      <div class="trustclaw-ptds-workbench__chat">
        ${params.agentPackSelector
          ? renderTrustclawAgentPackSelector(params.agentPackSelector)
          : nothing}
        ${params.starterQuestions
          ? renderTrustclawAgentStarterQuestions(params.starterQuestions)
          : nothing}
        <div class="trustclaw-ptds-workbench__chat-main">${params.chatContent}</div>
      </div>

      <aside
        class="trustclaw-ptds-rail trustclaw-ptds-rail--right ${params.rightOpen
          ? ""
          : "trustclaw-ptds-rail--collapsed"}"
      >
        ${renderRailHeader({
          side: "right",
          open: params.rightOpen,
          onToggle: params.onToggleRight,
          title: t("ptdsPanel.rightRail"),
        })}
        ${renderRailFrame({
          src: rightSrc,
          title: t("ptdsPanel.rightRail"),
          locale,
          themeResolved,
          themeMode,
        })}
      </aside>
    </section>
  `;
}
