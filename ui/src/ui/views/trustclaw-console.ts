// TrustClaw PTDS console embed — loads the bundled demo SPA from the plugin route.
import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";

export function renderTrustclawConsole(params: { basePath: string }) {
  const src = params.basePath
    ? `${params.basePath.replace(/\/$/, "")}/trustclaw/`
    : "/trustclaw/";
  return html`
    <section class="trustclaw-console" aria-label=${t("tabs.ptds")}>
      <iframe
        class="trustclaw-console__frame"
        src=${src}
        title=${t("tabs.ptds")}
        loading="lazy"
      ></iframe>
    </section>
  `;
}

export const trustclawConsoleView = renderTrustclawConsole;
