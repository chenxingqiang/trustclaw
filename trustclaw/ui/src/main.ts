// TrustClaw PTDS side panels — standalone console (A/B left, D/E/F right; chat via Control UI when needed).

import "./styles.css";
import { createApiClient, resolveApiBaseUrl } from "./api.js";
import { renderConsoleOverview } from "./console-overview.js";
import { i18n, msg } from "./i18n/index.js";
import { renderAgentGrants } from "./panels/agent-grants.js";
import { renderAudit } from "./panels/audit.js";
import { renderBrowser } from "./panels/browser.js";
import { renderCompliance } from "./panels/compliance.js";
import { renderLanding } from "./panels/landing.js";
import { renderLedger } from "./panels/ledger.js";
import { bindTrustclawRuntimeContextListener } from "./runtime-bridge.js";
import { initTrustclawThemeSync } from "./theme-sync.js";

initTrustclawThemeSync();

const env = (import.meta as ImportMeta & { env?: { VITE_GATEWAY_URL?: string } }).env;
const client = createApiClient(resolveApiBaseUrl(env, window.location));

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing #app root");
}

type EmbedMode = "left" | "right" | "full";

function resolveEmbedMode(): EmbedMode {
  const raw = new URLSearchParams(window.location.search).get("embed");
  if (raw === "left" || raw === "right") {
    return raw;
  }
  return "full";
}

let setSystemStatus: (running: boolean, detail?: string) => void = () => {};

function mountRightRail(
  col: HTMLElement,
  options?: { onComplianceImported?: () => void; onDataChanged?: () => void },
): void {
  const audit = document.createElement("div");
  const ledger = document.createElement("div");
  const compliance = document.createElement("div");
  col.append(audit, ledger, compliance);

  const ledgerPanel = renderLedger(ledger, client);
  const compliancePanel = renderCompliance(compliance, client, {
    onImported: () => {
      options?.onComplianceImported?.();
      void auditPanel.refresh();
      void ledgerPanel.refresh();
    },
  });
  const auditPanel = renderAudit(audit, client, {
    onLedgerHydrate: (receipts) => ledgerPanel.setReceipts(receipts),
    onLedgerUpsert: (receipt) => ledgerPanel.upsertReceipt(receipt),
  });
  bindTrustclawRuntimeContextListener({
    renderAudit: (context) => auditPanel.render(context),
    appendLedger: (context) => ledgerPanel.append(context),
    onDataChanged: () => {
      void auditPanel.refresh();
      void ledgerPanel.refresh();
    },
  });
  void ledgerPanel.refresh();
}

function mountEmbed(mode: EmbedMode): void {
  app!.innerHTML = "";
  app!.className = `embed embed--${mode}`;

  if (mode === "left") {
    const col = document.createElement("div");
    col.className = "embed-column";
    app!.append(col);
    const landing = document.createElement("div");
    const grants = document.createElement("div");
    const browser = document.createElement("div");
    col.append(landing, grants, browser);
    const browserPanel = renderBrowser(browser, client);
    renderAgentGrants(grants, client);
    renderLanding(landing, client, {
      onInitialized: () => void browserPanel.refresh(),
      onReset: () => void browserPanel.refresh(),
    });
    bindTrustclawRuntimeContextListener({
      onDataChanged: () => void browserPanel.refresh(),
      renderAudit: () => {},
      appendLedger: () => {},
    });
    return;
  }

  if (mode === "right") {
    const col = document.createElement("div");
    col.className = "embed-column";
    app!.append(col);
    mountRightRail(col);
    return;
  }

  mountFullConsole();
}

