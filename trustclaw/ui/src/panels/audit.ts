// Panel D — Runtime Audit (JSONL compliance/consent + latest chat pipeline from JSONL or postMessage).

import type { RuntimeContextResponse, TrustclawApiClient } from "../api.js";
import {
  chatPipelineStepStates,
  CHAT_PIPELINE_STEP_ORDER,
  renderChatPipelineFlow,
  type ChatPipelineStepDef,
} from "../audit-pipeline.js";
import { msg } from "../i18n/index.js";
import {
  collectLedgerReceipts,
  pickLatestChatTrail,
  summarizeComplianceEvent,
  type AuditEventRow,
  type LedgerReceiptRow,
} from "./audit-events.js";
import {
  parseEvidenceCitations,
  parseEvidenceCitationsFromAuditOutput,
  renderEvidenceCitationList,
} from "./evidence-citations.js";

type LedgerSync = {
  onLedgerHydrate?: (receipts: LedgerReceiptRow[]) => void;
  onLedgerUpsert?: (receipt: LedgerReceiptRow) => void;
};

function stepLabel(step: string, labels: Record<string, string>): string {
  return labels[step] ?? step;
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

function statusClass(status: string): string {
  if (status === "SUCCESS") {
    return "audit-status--ok";
  }
  if (status === "BLOCKED") {
    return "audit-status--blocked";
  }
  return "audit-status--fail";
}

function renderEventList(
  events: AuditEventRow[],
  stepLabels: Record<string, string>,
  options?: {
    complianceSummary?: boolean;
    evidenceLabels?: {
      title: string;
      tag: (index: number) => string;
      missingValue: string;
    };
  },
): string {
  return events
    .map((event) => {
      const summary = options?.complianceSummary
        ? summarizeComplianceEvent(event)
        : stepLabel(event.step, stepLabels);
      const evidenceBlock =
        event.step === "AGENT_DECISION" && options?.evidenceLabels
          ? renderEvidenceCitationList(
              parseEvidenceCitationsFromAuditOutput(event.output),
              options.evidenceLabels,
            )
          : "";
      return `<li class="audit-event">
          <div class="audit-event__head">
            <strong>${escapeHtml(stepLabel(event.step, stepLabels))}</strong>
            <span class="audit-status ${statusClass(event.status)}">${escapeHtml(event.status)}</span>
          </div>
          <p class="audit-event__summary">${escapeHtml(summary)}</p>
          ${evidenceBlock}
          <div class="audit-event__meta">${escapeHtml(event.component)} · ${escapeHtml(event.audit_trail_id)}</div>
          <time>${escapeHtml(formatEventTime(event.timestamp))}</time>
          <details class="audit-event__details">
            <summary>JSON</summary>
            <pre>${escapeHtml(JSON.stringify({ input: event.input, output: event.output }, null, 2))}</pre>
          </details>
        </li>`;
    })
    .join("");
}

function pipelineDefs(m: ReturnType<typeof msg>["panels"]["audit"]): ChatPipelineStepDef[] {
  return [
    {
      step: "TEXT2SQL_GEN",
      label: m.stepText2sql,
      component: "AgentRuntime.Text2SQL",
      gate: m.gateText2sql,
    },
    { step: "DB_QUERY", label: m.stepQuery, component: "PTDS.Query", gate: m.gateQuery },
    {
      step: "RULE_EVAL",
      label: m.stepRules,
      component: "AgentRuntime.ExecRule",
      gate: m.gateRules,
    },
    {
      step: "AGENT_DECISION",
      label: m.stepDecision,
      component: "Agent.GLP1Decision",
      gate: m.gateDecision,
    },
    {
      step: "LEDGER_COMMIT",
      label: m.stepLedger,
      component: "EvidenceLedger.Commit",
      gate: m.gateLedger,
    },
  ];
}

function countChatPipelineSteps(events: AuditEventRow[]): number {
  const present = new Set(events.map((e) => e.step));
  return CHAT_PIPELINE_STEP_ORDER.filter((step) => present.has(step)).length;
}

function pipelineStatusNote(
  m: ReturnType<typeof msg>["panels"]["audit"],
  trailId: string,
  events: AuditEventRow[],
): string {
  if (events.length === 0) {
    return m.pipelinePending;
  }
  const states = chatPipelineStepStates(events);
  const blockedIndex = states.findIndex((s) => s === "blocked" || s === "fail");
  if (blockedIndex >= 0) {
    const stepDef = pipelineDefs(m)[blockedIndex];
    return m.pipelineBlocked.replace("{step}", stepDef?.label ?? String(blockedIndex + 1));
  }
  const successCount = countChatPipelineSteps(events);
  if (successCount >= CHAT_PIPELINE_STEP_ORDER.length && states.every((s) => s === "ok")) {
    return m.pipelineComplete.replace("{trailId}", trailId);
  }
  return m.pipelineIncomplete.replace("{count}", String(successCount));
}

function refreshPipelineVisual(
  pipelineHost: HTMLElement,
  pipelineNote: HTMLElement,
  m: ReturnType<typeof msg>["panels"]["audit"],
  trailId: string,
  events: AuditEventRow[],
): void {
  const defs = pipelineDefs(m);
  const states = chatPipelineStepStates(events);
  pipelineHost.innerHTML = renderChatPipelineFlow(defs, states);
  pipelineNote.textContent = pipelineStatusNote(m, trailId, events);
}

import { mountPanelAgentBar } from "./panel-agent-bar.js";

export function renderAudit(
  root: HTMLElement,
  client: TrustclawApiClient,
  options?: LedgerSync & { pollMs?: number },
): {
  render(context: RuntimeContextResponse): void;
  refresh(): Promise<void>;
  clear(): void;
  stopPolling(): void;
} {
  const m = msg().panels.audit;
  root.innerHTML = `
    <section class="panel panel--d" data-panel="audit">
      <header class="panel__header">
        <div class="panel__heading">
          <h2>${escapeHtml(m.title)}</h2>
          <p class="panel__subtitle">${escapeHtml(m.subtitle)}</p>
        </div>
        <button type="button" class="btn-inline" data-action="refresh-audit">${escapeHtml(m.reload)}</button>
      </header>
      <div class="panel__body">
        <div class="audit-section audit-section--pipeline">
          <h3 class="audit-section__title">${escapeHtml(m.sectionPipeline)}</h3>
          <p class="panel-note panel-note--compact" data-testid="audit-pipeline-note">${escapeHtml(m.pipelinePending)}</p>
          <div data-testid="audit-pipeline-host"></div>
        </div>
        <div class="audit-section">
          <h3 class="audit-section__title">${escapeHtml(m.sectionCompliance)}</h3>
          <p class="panel-note panel-note--compact" data-testid="audit-compliance-note">${escapeHtml(m.compliancePlaceholder)}</p>
          <ol class="audit-timeline" data-testid="audit-compliance-timeline"></ol>
        </div>
        <div class="audit-section">
          <h3 class="audit-section__title">${escapeHtml(m.sectionChat)}</h3>
          <p class="panel-note panel-note--compact">
            ${escapeHtml(m.chatTrailLabel)} <span data-testid="audit-trail-id"></span>
          </p>
          <p class="panel-note panel-note--compact" data-testid="audit-chat-note">${escapeHtml(m.chatLoading)}</p>
          <ol class="audit-timeline" data-testid="audit-chat-timeline"></ol>
        </div>
      </div>
    </section>
  `;

  const refreshBtn = root.querySelector<HTMLButtonElement>('[data-action="refresh-audit"]')!;
  const pipelineNote = root.querySelector<HTMLElement>('[data-testid="audit-pipeline-note"]')!;
  const pipelineHost = root.querySelector<HTMLElement>('[data-testid="audit-pipeline-host"]')!;
  const complianceNote = root.querySelector<HTMLElement>('[data-testid="audit-compliance-note"]')!;
  const complianceTimeline = root.querySelector<HTMLElement>(
    '[data-testid="audit-compliance-timeline"]',
  )!;
  const trailIdEl = root.querySelector<HTMLElement>('[data-testid="audit-trail-id"]')!;
  const chatNote = root.querySelector<HTMLElement>('[data-testid="audit-chat-note"]')!;
  const chatTimeline = root.querySelector<HTMLElement>('[data-testid="audit-chat-timeline"]')!;
  const panelBody = root.querySelector<HTMLElement>(".panel__body")!;
  const agentBar = mountPanelAgentBar(panelBody, client, "panel.audit");

  const stepLabels: Record<string, string> = {
    AGENT_DOMAIN_GRANT: m.stepAgentDomainGrant,
    DATA_CONSENT: m.stepDataConsent,
    COMPLIANCE_IMPORT: m.stepComplianceImport,
    REFERENCE_SYNC: m.stepReferenceSync,
    DEVICE_IMPORT: m.stepDeviceImport,
    TEXT2SQL_GEN: m.stepText2sql,
    DB_QUERY: m.stepQuery,
    RULE_EVAL: m.stepRules,
    AGENT_DECISION: m.stepDecision,
    LEDGER_COMMIT: m.stepLedger,
  };

  const evidenceLabels = {
    title: m.evidenceTitle,
    tag: (index: number) => m.evidenceTag.replace("{n}", String(index)),
    missingValue: m.evidenceMissingValue,
  };

  function hydrateLedgerFromEvents(events: AuditEventRow[]): void {
    options?.onLedgerHydrate?.(collectLedgerReceipts(events));
  }

  function renderComplianceEvents(events: AuditEventRow[]): void {
    if (events.length === 0) {
      complianceNote.textContent = m.complianceEmpty;
      complianceTimeline.innerHTML = "";
      return;
    }
    complianceNote.textContent = m.complianceLoaded.replace("{count}", String(events.length));
    complianceTimeline.innerHTML = renderEventList(events, stepLabels, { complianceSummary: true });
  }

  function renderChatTrailFromEvents(trailId: string, events: AuditEventRow[]): void {
    trailIdEl.textContent = trailId;
    chatNote.textContent = m.chatLoaded.replace("{count}", String(events.length));
    chatTimeline.innerHTML = renderEventList(events, stepLabels, { evidenceLabels });
    refreshPipelineVisual(pipelineHost, pipelineNote, m, trailId, events);
    hydrateLedgerFromEvents(events);
  }

  function renderChatTrailEmpty(): void {
    trailIdEl.textContent = "";
    chatNote.textContent = m.chatEmpty;
    chatTimeline.innerHTML = "";
    refreshPipelineVisual(pipelineHost, pipelineNote, m, "", []);
  }

  async function refreshComplianceEvents(): Promise<void> {
    complianceNote.textContent = m.loading;
    try {
      const packId = agentBar.getSelectedPackId();
      const response = await client.auditEvents("compliance", 40, packId);
      renderComplianceEvents(response.events ?? []);
    } catch (error) {
      const message = (error as Error).message;
      complianceNote.textContent = message.includes("404")
        ? m.apiUnavailable
        : `${m.loadError}: ${message}`;
      complianceTimeline.innerHTML = "";
    }
  }

  async function refreshChatEvents(): Promise<void> {
    chatNote.textContent = m.chatLoading;
    try {
      const packId = agentBar.getSelectedPackId();
      const response = await client.auditEvents("chat", 60, packId);
      const events = response.events ?? [];
      hydrateLedgerFromEvents(events);
      const latest = pickLatestChatTrail(events);
      if (!latest) {
        renderChatTrailEmpty();
        return;
      }
      renderChatTrailFromEvents(latest.trailId, latest.events);
    } catch (error) {
      const message = (error as Error).message;
      chatNote.textContent = message.includes("404")
        ? m.apiUnavailable
        : `${m.loadError}: ${message}`;
      trailIdEl.textContent = "";
      chatTimeline.innerHTML = "";
    }
  }

  async function refreshAll(): Promise<void> {
    await Promise.all([refreshComplianceEvents(), refreshChatEvents()]);
  }

  refreshBtn.addEventListener("click", () => {
    void refreshAll();
  });

  void agentBar.refresh().then(() => refreshAll());
  refreshPipelineVisual(pipelineHost, pipelineNote, m, "", []);

  const pollMs = options?.pollMs ?? 5000;
  const pollTimer = window.setInterval(() => {
    void agentBar.refresh().then(() => refreshAll());
  }, pollMs);

  return {
    render(context) {
      const selectedPackId = agentBar.getSelectedPackId();
      const contextPackId = context.agent_pack_id?.trim();
      if (contextPackId && contextPackId !== selectedPackId) {
        chatNote.textContent = m.chatOtherAgent.replace("{agent}", contextPackId);
        return;
      }

      trailIdEl.textContent = context.audit_trail_id;
      chatNote.textContent = m.chatLive;
      void refreshComplianceEvents();
      const stages = context.pipeline_stages;
      const syntheticEvents: AuditEventRow[] = [];
      if (stages.text2sql) {
        syntheticEvents.push({
          event_id: "live-1",
          audit_trail_id: context.audit_trail_id,
          step: "TEXT2SQL_GEN",
          timestamp: Date.now() / 1000,
          component: "AgentRuntime.Text2SQL",
          input: {},
          output: stages.text2sql as Record<string, unknown>,
          status: "SUCCESS",
        });
      }
      if (stages.db_query) {
        syntheticEvents.push({
          event_id: "live-2",
          audit_trail_id: context.audit_trail_id,
          step: "DB_QUERY",
          timestamp: Date.now() / 1000,
          component: "PTDS.Query",
          input: {},
          output: stages.db_query as Record<string, unknown>,
          status: "SUCCESS",
        });
      }
      if (stages.rule_evaluation) {
        syntheticEvents.push({
          event_id: "live-3",
          audit_trail_id: context.audit_trail_id,
          step: "RULE_EVAL",
          timestamp: Date.now() / 1000,
          component: "AgentRuntime.ExecRule",
          input: {},
          output: stages.rule_evaluation as Record<string, unknown>,
          status: "SUCCESS",
        });
      }
      if (stages.agent_decision) {
        syntheticEvents.push({
          event_id: "live-4",
          audit_trail_id: context.audit_trail_id,
          step: "AGENT_DECISION",
          timestamp: Date.now() / 1000,
          component: "Agent.GLP1Decision",
          input: {},
          output: stages.agent_decision as Record<string, unknown>,
          status: "SUCCESS",
        });
      }
      if (context.evidence_ledger_receipt?.proof_hash) {
        syntheticEvents.push({
          event_id: "live-5",
          audit_trail_id: context.audit_trail_id,
          step: "LEDGER_COMMIT",
          timestamp: Date.now() / 1000,
          component: "EvidenceLedger.Commit",
          input: {},
          output: context.evidence_ledger_receipt as Record<string, unknown>,
          status: "SUCCESS",
        });
      }
      refreshPipelineVisual(pipelineHost, pipelineNote, m, context.audit_trail_id, syntheticEvents);
      const now = Date.now();
      const items: Array<{ label: string; body: unknown; offsetMs: number }> = [
        { label: m.stepUser, body: { query: context.user_query }, offsetMs: 0 },
        { label: m.stepText2sql, body: stages.text2sql, offsetMs: 1000 },
        { label: m.stepQuery, body: stages.db_query, offsetMs: 2000 },
        { label: m.stepRules, body: stages.rule_evaluation, offsetMs: 3000 },
        { label: m.stepDecision, body: stages.agent_decision, offsetMs: 4000 },
        {
          label: m.stepLedger,
          body: context.evidence_ledger_receipt ?? { pending: m.ledgerPending },
          offsetMs: 5000,
        },
      ];
      chatTimeline.innerHTML = items
        .map((item) => {
          const stamp = new Date(now + item.offsetMs).toLocaleTimeString();
          const evidenceBlock =
            item.label === m.stepDecision
              ? renderEvidenceCitationList(
                  parseEvidenceCitations(stages.agent_decision),
                  evidenceLabels,
                )
              : "";
          return `<li><strong>${escapeHtml(item.label)}</strong><time>${escapeHtml(stamp)}</time>${evidenceBlock}<pre>${escapeHtml(
            JSON.stringify(item.body ?? null, null, 2),
          )}</pre></li>`;
        })
        .join("");
      if (context.evidence_ledger_receipt?.proof_hash) {
        if (!contextPackId || contextPackId === selectedPackId) {
          options?.onLedgerUpsert?.({
            block_height: context.evidence_ledger_receipt.block_height,
            proof_hash: context.evidence_ledger_receipt.proof_hash,
            audit_trail_id: context.audit_trail_id,
            timestamp: Date.now() / 1000,
          });
        }
      }
    },
    async refresh() {
      await agentBar.refresh();
      await refreshAll();
    },
    clear() {
      trailIdEl.textContent = "";
      chatNote.textContent = m.chatEmpty;
      chatTimeline.innerHTML = "";
      refreshPipelineVisual(pipelineHost, pipelineNote, m, "", []);
    },
    stopPolling() {
      window.clearInterval(pollTimer);
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
