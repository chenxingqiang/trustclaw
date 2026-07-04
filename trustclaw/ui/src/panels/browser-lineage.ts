import type { PtdsTableLineage, PtdsTableCatalogRow } from "../api.js";
import { msg } from "../i18n/index.js";
import type { BrowserCategory } from "./browser-table-filter.js";

export type { BrowserCategory };

export function kindLabel(kind: PtdsTableCatalogRow["kind"]): string {
  const m = msg().panels.browser;
  switch (kind) {
    case "subscribed":
      return m.lineageKindSubscribed;
    case "reference":
      return m.lineageKindReference;
    case "provenance":
      return m.lineageKindProvenance;
    case "view":
      return m.lineageKindView;
    default:
      return m.lineageKindPersonal;
  }
}

export function renderBrowserLineage(
  root: HTMLElement,
  lineage: PtdsTableLineage | undefined,
): void {
  const m = msg().panels.browser;
  if (!lineage) {
    root.innerHTML = `<p class="panel-note panel-note--compact">${escapeHtml(m.lineageEmpty)}</p>`;
    return;
  }

  const upstream = lineage.edges
    .filter(
      (edge) =>
        edge.label === "upstream" ||
        edge.label === "COMPLIANCE_IMPORT" ||
        edge.label === "REFERENCE_SYNC" ||
        edge.label === "provenance",
    )
    .map((edge) => lineage.nodes.find((n) => n.id === edge.from)?.label ?? edge.from);
  const downstream = lineage.edges
    .filter((edge) => edge.label === "downstream")
    .map((edge) => lineage.nodes.find((n) => n.id === edge.to)?.label ?? edge.to);

  const liveParts: string[] = [];
  if (lineage.live?.active_standard_id) {
    liveParts.push(
      `<div class="browser-lineage__live"><strong>${escapeHtml(m.lineageLiveStandard)}</strong><code>${escapeHtml(lineage.live.active_standard_id)}</code>${lineage.live.ruleset_hash ? ` · <code>${escapeHtml(lineage.live.ruleset_hash.slice(0, 12))}…</code>` : ""}</div>`,
    );
  }
  if (lineage.live?.reference_version_id) {
    liveParts.push(
      `<div class="browser-lineage__live"><strong>${escapeHtml(m.lineageLiveReference)}</strong><code>${escapeHtml(lineage.live.reference_version_id)}</code>${lineage.live.subscription_url ? `<div class="browser-lineage__url">${escapeHtml(lineage.live.subscription_url)}</div>` : ""}</div>`,
    );
  }
  if (lineage.live?.source_ids?.length) {
    const rows = lineage.live.source_ids
      .map(
        (source) =>
          `<li><code>${escapeHtml(source.source_id)}</code> ${escapeHtml(source.source_name)} · ${escapeHtml(source.source_category)} · ${escapeHtml(m.provenanceLevel.replace("{level}", String(source.reliability_level)))} · ${source.row_count}</li>`,
      )
      .join("");
    liveParts.push(
      `<div class="browser-lineage__live"><strong>${escapeHtml(m.lineageLiveSources)}</strong><ul class="browser-lineage__sources">${rows}</ul></div>`,
    );
  }

  const provenance =
    lineage.provenance_fields.length > 0
      ? `<p class="panel-note panel-note--compact">${escapeHtml(m.lineageProvenanceFields)}: <code>${lineage.provenance_fields.map(escapeHtml).join("</code>, <code>")}</code></p>`
      : "";

  root.innerHTML = `
    <div class="browser-lineage" data-testid="browser-lineage">
      <div class="browser-lineage__head">
        <span class="tag tag--muted">${escapeHtml(kindLabel(lineage.kind))}</span>
        ${lineage.subscription_type ? `<span class="tag tag--accent">${escapeHtml(lineage.subscription_type)}</span>` : ""}
        <code class="browser-lineage__table">${escapeHtml(lineage.table)}</code>
      </div>
      <div class="browser-lineage__grid">
        <div>
          <h4>${escapeHtml(m.lineageUpstream)}</h4>
          <ul>${upstream.length ? upstream.map((label) => `<li>${escapeHtml(label)}</li>`).join("") : `<li class="browser-lineage__none">—</li>`}</ul>
        </div>
        <div>
          <h4>${escapeHtml(m.lineageDownstream)}</h4>
          <ul>${downstream.length ? downstream.map((label) => `<li>${escapeHtml(label)}</li>`).join("") : `<li class="browser-lineage__none">—</li>`}</ul>
        </div>
      </div>
      ${provenance}
      ${liveParts.join("")}
    </div>
  `;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatProvenanceCell(column: string, value: unknown): string {
  if (column === "provenance_level" && value !== null && value !== undefined && value !== "") {
    const level = String(value);
    const m = msg().panels.browser;
    return `<span class="tag tag--provenance" title="${escapeHtml(m.provenanceLevel.replace("{level}", level))}">L${escapeHtml(level)}</span>`;
  }
  if (column === "source_id" && value) {
    return `<code class="browser-source-id">${escapeHtml(String(value))}</code>`;
  }
  return escapeHtml(String(value ?? ""));
}
