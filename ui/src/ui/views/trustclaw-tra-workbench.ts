// TRA workbench — OpenClaw native chat in center, TrustClaw config rails on sides.
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

export type TrustclawTraWorkbenchParams = {
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
    params.side === "left" ? t("traPanel.collapseLeft") : t("traPanel.collapseRight");
  const expandLabel = params.side === "left" ? t("traPanel.expandLeft") : t("traPanel.expandRight");
  if (params.open) {
    if (params.side === "left") {
      return html`<div class="trustclaw-tra-rail__header">
        <div class="trustclaw-tra-rail__meta">
          <span class="trustclaw-tra-rail__eyebrow">TRA</span>
          <span class="trustclaw-tra-rail__title">${params.title}</span>
        </div>
        <button
          type="button"
          class="btn btn--sm trustclaw-tra-rail__toggle trustclaw-tra-rail__toggle--collapse-left"
          @click=${params.onToggle}
          aria-label=${collapseLabel}
          title=${collapseLabel}
        >
          ${icons.chevronRight}
        </button>
      </div>`;
    }
    return html`<div class="trustclaw-tra-rail__header">
      <button
        type="button"
        class="btn btn--sm trustclaw-tra-rail__toggle"
        @click=${params.onToggle}
        aria-label=${collapseLabel}
        title=${collapseLabel}
      >
        ${icons.chevronRight}
      </button>
      <div class="trustclaw-tra-rail__meta trustclaw-tra-rail__meta--right">
        <span class="trustclaw-tra-rail__eyebrow">TRA</span>
        <span class="trustclaw-tra-rail__title">${params.title}</span>
      </div>
    </div>`;
  }
  return html`<div class="trustclaw-tra-rail__header">
    <button
      type="button"
      class="btn btn--sm trustclaw-tra-rail__toggle"
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
    class="trustclaw-tra-rail__frame"
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

export function renderTrustclawTraWorkbench(params: TrustclawTraWorkbenchParams) {
  const locale = params.locale ?? "en";
  const themeResolved = params.themeResolved ?? "dark";
  const themeMode = params.themeMode ?? (themeResolved.endsWith("light") ? "light" : "dark");
  const leftSrc = buildTrustclawEmbedSrc(params.basePath, locale, "left");
  const rightSrc = buildTrustclawEmbedSrc(params.basePath, locale, "right");

  return html`
    <section
      class="trustclaw-tra-workbench ${params.leftOpen
        ? "trustclaw-tra-workbench--left-open"
        : ""} ${params.rightOpen ? "trustclaw-tra-workbench--right-open" : ""}"
      aria-label=${t("tabs.tra")}
    >
      <aside
        class="trustclaw-tra-rail trustclaw-tra-rail--left ${params.leftOpen
          ? ""
          : "trustclaw-tra-rail--collapsed"}"
      >
        ${renderRailHeader({
          side: "left",
          open: params.leftOpen,
          onToggle: params.onToggleLeft,
          title: t("traPanel.leftRail"),
        })}
        ${renderRailFrame({
          src: leftSrc,
          title: t("traPanel.leftRail"),
          locale,
          themeResolved,
          themeMode,
        })}
      </aside>

      <div class="trustclaw-tra-workbench__chat">
        ${params.agentPackSelector
          ? renderTrustclawAgentPackSelector(params.agentPackSelector)
          : nothing}
        ${params.starterQuestions
          ? renderTrustclawAgentStarterQuestions(params.starterQuestions)
          : nothing}
        <div class="trustclaw-tra-workbench__chat-main">${params.chatContent}</div>
      </div>

      <aside
        class="trustclaw-tra-rail trustclaw-tra-rail--right ${params.rightOpen
          ? ""
          : "trustclaw-tra-rail--collapsed"}"
      >
        ${renderRailHeader({
          side: "right",
          open: params.rightOpen,
          onToggle: params.onToggleRight,
          title: t("traPanel.rightRail"),
        })}
        ${renderRailFrame({
          src: rightSrc,
          title: t("traPanel.rightRail"),
          locale,
          themeResolved,
          themeMode,
        })}
      </aside>
    </section>
  `;
}
