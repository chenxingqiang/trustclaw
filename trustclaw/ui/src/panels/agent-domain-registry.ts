import type { DomainAgentRow, DomainAgentsResponse } from "../api.js";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function enabledTagClass(enabled: string): string {
  if (enabled === "partial") {
    return "tag tag--warn";
  }
  if (enabled === "true") {
    return "tag tag--ok";
  }
  return "tag tag--muted";
}

function agentOptionLabel(agent: DomainAgentRow): string {
  const pack = agent.pack_id?.trim() || "—";
  return `${agent.agent_id} · ${agent.agent_name} (${pack})`;
}

function renderAgentDetail(agent: DomainAgentRow, labels: RegistryLabels): string {
  const fields: Array<[string, string]> = [
    [labels.detailId, agent.agent_id],
    [labels.detailName, agent.agent_name],
    [labels.detailDomain, agent.domain],
    [labels.detailSubdomain, agent.subdomain ?? "—"],
    [labels.detailRegion, agent.region ?? "—"],
    [labels.detailInsurance, agent.insurance_type ?? "—"],
    [labels.detailPack, agent.pack_id ?? "—"],
    [labels.detailPackVersion, agent.pack_version ?? "—"],
    [labels.detailScopes, agent.tra_scopes ?? "—"],
    [labels.detailWrite, agent.tra_write == null ? "—" : String(agent.tra_write)],
    [labels.detailRegistered, agent.registered_at ?? "—"],
  ];
  return `<article class="domain-agent-detail" data-testid="domain-agent-detail">
    <header class="domain-agent-detail__head">
      <strong>${escapeHtml(agent.agent_name)}</strong>
      <span class="${enabledTagClass(agent.enabled)}">${escapeHtml(agent.enabled)}</span>
    </header>
    <dl class="domain-agent-detail__grid">
      ${fields
        .map(
          ([label, value]) =>
            `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
        )
        .join("")}
    </dl>
  </article>`;
}

type RegistryLabels = {
  unavailable: string;
  empty: string;
  summary: string;
  selectLabel: string;
  selectPlaceholder: string;
  filterPack: string;
  filterEnabled: string;
  filterAll: string;
  filterPartial: string;
  filterFalse: string;
  colId: string;
  colName: string;
  colDomain: string;
  colPack: string;
  colEnabled: string;
  detailId: string;
  detailName: string;
  detailDomain: string;
  detailSubdomain: string;
  detailRegion: string;
  detailInsurance: string;
  detailPack: string;
  detailPackVersion: string;
  detailScopes: string;
  detailWrite: string;
  detailRegistered: string;
};

export function renderDomainAgentRegistry(
  data: DomainAgentsResponse,
  labels: RegistryLabels,
  packIds: readonly string[],
  selectedPackId: string,
  selectedEnabled: string,
  selectedAgentId: string,
): string {
  if (!data.available) {
    return `<p class="panel-note panel-note--compact" data-testid="domain-agents-unavailable">${escapeHtml(labels.unavailable)}</p>`;
  }

  const partialCount = data.summary.by_enabled.partial ?? 0;
  const falseCount = data.summary.by_enabled.false ?? 0;
  const summaryText = labels.summary
    .replace("{total}", String(data.summary.total))
    .replace("{partial}", String(partialCount))
    .replace("{false}", String(falseCount));

  const packOptions = [
    `<option value="">${escapeHtml(labels.filterAll)}</option>`,
    ...packIds.map(
      (packId) =>
        `<option value="${escapeHtml(packId)}"${packId === selectedPackId ? " selected" : ""}>${escapeHtml(packId)}</option>`,
    ),
  ].join("");

  const enabledOptions = [
    { value: "", label: labels.filterAll },
    { value: "partial", label: labels.filterPartial },
    { value: "false", label: labels.filterFalse },
  ]
    .map(
      (opt) =>
        `<option value="${escapeHtml(opt.value)}"${opt.value === selectedEnabled ? " selected" : ""}>${escapeHtml(opt.label)}</option>`,
    )
    .join("");

  const selectOptions = [
    `<option value="">${escapeHtml(labels.selectPlaceholder)}</option>`,
    ...data.agents.map((agent) => {
      const selected = agent.agent_id === selectedAgentId ? " selected" : "";
      return `<option value="${escapeHtml(agent.agent_id)}"${selected}>${escapeHtml(agentOptionLabel(agent))}</option>`;
    }),
  ].join("");

  const selectedAgent = data.agents.find((agent) => agent.agent_id === selectedAgentId);
  const detailHtml = selectedAgent ? renderAgentDetail(selectedAgent, labels) : "";

  const filtersHtml = `<div class="domain-agent-registry__filters">
      <label class="domain-agent-registry__select">${escapeHtml(labels.selectLabel)}
        <select data-testid="domain-agents-select">${selectOptions}</select>
      </label>
      <label>${escapeHtml(labels.filterPack)} <select data-testid="domain-agents-filter-pack">${packOptions}</select></label>
      <label>${escapeHtml(labels.filterEnabled)} <select data-testid="domain-agents-filter-enabled">${enabledOptions}</select></label>
    </div>`;

  if (data.agents.length === 0) {
    return `<p class="panel-note panel-note--compact">${escapeHtml(summaryText)}</p>
      ${filtersHtml}
      <p class="panel-note panel-note--compact" data-testid="domain-agents-empty">${escapeHtml(labels.empty)}</p>`;
  }

  const rows = data.agents
    .map((agent: DomainAgentRow) => {
      const selectedClass =
        agent.agent_id === selectedAgentId ? " domain-agent-registry__row--selected" : "";
      return `<tr class="domain-agent-registry__row${selectedClass}" data-testid="domain-agent-row" data-agent-id="${escapeHtml(agent.agent_id)}" tabindex="0" role="button">
        <td><code>${escapeHtml(agent.agent_id)}</code></td>
        <td>${escapeHtml(agent.agent_name)}</td>
        <td>${escapeHtml(agent.domain)}</td>
        <td><code>${escapeHtml(agent.pack_id ?? "—")}</code></td>
        <td><span class="${enabledTagClass(agent.enabled)}">${escapeHtml(agent.enabled)}</span></td>
      </tr>`;
    })
    .join("");

  return `<p class="panel-note panel-note--compact" data-testid="domain-agents-summary">${escapeHtml(summaryText)}</p>
    ${filtersHtml}
    ${detailHtml}
    <div class="agent-grant-history-wrap">
      <table class="agent-grant-history domain-agent-registry" data-testid="domain-agents-table">
        <thead>
          <tr>
            <th>${escapeHtml(labels.colId)}</th>
            <th>${escapeHtml(labels.colName)}</th>
            <th>${escapeHtml(labels.colDomain)}</th>
            <th>${escapeHtml(labels.colPack)}</th>
            <th>${escapeHtml(labels.colEnabled)}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
