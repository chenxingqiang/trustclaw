// Full-layout audit charter + dual-plane map (standalone Runtime Console only).

import { msg } from "./i18n/index.js";

export function renderConsoleOverview(root: HTMLElement): void {
  const m = msg().console;
  root.innerHTML = `
    <section class="console-overview" data-testid="console-overview" aria-label="${escapeAttr(m.overviewAria)}">
      <div class="console-overview__charter">
        <h2 class="console-overview__title">${escapeHtml(m.auditCharterTitle)}</h2>
        <p class="console-overview__lead">${escapeHtml(m.auditCharterLead)}</p>
        <ul class="console-overview__rules">
          <li>${escapeHtml(m.auditRuleFailClosed)}</li>
          <li>${escapeHtml(m.auditRuleReadOnly)}</li>
          <li>${escapeHtml(m.auditRuleNoPhiDump)}</li>
          <li>${escapeHtml(m.auditRuleLedger)}</li>
          <li>${escapeHtml(m.auditRuleConsent)}</li>
        </ul>
      </div>
      <div class="console-overview__planes">
        <article class="console-overview__plane console-overview__plane--data">
          <h3>${escapeHtml(m.dataPlaneTitle)}</h3>
          <p>${escapeHtml(m.dataPlaneDesc)}</p>
          <ol class="console-overview__flow">
            <li><span class="console-overview__panel-id">A</span> ${escapeHtml(m.dataPlaneStepA)}</li>
            <li><span class="console-overview__panel-id">C</span> ${escapeHtml(m.dataPlaneStepC)}</li>
            <li><span class="console-overview__panel-id">B</span> ${escapeHtml(m.dataPlaneStepB)}</li>
            <li><span class="console-overview__panel-id">F</span> ${escapeHtml(m.dataPlaneStepF)}</li>
          </ol>
        </article>
        <article class="console-overview__plane console-overview__plane--audit">
          <h3>${escapeHtml(m.auditPlaneTitle)}</h3>
          <p>${escapeHtml(m.auditPlaneDesc)}</p>
          <ol class="console-overview__flow">
            <li><span class="console-overview__panel-id">D</span> ${escapeHtml(m.auditPlaneStepD)}</li>
            <li><span class="console-overview__panel-id">E</span> ${escapeHtml(m.auditPlaneStepE)}</li>
          </ol>
          <p class="console-overview__chat-hint">${escapeHtml(m.chatWorkbenchHint)}</p>
        </article>
      </div>
    </section>
  `;
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
