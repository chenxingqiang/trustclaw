// Panel D — Runtime Audit.

import type { RuntimeContextResponse } from "../api.js";
import { msg } from "../i18n/index.js";

export function renderAudit(root: HTMLElement): {
  render(context: RuntimeContextResponse): void;
  clear(): void;
} {
  const m = msg().panels.audit;
  root.innerHTML = `
    <section class="panel" data-panel="audit">
      <header><h2>${escapeHtml(m.title)}</h2><span data-testid="audit-trail-id"></span></header>
      <ol class="audit-timeline" data-testid="audit-timeline"></ol>
    </section>
  `;

  const trailIdEl = root.querySelector<HTMLElement>('[data-testid="audit-trail-id"]')!;
  const timelineEl = root.querySelector<HTMLElement>('[data-testid="audit-timeline"]')!;

  return {
    render(context) {
      trailIdEl.textContent = context.audit_trail_id;
      const stages = context.pipeline_stages;
      const items: Array<{ label: string; body: unknown }> = [
        { label: m.stepText2sql, body: stages.text2sql },
        { label: m.stepQuery, body: stages.db_query },
        { label: m.stepRules, body: stages.rule_evaluation },
        { label: m.stepDecision, body: stages.agent_decision },
        {
          label: m.stepLedger,
          body: context.evidence_ledger_receipt ?? { pending: m.ledgerPending },
        },
      ];
      timelineEl.innerHTML = items
        .map(
          (item) =>
            `<li><strong>${escapeHtml(item.label)}</strong><pre>${escapeHtml(
              JSON.stringify(item.body ?? null, null, 2),
            )}</pre></li>`,
        )
        .join("");
    },
    clear() {
      trailIdEl.textContent = "";
      timelineEl.innerHTML = "";
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