function mountFullConsole(): void {
  app!.innerHTML = "";
  app!.className = "console-app";
  const m = msg();

  const topbar = document.createElement("header");
  topbar.className = "topbar";
  topbar.innerHTML = `
    <div class="topbar__brand">
      <span class="topbar__icon" aria-hidden="true">🛡</span>
      <div class="topbar__title">
        <span>${escapeHtml(m.console.title)}</span>
        <span class="topbar__badge">${escapeHtml(m.console.badge)}</span>
      </div>
    </div>
    <div class="topbar__status-pill" data-testid="system-status-wrap">
      <span class="status-dot" data-testid="system-status-dot"></span>
      <span data-testid="system-status-text">${escapeHtml(m.console.systemStatus)}：${escapeHtml(m.console.statusChecking)}</span>
    </div>
  `;
  app!.append(topbar);

  const overviewHost = document.createElement("div");
  renderConsoleOverview(overviewHost);
  app!.append(overviewHost);

  const statusDot = topbar.querySelector<HTMLElement>('[data-testid="system-status-dot"]')!;
  const statusWrap = topbar.querySelector<HTMLElement>('[data-testid="system-status-wrap"]')!;
  const statusText = topbar.querySelector<HTMLElement>('[data-testid="system-status-text"]')!;
  setSystemStatus = (running, detail) => {
    const label = running ? m.console.statusRunning : (detail ?? m.console.statusNotReady);
    statusDot.classList.toggle("status-dot--ok", running);
    statusWrap.classList.toggle("topbar__status-pill--ok", running);
    statusText.textContent = `${m.console.systemStatus}：${label}`;
  };

  const shell = document.createElement("div");
  shell.className = "console-shell";
  const layout = document.createElement("div");
  layout.className = "console-layout console-layout--no-chat";
  layout.innerHTML = `
    <div class="console-column console-column--left">
      <p class="console-column__label">${escapeHtml(m.console.columnDataPlane)}</p>
    </div>
    <div class="console-column console-column--right">
      <p class="console-column__label">${escapeHtml(m.console.columnAuditPlane)}</p>
    </div>
  `;
  shell.append(layout);
  app!.append(shell);

  const leftCol = layout.querySelector<HTMLElement>(".console-column--left")!;
  const rightCol = layout.querySelector<HTMLElement>(".console-column--right")!;

  const landingSection = document.createElement("div");
  const grantsSection = document.createElement("div");
  const browserSection = document.createElement("div");
  leftCol.append(landingSection, grantsSection, browserSection);

  const auditSection = document.createElement("div");
  const ledgerSection = document.createElement("div");
  const complianceSection = document.createElement("div");
  rightCol.append(auditSection, ledgerSection, complianceSection);

  const browser = renderBrowser(browserSection, client);
  const ledgerPanel = renderLedger(ledgerSection, client);
  const auditPanel = renderAudit(auditSection, client, {
    onLedgerHydrate: (receipts) => ledgerPanel.setReceipts(receipts),
    onLedgerUpsert: (receipt) => ledgerPanel.upsertReceipt(receipt),
  });
  const compliancePanel = renderCompliance(complianceSection, client, {
    onImported() {
      void browser.refresh();
      void auditPanel.refresh();
      void ledgerPanel.refresh();
    },
  });
  bindTrustclawRuntimeContextListener({
    renderAudit: (context) => auditPanel.render(context),
    appendLedger: (context) => ledgerPanel.append(context),
    onDataChanged: () => {
      void browser.refresh();
      void auditPanel.refresh();
      void ledgerPanel.refresh();
    },
  });
  void ledgerPanel.refresh();

  renderAgentGrants(grantsSection, client);
  renderLanding(landingSection, client, {
    onInitialized() {
      void browser.refresh();
      void compliancePanel.refresh();
      setSystemStatus(true);
    },
    onReset() {
      void browser.refresh();
      void compliancePanel.refresh();
      setSystemStatus(false, m.console.statusReset);
      auditPanel.clear();
      void auditPanel.refresh();
      ledgerPanel.clear();
    },
  });

  void client.status().then((s) => {
    setSystemStatus(s.mounted, s.mounted ? m.console.statusRunning : m.console.statusNotMounted);
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mountApp(): void {
  mountEmbed(resolveEmbedMode());
}

mountApp();
i18n.subscribe(() => {
  mountApp();
});
