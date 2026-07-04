// Panel D — [Evidence #N] citation cards from agent_decision pipeline stage.

export type EvidenceCitation = {
  index: number;
  label: string;
  value: string | number | null;
  rule_id: string;
  source: string;
};

export function parseEvidenceCitations(agentDecision: unknown): EvidenceCitation[] {
  if (!agentDecision || typeof agentDecision !== "object" || Array.isArray(agentDecision)) {
    return [];
  }
  const record = agentDecision as Record<string, unknown>;
  const raw = record.citations;
  if (!Array.isArray(raw)) {
    return [];
  }
  const citations: EvidenceCitation[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const index = typeof row.index === "number" ? row.index : NaN;
    const label = typeof row.label === "string" ? row.label : "";
    const ruleId = typeof row.rule_id === "string" ? row.rule_id : "";
    const source = typeof row.source === "string" ? row.source : "";
    if (!Number.isFinite(index) || !label || !ruleId) {
      continue;
    }
    const value =
      typeof row.value === "string" || typeof row.value === "number"
        ? row.value
        : row.value === null
          ? null
          : null;
    citations.push({ index, label, value, rule_id: ruleId, source });
  }
  return citations.sort((a, b) => a.index - b.index);
}

/** Citations persisted on AGENT_DECISION audit rows (Panel D JSONL refresh). */
export function parseEvidenceCitationsFromAuditOutput(
  output: Record<string, unknown>,
): EvidenceCitation[] {
  return parseEvidenceCitations({ citations: output.citations });
}

export function formatEvidenceValue(value: string | number | null, missingLabel: string): string {
  if (value === null || value === undefined) {
    return missingLabel;
  }
  return String(value);
}

export function buildEvidenceTooltip(citation: EvidenceCitation, missingLabel: string): string {
  const value = formatEvidenceValue(citation.value, missingLabel);
  return `${citation.label} · ${citation.rule_id} · ${value} (${citation.source})`;
}

export function renderEvidenceCitationList(
  citations: EvidenceCitation[],
  labels: {
    title: string;
    tag: (index: number) => string;
    missingValue: string;
  },
): string {
  if (citations.length === 0) {
    return "";
  }
  const items = citations
    .map((citation) => {
      const tooltip = buildEvidenceTooltip(citation, labels.missingValue);
      const value = formatEvidenceValue(citation.value, labels.missingValue);
      return `<li class="evidence-citation">
        <span class="evidence-tag" title="${escapeAttr(tooltip)}">${escapeHtml(labels.tag(citation.index))}</span>
        <span class="evidence-citation__label">${escapeHtml(citation.label)}</span>
        <code class="evidence-citation__rule">${escapeHtml(citation.rule_id)}</code>
        <span class="evidence-citation__value">${escapeHtml(value)}</span>
      </li>`;
    })
    .join("");
  return `<div class="evidence-citations">
    <h4 class="evidence-citations__title">${escapeHtml(labels.title)}</h4>
    <ul class="evidence-citations__list">${items}</ul>
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
  return escapeHtml(input).replace(/'/g, "&#39;");
}
