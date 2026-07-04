// Format AGENT_DOMAIN_GRANT history rows for Panel C.

import type { AgentGrantHistoryEntry } from "../api.js";

export function formatGrantTimestamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString();
}

export function renderGrantScopeChips(
  scopes: readonly string[],
  scopeLabels: Record<string, string>,
): string {
  if (scopes.length === 0) {
    return `<span class="agent-grant-history__none">—</span>`;
  }
  return scopes
    .map(
      (scope) =>
        `<span class="agent-grant-scope-chip">${escapeHtml(scopeLabels[scope] ?? scope)}</span>`,
    )
    .join("");
}

export function renderAgentGrantHistoryTable(
  history: readonly AgentGrantHistoryEntry[],
  labels: {
    empty: string;
    time: string;
    agent: string;
    scopes: string;
    action: string;
    granted: string;
    revoked: string;
    scopeLabels: Record<string, string>;
    packDisplayName: (packId: string) => string;
  },
): string {
  if (history.length === 0) {
    return `<p class="panel-note panel-note--compact" data-testid="agent-grant-history-empty">${escapeHtml(labels.empty)}</p>`;
  }
  const rows = history
    .map((entry) => {
      const actionLabel = entry.granted ? labels.granted : labels.revoked;
      const actionClass = entry.granted ? "tag--ok" : "tag--warn";
      return `<tr data-testid="agent-grant-history-row" data-pack-id="${escapeAttr(entry.agent_pack_id)}">
        <td><time datetime="${entry.timestamp}">${escapeHtml(formatGrantTimestamp(entry.timestamp))}</time></td>
        <td>
          <strong>${escapeHtml(labels.packDisplayName(entry.agent_pack_id))}</strong>
          <code class="agent-grant-history__pack-id">${escapeHtml(entry.agent_pack_id)}</code>
        </td>
        <td class="agent-grant-history__scopes">${renderGrantScopeChips(entry.scopes, labels.scopeLabels)}</td>
        <td><span class="tag ${actionClass}">${escapeHtml(actionLabel)}</span></td>
      </tr>`;
    })
    .join("");
  return `<div class="agent-grant-history-wrap">
    <table class="agent-grant-history" data-testid="agent-grant-history-table">
      <thead>
        <tr>
          <th>${escapeHtml(labels.time)}</th>
          <th>${escapeHtml(labels.agent)}</th>
          <th>${escapeHtml(labels.scopes)}</th>
          <th>${escapeHtml(labels.action)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(input: string): string {
  return escapeHtml(input);
}
