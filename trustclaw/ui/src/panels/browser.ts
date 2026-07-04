// Panel B — PTDS Data Browser.

import type { TrustclawApiClient } from "../api.js";
import { msg } from "../i18n/index.js";

export function renderBrowser(
  root: HTMLElement,
  client: TrustclawApiClient,
): {
  refresh(): Promise<void>;
} {
  const m = msg().panels.browser;
  root.innerHTML = `
    <section class="panel" data-panel="browser">
      <header><h2>${escapeHtml(m.title)}</h2></header>
      <p class="panel-note">${escapeHtml(m.mountNote)}<strong data-testid="browser-mounted">${escapeHtml(m.unknown)}</strong></p>
      <div class="controls">
        <select data-testid="browser-table"></select>
        <button data-action="reload">${escapeHtml(m.reload)}</button>
      </div>
      <div class="table-container" data-testid="browser-table-container"></div>
    </section>
  `;

  const select = root.querySelector<HTMLSelectElement>('[data-testid="browser-table"]')!;
  const container = root.querySelector<HTMLElement>('[data-testid="browser-table-container"]')!;
  const reloadBtn = root.querySelector<HTMLButtonElement>('[data-action="reload"]')!;
  const mountedEl = root.querySelector<HTMLElement>('[data-testid="browser-mounted"]')!;

  async function refreshMounted(): Promise<void> {
    try {
      const status = await client.status();
      mountedEl.textContent = status.mounted ? m.mounted : m.notMounted;
    } catch {
      mountedEl.textContent = m.unknown;
    }
  }

  async function loadTables(): Promise<void> {
    try {
      const list = await client.tables();
      select.innerHTML = "";
      const options = list.default_tables.length > 0 ? list.default_tables : list.tables;
      for (const table of options) {
        const option = document.createElement("option");
        option.value = table;
        option.textContent = table;
        select.append(option);
      }
    } catch (error) {
      container.textContent = `${m.listError}: ${(error as Error).message}`;
    }
  }

  async function loadRows(): Promise<void> {
    const table = select.value;
    if (!table) {
      container.textContent = m.selectTable;
      return;
    }
    container.textContent = m.loading;
    try {
      const result = await client.browse(table, 100);
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
              .map((c) => `<td>${escapeHtml(String(row[c] ?? ""))}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`;
      container.innerHTML = `<table>${thead}${tbody}</table>`;
    } catch (error) {
      container.textContent = `${m.loadError}: ${(error as Error).message}`;
    }
  }

  select.addEventListener("change", () => {
    void loadRows();
  });
  reloadBtn.addEventListener("click", () => {
    void loadRows();
  });

  void loadTables().then(() => loadRows());
  void refreshMounted();

  return {
    async refresh() {
      await refreshMounted();
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
