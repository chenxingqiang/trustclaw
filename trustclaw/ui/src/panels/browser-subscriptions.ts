import type { PtdsBrowseSubscriptionsResponse } from "../api.js";
import { i18n, msg } from "../i18n/index.js";

export function renderBrowserSubscriptionsHint(root: HTMLElement, hint: string): void {
  const m = msg().panels.browser;
  root.innerHTML = `
    <section class="browser-subscriptions browser-subscriptions--hint" data-testid="browser-subscriptions">
      <h3 class="browser-subscriptions__title">${escapeHtml(m.subscriptionsTitle)}</h3>
      <p class="panel-note panel-note--compact">${escapeHtml(hint)}</p>
    </section>
  `;
}

export function renderBrowserSubscriptions(
  root: HTMLElement,
  snapshot: PtdsBrowseSubscriptionsResponse | undefined,
  onJump: (table: string) => void,
): void {
  const m = msg().panels.browser;
  if (!snapshot || snapshot.status !== "success") {
    root.innerHTML = "";
    return;
  }

  const pharmaBadge = snapshot.pharma.active
    ? `<span class="tag tag--ok">${escapeHtml(m.subscriptionsActive)}</span>`
    : `<span class="tag tag--warn">${escapeHtml(m.subscriptionsInactive)}</span>`;
  const pharmaDetail = snapshot.pharma.active
    ? `<code>${escapeHtml(snapshot.pharma.standard_id ?? "")}</code>${snapshot.pharma.publisher ? ` · ${escapeHtml(snapshot.pharma.publisher)}` : ""}`
    : escapeHtml(m.subscriptionsPharmaHint);

  const nrdlBadge = snapshot.nrdl.synced
    ? `<span class="tag tag--ok">${escapeHtml(m.subscriptionsSynced)}</span>`
    : `<span class="tag tag--warn">${escapeHtml(m.subscriptionsNotSynced)}</span>`;
  const nrdlDetail = snapshot.nrdl.synced
    ? `<code>${escapeHtml(snapshot.nrdl.version_id ?? "")}</code> · ${escapeHtml(m.subscriptionsDrugCount.replace("{count}", String(snapshot.nrdl.drug_count)))} · ${escapeHtml(m.subscriptionsRuleCount.replace("{count}", String(snapshot.nrdl.rule_count)))}`
    : escapeHtml(m.subscriptionsNrdlHint);

  const quickTables = (snapshot.quick_tables ?? [])
    .map((row) => {
      const label = i18n.getLocale() === "zh-CN" ? row.label_zh : row.label_en;
      return `<button type="button" class="browser-subscriptions__chip" data-table="${escapeHtml(row.table)}">${escapeHtml(label)}</button>`;
    })
    .join("");

  root.innerHTML = `
    <section class="browser-subscriptions" data-testid="browser-subscriptions">
      <h3 class="browser-subscriptions__title">${escapeHtml(m.subscriptionsTitle)}</h3>
      <div class="browser-subscriptions__grid">
        <article class="browser-subscriptions__card">
          <header>${escapeHtml(m.subscriptionsPharma)} ${pharmaBadge}</header>
          <p>${pharmaDetail}</p>
        </article>
        <article class="browser-subscriptions__card">
          <header>${escapeHtml(m.subscriptionsNrdl)} ${nrdlBadge}</header>
          <p>${nrdlDetail}</p>
        </article>
      </div>
      ${
        quickTables
          ? `<div class="browser-subscriptions__quick">
              <span class="browser-subscriptions__quick-label">${escapeHtml(m.subscriptionsQuickJump)}</span>
              <div class="browser-subscriptions__chips">${quickTables}</div>
            </div>`
          : ""
      }
    </section>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-table]").forEach((button) => {
    button.addEventListener("click", () => {
      const table = button.dataset.table;
      if (table) {
        onJump(table);
      }
    });
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
