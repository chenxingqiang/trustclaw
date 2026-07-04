// Panel E — Evidence Ledger.

import type { RuntimeContextResponse } from "../api.js";
import { msg } from "../i18n/index.js";

interface ReceiptRow {
  block_height?: number;
  proof_hash?: string;
  audit_trail_id: string;
}

export function renderLedger(root: HTMLElement): {
  append(context: RuntimeContextResponse): void;
  clear(): void;
} {
  const m = msg().panels.ledger;
  root.innerHTML = `
    <section class="panel" data-panel="ledger">
      <header><h2>${escapeHtml(m.title)}</h2><span class="badge" data-testid="ledger-verified">${escapeHtml(m.placeholder)}</span></header>
      <ul class="ledger-list" data-testid="ledger-list"></ul>
    </section>
  `;

  const listEl = root.querySelector<HTMLElement>('[data-testid="ledger-list"]')!;
  const rows: ReceiptRow[] = [];

  function repaint(): void {
    listEl.innerHTML = rows
      .map(
        (row) =>
          `<li><code>#${row.block_height ?? "?"}</code> · <code>${escapeHtml(
            (row.proof_hash ?? "").slice(0, 16),
          )}…</code> · <span>${escapeHtml(row.audit_trail_id)}</span></li>`,
      )
      .join("");
  }

  return {
    append(context) {
      rows.push({
        block_height: context.evidence_ledger_receipt?.block_height,
        proof_hash: context.evidence_ledger_receipt?.proof_hash,
        audit_trail_id: context.audit_trail_id,
      });
      repaint();
    },
    clear() {
      rows.length = 0;
      repaint();
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
