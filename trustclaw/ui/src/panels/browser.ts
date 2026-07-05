// Panel B — TRA Data Browser (personal + subscribed data with lineage).

import type { TraTableCatalogRow, TrustclawApiClient } from "../api.js";
import { msg } from "../i18n/index.js";
import { formatProvenanceCell, renderBrowserLineage } from "./browser-lineage.js";
import {
  renderBrowserSubscriptions,
  renderBrowserSubscriptionsHint,
} from "./browser-subscriptions.js";
import { filterTablesByCategory } from "./browser-table-filter.js";
import type { BrowserCategory } from "./browser-table-filter.js";
import { mountPanelAgentBar } from "./panel-agent-bar.js";

export function renderBrowser(
  root: HTMLElement,
  client: TrustclawApiClient,
): {
  refresh(): Promise<void>;
} {
  const m = msg().panels.browser;
  root.innerHTML = `
    <section class="panel panel--b" data-panel="browser">
      <header class="panel__header">
        <div class="panel__heading">
          <h2>${escapeHtml(m.title)}</h2>
          <p class="panel__subtitle">${escapeHtml(m.subtitle)}</p>
        </div>
      </header>
      <div class="panel__body">
        <p class="panel-note">
          ${escapeHtml(m.mountNote)}
          <span class="tag tag--muted" data-testid="browser-mounted">${escapeHtml(m.unknown)}</span>
        </p>
        <div data-testid="browser-subscriptions-wrap"></div>
        <div class="controls browser-controls">
          <label class="browser-controls__field">
            ${escapeHtml(m.categoryLabel)}
            <select data-testid="browser-category">
              <option value="all">${escapeHtml(m.categoryAll)}</option>
              <option value="personal">${escapeHtml(m.categoryPersonal)}</option>
              <option value="subscribed">${escapeHtml(m.categorySubscribed)}</option>
            </select>
          </label>
          <label class="browser-controls__field browser-controls__field--grow">
            ${escapeHtml(m.viewerLabel)}
            <select data-testid="browser-table"></select>
          </label>
          <button type="button" data-action="reload">${escapeHtml(m.reload)}</button>
        </div>
        <div class="browser-lineage-wrap" data-testid="browser-lineage-wrap"></div>
        <div class="table-container" data-testid="browser-table-container"></div>
      </div>
    </section>
  `;

  const categorySelect = root.querySelector<HTMLSelectElement>('[data-testid="browser-category"]')!;
  const select = root.querySelector<HTMLSelectElement>('[data-testid="browser-table"]')!;
  const container = root.querySelector<HTMLElement>('[data-testid="browser-table-container"]')!;
  const lineageWrap = root.querySelector<HTMLElement>('[data-testid="browser-lineage-wrap"]')!;
  const subscriptionsWrap = root.querySelector<HTMLElement>(
    '[data-testid="browser-subscriptions-wrap"]',
  )!;
  const reloadBtn = root.querySelector<HTMLButtonElement>('[data-action="reload"]')!;
  const mountedEl = root.querySelector<HTMLElement>('[data-testid="browser-mounted"]')!;
  const panelBody = root.querySelector<HTMLElement>(".panel__body")!;
  const agentBar = mountPanelAgentBar(panelBody, client, "panel.browse");

  let catalog: TraTableCatalogRow[] = [];
  let allTables: string[] = [];

  function setMountedTag(mounted: boolean | null): void {
    if (mounted === null) {
      mountedEl.textContent = m.unknown;
      mountedEl.className = "tag tag--muted";
      return;
    }
    mountedEl.textContent = mounted ? m.mounted : m.notMounted;
    mountedEl.className = mounted ? "tag tag--ok" : "tag tag--warn";
  }

  async function refreshMounted(): Promise<void> {
    try {
      const status = await client.status();
      setMountedTag(status.mounted);
    } catch {
      setMountedTag(null);
    }
  }

  function currentCategory(): BrowserCategory {
    return categorySelect.value as BrowserCategory;
  }

  function populateTableSelect(tables: string[]): void {
    const previous = select.value;
    select.innerHTML = "";
    if (tables.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = m.selectTable;
      select.append(option);
      return;
    }
    const byTable = new Map(catalog.map((row) => [row.table, row]));
    for (const table of tables) {
      const option = document.createElement("option");
      option.value = table;
      const row = byTable.get(table);
      const prefix = row?.kind === "subscribed" ? "⬇ " : row?.kind === "view" ? "◎ " : "";
      option.textContent = `${prefix}${table}`;
      select.append(option);
    }
    if (previous && tables.includes(previous)) {
      select.value = previous;
    }
  }

  async function loadSubscriptions(): Promise<void> {
    if (!agentBar.hasScope("panel.browse")) {
      renderBrowserSubscriptionsHint(subscriptionsWrap, msg().panels.agentBar.notGrantedHint);
      return;
    }
    try {
      const snapshot = await client.browseSubscriptions(agentBar.getSelectedPackId());
      if (snapshot.status !== "success") {
        renderBrowserSubscriptionsHint(
          subscriptionsWrap,
          snapshot.message ?? m.subscriptionsLoadError,
        );
        return;
      }
      renderBrowserSubscriptions(subscriptionsWrap, snapshot, jumpToTable);
    } catch (error) {
      renderBrowserSubscriptionsHint(
        subscriptionsWrap,
        `${m.subscriptionsLoadError}: ${(error as Error).message}`,
      );
    }
  }

  function jumpToTable(table: string): void {
    const row = catalog.find((entry) => entry.table === table);
    const category: BrowserCategory =
      row?.kind === "subscribed"
        ? "subscribed"
        : row?.kind === "personal" || row?.kind === "view"
          ? "personal"
          : "all";
    categorySelect.value = category;
    const filtered = filterTablesByCategory(allTables, catalog, category);
    populateTableSelect(filtered.length > 0 ? filtered : allTables);
    if (allTables.includes(table)) {
      select.value = table;
    }
    void loadRows();
  }

  async function loadTables(): Promise<void> {
    if (!agentBar.hasScope("panel.browse")) {
      container.textContent = msg().panels.agentBar.notGrantedHint;
      lineageWrap.innerHTML = "";
      renderBrowserSubscriptionsHint(subscriptionsWrap, msg().panels.agentBar.notGrantedHint);
      return;
    }
    try {
      const list = await client.tables(agentBar.getSelectedPackId());
      catalog = list.catalog ?? [];
      allTables =
        list.tables.length > 0
          ? list.tables
          : list.default_tables.length > 0
            ? list.default_tables
            : [];
      const filtered = filterTablesByCategory(allTables, catalog, currentCategory());
      populateTableSelect(filtered.length > 0 ? filtered : allTables);
    } catch (error) {
      container.textContent = `${m.listError}: ${(error as Error).message}`;
      lineageWrap.innerHTML = "";
    }
  }

  async function loadRows(): Promise<void> {
    const table = select.value;
    if (!table) {
      container.textContent = m.selectTable;
      renderBrowserLineage(lineageWrap, undefined);
      return;
    }
    container.textContent = m.loading;
    try {
      const result = await client.browse(table, 100, agentBar.getSelectedPackId());
      renderBrowserLineage(lineageWrap, result.lineage);
      if (result.status !== "success" || !result.rows) {
        container.textContent = result.message ?? m.noData;
        return;
      }
      const columns = result.columns ?? Object.keys((result.rows[0] as object | undefined) ?? {});
      const rows = result.rows as Record<string, unknown>[];
      const thead = `<thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(
          (row) =>
            `<tr>${columns
              .map((c) => {
                const formatted =
                  c === "source_id" || c === "provenance_level"
                    ? formatProvenanceCell(c, row[c])
                    : escapeHtml(String(row[c] ?? ""));
                return `<td>${formatted}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("")}</tbody>`;
      container.innerHTML = `<table>${thead}${tbody}</table>`;
    } catch (error) {
      container.textContent = `${m.loadError}: ${(error as Error).message}`;
      renderBrowserLineage(lineageWrap, undefined);
    }
  }

  categorySelect.addEventListener("change", () => {
    const filtered = filterTablesByCategory(allTables, catalog, currentCategory());
    populateTableSelect(filtered);
    void loadRows();
  });
  select.addEventListener("change", () => {
    void loadRows();
  });
  reloadBtn.addEventListener("click", () => {
    void loadRows();
  });
  root
    .querySelector<HTMLSelectElement>('[data-testid="panel-agent-select"]')
    ?.addEventListener("change", () => {
      void loadSubscriptions().then(() => loadTables().then(() => loadRows()));
    });

  void agentBar
    .refresh()
    .then(() => loadSubscriptions().then(() => loadTables().then(() => loadRows())));
  void refreshMounted();

  return {
    async refresh() {
      await refreshMounted();
      await agentBar.refresh();
      await loadSubscriptions();
      await loadTables();
      await loadRows();
    },
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
