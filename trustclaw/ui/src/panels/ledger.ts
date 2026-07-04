// Panel E — Evidence Ledger.

import type { RuntimeContextResponse, TrustclawApiClient } from "../api.js";
import { msg } from "../i18n/index.js";
import { collectLedgerReceipts, type LedgerReceiptRow } from "./audit-events.js";

export type { LedgerReceiptRow };

import { mountPanelAgentBar, type PanelAgentBar } from "./panel-agent-bar.js";

export function renderLedger(
  root: HTMLElement,
  client?: TrustclawApiClient,
): {
  append(context: RuntimeContextResponse): void;
  setReceipts(receipts: LedgerReceiptRow[]): void;
  upsertReceipt(receipt: LedgerReceiptRow): void;
  refresh(): Promise<void>;
  clear(): void;
} {
  const m = msg().panels.ledger;
  root.innerHTML = `
    <section class="panel panel--e" data-panel="ledger">
      <header class="panel__header">
        <div class="panel__heading">
          <h2>${escapeHtml(m.title)}</h2>
          <p class="panel__subtitle">${escapeHtml(m.subtitle)}</p>
        </div>
        <span class="badge" data-testid="ledger-verified">${escapeHtml(m.placeholder)}</span>
      </header>
      <div class="panel__body">
        <p class="panel-note panel-note--compact" data-testid="ledger-empty-note">${escapeHtml(m.emptyNote)}</p>
        <div class="ledger-stats">
          <div class="ledger-stat">
            <span>${escapeHtml(m.blockHeight)}</span>
            <strong data-testid="ledger-height">#0</strong>
          </div>
          <div class="ledger-stat">
            <span>${escapeHtml(m.rootHash)}</span>
            <code data-testid="ledger-root">—</code>
          </div>
          <div class="ledger-stat">
            <span>${escapeHtml(m.proofLabel)}</span>
            <code data-testid="ledger-proof-short">—</code>
          </div>
        </div>
        <div class="ledger-proof-wrap">
          <button type="button" data-action="copy-proof">${escapeHtml(m.copyProof)}</button>
          <pre class="ledger-proof" data-testid="ledger-proof">{}</pre>
        </div>
        <ul class="ledger-list" data-testid="ledger-list"></ul>
      </div>
    </section>
  `;

  const emptyNoteEl = root.querySelector<HTMLElement>('[data-testid="ledger-empty-note"]')!;
  const listEl = root.querySelector<HTMLElement>('[data-testid="ledger-list"]')!;
  const heightEl = root.querySelector<HTMLElement>('[data-testid="ledger-height"]')!;
  const rootEl = root.querySelector<HTMLElement>('[data-testid="ledger-root"]')!;
  const proofShortEl = root.querySelector<HTMLElement>('[data-testid="ledger-proof-short"]')!;
  const proofEl = root.querySelector<HTMLElement>('[data-testid="ledger-proof"]')!;
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-action="copy-proof"]')!;
  const verifiedBadge = root.querySelector<HTMLElement>('[data-testid="ledger-verified"]')!;
  const panelBody = root.querySelector<HTMLElement>(".panel__body")!;
  let agentBar: PanelAgentBar | null = null;
  if (client) {
    agentBar = mountPanelAgentBar(panelBody, client, "panel.ledger");
  }
  const rows: LedgerReceiptRow[] = [];
  let chainVerified: boolean | null = null;

  function latestProof(): Record<string, unknown> {
    const last = rows.at(-1);
    if (!last?.proof_hash) {
      return { status: "pending" };
    }
    return {
      block_height: last.block_height ?? rows.length - 1,
      proof_hash: last.proof_hash,
      previous_evidence_hash: last.previous_evidence_hash ?? null,
      audit_trail_id: last.audit_trail_id,
      chain_verified: chainVerified,
    };
  }

  function repaint(): void {
    const last = rows.at(-1);
    const hash = last?.proof_hash ?? "";
    const chainHeight = rows.length > 0 ? (rows.at(-1)?.block_height ?? rows.length - 1) + 1 : 0;
    heightEl.textContent = `#${chainHeight}`;
    rootEl.textContent = hash ? `${hash.slice(0, 12)}…` : "—";
    proofShortEl.textContent = hash ? `${hash.slice(0, 8)}…` : "—";
    proofEl.textContent = JSON.stringify(latestProof(), null, 2);
    if (!hash) {
      verifiedBadge.textContent = m.placeholder;
    } else if (chainVerified === true) {
      verifiedBadge.textContent = m.receiptReady;
    } else if (chainVerified === false) {
      verifiedBadge.textContent = m.chainBroken;
    } else {
      verifiedBadge.textContent = m.chainPending;
    }
    emptyNoteEl.hidden = rows.length > 0;
    listEl.innerHTML = rows
      .map(
        (row, index) =>
          `<li><code>#${row.block_height ?? index}</code> · <code>${escapeHtml(
            (row.proof_hash ?? "").slice(0, 16),
          )}…</code> · <span>${escapeHtml(row.audit_trail_id)}</span></li>`,
      )
      .join("");
  }

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(proofEl.textContent ?? "{}");
      copyBtn.textContent = m.copiedProof;
      setTimeout(() => {
        copyBtn.textContent = m.copyProof;
      }, 1200);
    } catch {
      // clipboard unavailable in some iframe contexts
    }
  });

  function upsertReceipt(receipt: LedgerReceiptRow): void {
    if (!receipt.proof_hash) {
      return;
    }
    const index = rows.findIndex((row) => row.audit_trail_id === receipt.audit_trail_id);
    if (index >= 0) {
      rows[index] = receipt;
    } else {
      rows.push(receipt);
    }
    rows.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    repaint();
  }

  function setReceipts(receipts: LedgerReceiptRow[]): void {
    rows.length = 0;
    for (const receipt of receipts) {
      if (receipt.proof_hash) {
        rows.push(receipt);
      }
    }
    rows.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    repaint();
  }

  return {
    append(context) {
      const receipt = context.evidence_ledger_receipt;
      if (!receipt?.proof_hash) {
        return;
      }
      const contextPackId = context.agent_pack_id?.trim();
      const selectedPackId = agentBar?.getSelectedPackId();
      if (contextPackId && selectedPackId && contextPackId !== selectedPackId) {
        return;
      }
      upsertReceipt({
        block_height: receipt.block_height,
        proof_hash: receipt.proof_hash,
        previous_evidence_hash: receipt.previous_evidence_hash ?? null,
        audit_trail_id: context.audit_trail_id,
        timestamp: Date.now() / 1000,
      });
    },
    setReceipts,
    upsertReceipt,
    async refresh() {
      if (!client) {
        return;
      }
      if (agentBar) {
        await agentBar.refresh();
      }
      const packId = agentBar?.getSelectedPackId();
      try {
        const ledger = await client.ledgerStatus(packId);
        const verifiedFromApi =
          ledger.verify?.ok === true ? true : ledger.verify?.ok === false ? false : null;
        chainVerified = verifiedFromApi;
        const receipts = (ledger.receipts ?? []).map((row) => ({
          block_height: row.block_height,
          proof_hash: row.proof_hash,
          previous_evidence_hash: row.previous_evidence_hash,
          audit_trail_id: row.audit_trail_id,
          timestamp: row.committed_at,
        }));
        if (receipts.length > 0) {
          setReceipts(receipts);
          return;
        }
        if (verifiedFromApi !== null) {
          setReceipts([]);
          return;
        }
        const response = await client.auditEvents("chat", 120, packId);
        setReceipts(collectLedgerReceipts(response.events ?? []));
      } catch (error) {
        try {
          const response = await client.auditEvents("chat", 120, packId);
          chainVerified = null;
          setReceipts(collectLedgerReceipts(response.events ?? []));
          emptyNoteEl.hidden = rows.length > 0;
        } catch {
          emptyNoteEl.textContent = `${m.loadError}: ${(error as Error).message}`;
          emptyNoteEl.hidden = false;
        }
      }
    },
    clear() {
      rows.length = 0;
      chainVerified = null;
      emptyNoteEl.textContent = m.emptyNote;
      emptyNoteEl.hidden = false;
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
