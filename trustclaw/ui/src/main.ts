// TrustClaw PTDS side panels — center chat uses OpenClaw Control UI (iframe or native in workbench).

import "./styles.css";
import {
  buildControlUiChatSrc,
  createApiClient,
  resolveApiBaseUrl,
  resolveGatewayControlUiOrigin,
} from "./api.js";
import { i18n, msg } from "./i18n/index.js";
import { renderAudit } from "./panels/audit.js";
import { renderBrowser } from "./panels/browser.js";
import { renderLanding } from "./panels/landing.js";
import { renderLedger } from "./panels/ledger.js";
import { bindTrustclawRuntimeContextListener } from "./runtime-bridge.js";

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

function mountEmbed(mode: EmbedMode): void {
  app!.innerHTML = "";
  app!.className = `embed embed--${mode}`;

  if (mode === "left") {
    const col = document.createElement("div");
    col.className = "embed-column";
    app!.append(col);
    const landing = document.createElement("div");
    const browser = document.createElement("div");
    col.append(landing, browser);
    const browserPanel = renderBrowser(browser, client);
    renderLanding(landing, client, {
      onInitialized: () => void browserPanel.refresh(),
      onReset: () => void browserPanel.refresh(),
    });
    return;
  }

  if (mode === "right") {
    const col = document.createElement("div");
    col.className = "embed-column";
    app!.append(col);
    const audit = document.createElement("div");
    const ledger = document.createElement("div");
    col.append(audit, ledger);
    const auditPanel = renderAudit(audit);
    const ledgerPanel = renderLedger(ledger);
    bindTrustclawRuntimeContextListener({
      renderAudit: (context) => auditPanel.render(context),
      appendLedger: (context) => ledgerPanel.append(context),
    });
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
  layout.className = "console-layout";
  layout.innerHTML = `
    <div class="console-column console-column--left"></div>
    <div class="console-column console-column--center"></div>
    <div class="console-column console-column--right"></div>
  `;
  shell.append(layout);
  app!.append(shell);

  const leftCol = layout.querySelector<HTMLElement>(".console-column--left")!;
  const centerCol = layout.querySelector<HTMLElement>(".console-column--center")!;
  const rightCol = layout.querySelector<HTMLElement>(".console-column--right")!;

  const landingSection = document.createElement("div");
  const browserSection = document.createElement("div");
  const auditSection = document.createElement("div");
  const ledgerSection = document.createElement("div");
  leftCol.append(landingSection, browserSection);
  rightCol.append(auditSection, ledgerSection);

  const chatPanel = document.createElement("section");
  chatPanel.className = "panel panel--chat-embed";
  chatPanel.innerHTML = `
    <header class="panel__header panel--c">
      <h2>${escapeHtml(m.panels.chat.title)}</h2>
    </header>
  `;
  const chatBody = document.createElement("div");
  chatBody.className = "panel__body panel__body--chat-embed";
  const chatFrame = document.createElement("iframe");
  chatFrame.className = "console-chat-frame";
  chatFrame.src = buildControlUiChatSrc(env, window.location);
  chatFrame.title = m.console.chatFrameTitle;
  chatFrame.loading = "lazy";
  chatBody.append(chatFrame);
  chatPanel.append(chatBody);
  centerCol.append(chatPanel);

  const browser = renderBrowser(browserSection, client);
  const auditPanel = renderAudit(auditSection);
  const ledgerPanel = renderLedger(ledgerSection);
  bindTrustclawRuntimeContextListener({
    renderAudit: (context) => auditPanel.render(context),
    appendLedger: (context) => ledgerPanel.append(context),
    allowedOrigins: [window.location.origin, resolveGatewayControlUiOrigin(env, window.location)],
  });

  renderLanding(landingSection, client, {
    onInitialized() {
      void browser.refresh();
      setSystemStatus(true);
    },
    onReset() {
      void browser.refresh();
      setSystemStatus(false, m.console.statusReset);
      auditPanel.clear();
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
