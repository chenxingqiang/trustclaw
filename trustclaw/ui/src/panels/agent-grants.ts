// Panel C — Domain Agent authorization (user grants per pack) + JSONL history.

import type { AgentGrantPackRow, TrustclawApiClient } from "../api.js";
import { msg } from "../i18n/index.js";
import { formatGrantTimestamp, renderAgentGrantHistoryTable } from "./agent-grant-history.js";
import { createGrantSessionId } from "./agent-panel-context.js";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function packLabel(pack: AgentGrantPackRow): string {
  return document.documentElement.lang === "zh-CN"
    ? pack.displayName["zh-CN"]
    : pack.displayName.en;
}

export function renderAgentGrants(
  root: HTMLElement,
  client: TrustclawApiClient,
): { refresh(): Promise<void> } {
  const m = msg().panels.agentGrants;
  root.innerHTML = `
    <section class="panel panel--c" data-panel="agent-grants">
      <header class="panel__header">
        <div class="panel__heading">
          <h2>${escapeHtml(m.title)}</h2>
          <p class="panel__subtitle">${escapeHtml(m.subtitle)}</p>
        </div>
        <span class="tag tag--muted" data-testid="agent-grants-status">${escapeHtml(m.loading)}</span>
      </header>
      <div class="panel__body">
        <p class="panel-note">${escapeHtml(m.description)}</p>
        <div data-testid="agent-grants-list" class="agent-grants-list"></div>
        <hr class="panel-divider" />
        <h3 class="panel-subtitle">${escapeHtml(m.historyTitle)}</h3>
        <div data-testid="agent-grant-history-host"></div>
      </div>
    </section>
  `;

  const statusEl = root.querySelector<HTMLElement>('[data-testid="agent-grants-status"]')!;
  const listEl = root.querySelector<HTMLElement>('[data-testid="agent-grants-list"]')!;
  const historyHost = root.querySelector<HTMLElement>('[data-testid="agent-grant-history-host"]')!;
  const packById = new Map<string, AgentGrantPackRow>();

  function resolvePackDisplayName(packId: string): string {
    const pack = packById.get(packId);
    return pack ? packLabel(pack) : packId;
  }

  async function refresh(): Promise<void> {
    statusEl.textContent = m.loading;
    statusEl.className = "tag tag--muted";
    try {
      const data = await client.agentGrants();
      packById.clear();
      for (const pack of data.packs) {
        packById.set(pack.id, pack);
      }

      listEl.innerHTML = data.packs
        .map((pack) => {
          const label = packLabel(pack);
          const grantNote =
            pack.granted_at != null && pack.granted_scopes.length > 0
              ? m.currentGrantAt.replace("{time}", formatGrantTimestamp(pack.granted_at))
              : m.notGrantedNow;
          const checks = pack.available_scopes
            .map((scope) => {
              const scopeLabel = m.scopes[scope as keyof typeof m.scopes] ?? scope;
              const checked = pack.granted_scopes.includes(scope);
              return `<label class="agent-grant-scope">
                <input type="checkbox" data-pack="${escapeHtml(pack.id)}" data-scope="${escapeHtml(scope)}"${checked ? " checked" : ""} />
                ${escapeHtml(scopeLabel)}
              </label>`;
            })
            .join("");
          const domains = (pack.domain ?? []).join(", ");
          return `<article class="agent-grant-card" data-pack-id="${escapeHtml(pack.id)}">
            <header class="agent-grant-card__head">
              <strong>${escapeHtml(label)}</strong>
              <code>${escapeHtml(pack.id)}</code>
            </header>
            <p class="panel-note panel-note--compact agent-grant-card__since">${escapeHtml(grantNote)}</p>
            ${domains ? `<p class="panel-note panel-note--compact">${escapeHtml(m.domain)}: ${escapeHtml(domains)}</p>` : ""}
            <div class="agent-grant-card__scopes">${checks}</div>
            <button type="button" class="btn-primary btn-primary--compact" data-action="save-grant" data-pack="${escapeHtml(pack.id)}">${escapeHtml(m.save)}</button>
          </article>`;
        })
        .join("");

      historyHost.innerHTML = renderAgentGrantHistoryTable(data.history ?? [], {
        empty: m.historyEmpty,
        time: m.historyTime,
        agent: m.historyAgent,
        scopes: m.historyScopes,
        action: m.historyAction,
        granted: m.historyGranted,
        revoked: m.historyRevoked,
        scopeLabels: m.scopes,
        packDisplayName: resolvePackDisplayName,
      });

      statusEl.textContent = m.ready;
      statusEl.className = "tag tag--ok";
    } catch (error) {
      listEl.textContent = `${m.error}: ${(error as Error).message}`;
      historyHost.innerHTML = "";
      statusEl.textContent = m.error;
      statusEl.className = "tag tag--warn";
    }
  }

  listEl.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const saveBtn = target.closest<HTMLButtonElement>('[data-action="save-grant"]');
    if (!saveBtn) {
      return;
    }
    const packId = saveBtn.dataset.pack?.trim();
    if (!packId) {
      return;
    }
    const scopes = [
      ...listEl.querySelectorAll<HTMLInputElement>(`input[data-pack="${packId}"]:checked`),
    ]
      .map((input) => input.dataset.scope?.trim())
      .filter((scope): scope is string => Boolean(scope));
    saveBtn.disabled = true;
    try {
      await client.putAgentGrant({
        session_id: createGrantSessionId(),
        agent_pack_id: packId,
        scopes,
      });
      await refresh();
    } catch (error) {
      statusEl.textContent = `${m.error}: ${(error as Error).message}`;
      statusEl.className = "tag tag--warn";
    } finally {
      saveBtn.disabled = false;
    }
  });

  void refresh();
  return { refresh };
}
