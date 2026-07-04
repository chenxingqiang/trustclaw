import type { PtdsTableLineage } from "../api.js";

/** Ordered upstream → focal table → downstream labels for the lineage flow strip. */
export function buildLineageFlowSteps(lineage: PtdsTableLineage): string[] {
  const focalId = `table:${lineage.table}`;
  const labelOf = (id: string) => lineage.nodes.find((node) => node.id === id)?.label ?? id;

  const upstream = lineage.edges
    .filter((edge) => edge.to === focalId)
    .map((edge) => labelOf(edge.from));
  const downstream = lineage.edges
    .filter((edge) => edge.from === focalId && edge.label === "downstream")
    .map((edge) => labelOf(edge.to));

  const dedupe = (items: string[]) => [...new Set(items)];
  return [...dedupe(upstream), labelOf(focalId), ...dedupe(downstream)].filter(Boolean);
}

export function renderLineageFlowHtml(steps: string[], title: string): string {
  if (steps.length === 0) {
    return "";
  }
  const nodes = steps
    .map((step, index) => {
      const arrow =
        index > 0 ? `<span class="browser-lineage-flow__arrow" aria-hidden="true">→</span>` : "";
      return `${arrow}<span class="browser-lineage-flow__node">${escapeHtml(step)}</span>`;
    })
    .join("");
  return `
    <div class="browser-lineage-flow" data-testid="browser-lineage-flow">
      <h4 class="browser-lineage-flow__title">${escapeHtml(title)}</h4>
      <div class="browser-lineage-flow__track">${nodes}</div>
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
