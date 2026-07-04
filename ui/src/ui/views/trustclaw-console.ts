// TrustClaw PTDS console embed — syncs OpenClaw Control UI locale into iframe SPA.
import { html } from "lit";
import { i18n, t } from "../../i18n/index.ts";

function buildTrustclawConsoleSrc(basePath: string, locale: string): string {
  const prefix = basePath ? `${basePath.replace(/\/$/, "")}/trustclaw/` : "/trustclaw/";
  const url = new URL(prefix, window.location.origin);
  url.searchParams.set("locale", locale);
  return `${url.pathname}${url.search}`;
}

function postLocaleToIframe(iframe: HTMLIFrameElement, locale: string): void {
  try {
    iframe.contentWindow?.postMessage(
      { type: "openclaw:i18n:locale", locale },
      window.location.origin,
    );
  } catch {
    // cross-origin or not yet loaded
  }
}

export function renderTrustclawConsole(params: { basePath: string; locale?: string }) {
  const locale = params.locale ?? i18n.getLocale();
  const src = buildTrustclawConsoleSrc(params.basePath, locale);
  return html`
    <section class="trustclaw-console" aria-label=${t("tabs.ptds")}>
      <iframe
        class="trustclaw-console__frame"
        src=${src}
        title=${t("tabs.ptds")}
        loading="lazy"
        @load=${(event: Event) => {
          postLocaleToIframe(event.currentTarget as HTMLIFrameElement, locale);
        }}
      ></iframe>
    </section>
  `;
}

export const trustclawConsoleView = renderTrustclawConsole;
