// Reusable domain-agent selector for Panel B/D/E/F.

import type { TrustclawApiClient, AgentGrantPackRow } from "../api.js";
import { msg } from "../i18n/index.js";
import { readPanelAgentPackId, writePanelAgentPackId } from "./agent-panel-context.js";

export type PanelAgentBar = {
  refresh(): Promise<void>;
  getSelectedPackId(): string;
  hasScope(scope: string): boolean;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mountPanelAgentBar(
  root: HTMLElement,
  client: TrustclawApiClient,
  requiredScope: string,
): PanelAgentBar {
  const m = msg().panels.agentBar;
  const host = document.createElement("div");
  host.className = "panel-agent-bar";
  host.innerHTML = `
    <label class="panel-agent-bar__label">${escapeHtml(m.label)}
      <select data-testid="panel-agent-select"></select>
    </label>
    <span class="tag tag--muted" data-testid="panel-agent-grant-status">${escapeHtml(m.checking)}</span>
  `;
  root.prepend(host);

  const select = host.querySelector<HTMLSelectElement>('[data-testid="panel-agent-select"]')!;
  const statusEl = host.querySelector<HTMLElement>('[data-testid="panel-agent-grant-status"]')!;
  let packs: AgentGrantPackRow[] = [];

  function packLabel(pack: AgentGrantPackRow): string {
    return document.documentElement.lang === "zh-CN"
      ? pack.displayName["zh-CN"]
      : pack.displayName.en;
  }

  function selectedPack(): AgentGrantPackRow | undefined {
    return packs.find((pack) => pack.id === select.value);
  }

  function repaintStatus(): void {
    const pack = selectedPack();
    if (!pack) {
      statusEl.textContent = m.noPack;
      statusEl.className = "tag tag--warn";
      return;
    }
    const granted = pack.granted_scopes.includes(requiredScope);
    statusEl.textContent = granted ? m.granted : m.notGranted;
    statusEl.className = granted ? "tag tag--ok" : "tag tag--warn";
  }

  select.addEventListener("change", () => {
    writePanelAgentPackId(select.value);
    repaintStatus();
  });

  return {
    async refresh() {
      const data = await client.agentGrants();
      packs = data.packs;
      const current = readPanelAgentPackId();
      select.innerHTML = packs
        .map(
          (pack) =>
            `<option value="${escapeHtml(pack.id)}"${pack.id === current ? " selected" : ""}>${escapeHtml(packLabel(pack))}</option>`,
        )
        .join("");
      if (!select.value && packs[0]) {
        select.value = packs[0].id;
        writePanelAgentPackId(packs[0].id);
      }
      repaintStatus();
    },
    getSelectedPackId() {
      return select.value || readPanelAgentPackId();
    },
    hasScope(scope: string) {
      const pack = selectedPack();
      return pack?.granted_scopes.includes(scope) === true;
    },
  };
}
