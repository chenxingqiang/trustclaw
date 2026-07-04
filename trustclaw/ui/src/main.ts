// TrustClaw demo SPA entry — PTDS Runtime Console with OpenClaw-compatible i18n.

import "./styles.css";
import { createApiClient } from "./api.js";
import { i18n, msg, type TrustclawLocale } from "./i18n/index.js";
import { renderAudit } from "./panels/audit.js";
import { renderBrowser } from "./panels/browser.js";
import { renderChat } from "./panels/chat.js";
import { renderLanding } from "./panels/landing.js";
import { renderLedger } from "./panels/ledger.js";

const gatewayUrl =
  (import.meta as ImportMeta & { env?: { VITE_GATEWAY_URL?: string } }).env?.VITE_GATEWAY_URL ??
  window.location.origin;

const client = createApiClient(gatewayUrl);

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing #app root");
}

let setSystemStatus: (running: boolean, detail?: string) => void = () => {};

function mountApp(): void {
  app!.innerHTML = "";
  const m = msg();

  const topbar = document.createElement("header");
  topbar.className = "topbar";
  topbar.innerHTML = `
    <div class="topbar__title">
      <span data-i18n="console.title">${escapeHtml(m.console.title)}</span>
      <span class="topbar__badge">${escapeHtml(m.console.badge)}</span>
    </div>
    <div class="topbar__status">
      <span class="status-dot" data-testid="system-status-dot"></span>
      <span data-testid="system-status-text">${escapeHtml(m.console.systemStatus)}：${escapeHtml(m.console.statusChecking)}</span>
    </div>
    <div class="topbar__actions">
      <label class="lang-switch">
        <span>${escapeHtml(m.console.language)}</span>
        <select data-action="locale" aria-label="${escapeHtml(m.console.language)}">
          <option value="en">${escapeHtml(m.console.langEn)}</option>
          <option value="zh-CN">${escapeHtml(m.console.langZh)}</option>
        </select>
      </label>
      <button type="button" data-action="theme">${escapeHtml(m.console.toggleTheme)}</button>
    </div>
  `;
  app!.append(topbar);

  const statusDot = topbar.querySelector<HTMLElement>('[data-testid="system-status-dot"]')!;
  const statusText = topbar.querySelector<HTMLElement>('[data-testid="system-status-text"]')!;
  setSystemStatus = (running, detail) => {
    const label = running ? m.console.statusRunning : (detail ?? m.console.statusNotReady);
    statusDot.classList.toggle("status-dot--ok", running);
    statusText.textContent = `${m.console.systemStatus}：${label}`;
  };

  const localeSelect = topbar.querySelector<HTMLSelectElement>('[data-action="locale"]')!;
  localeSelect.value = i18n.getLocale();
  localeSelect.addEventListener("change", () => {
    i18n.setLocale(localeSelect.value as TrustclawLocale);
  });

  topbar
    .querySelector<HTMLButtonElement>('[data-action="theme"]')
    ?.addEventListener("click", () => {
      document.documentElement.classList.toggle("theme-claw-light");
    });

  const layout = document.createElement("div");
  layout.className = "console-layout";
  layout.innerHTML = `
    <div class="console-column console-column--left"></div>
    <div class="console-column console-column--center"></div>
    <div class="console-column console-column--right"></div>
  `;
  app!.append(layout);

  const leftCol = layout.querySelector<HTMLElement>(".console-column--left")!;
  const centerCol = layout.querySelector<HTMLElement>(".console-column--center")!;
  const rightCol = layout.querySelector<HTMLElement>(".console-column--right")!;

  const landingSection = document.createElement("div");
  const browserSection = document.createElement("div");
  const chatSection = document.createElement("div");
  const auditSection = document.createElement("div");
  const ledgerSection = document.createElement("div");
  leftCol.append(landingSection, browserSection);
  centerCol.append(chatSection);
  rightCol.append(auditSection, ledgerSection);

  const browser = renderBrowser(browserSection, client);
  const audit = renderAudit(auditSection);
  const ledger = renderLedger(ledgerSection);

  renderChat(chatSection, client, {
    onRuntimeContext(context) {
      audit.render(context);
      ledger.append(context);
    },
  });

  renderLanding(landingSection, client, {
    onInitialized() {
      void browser.refresh();
      setSystemStatus(true);
    },
    onReset() {
      audit.clear();
      ledger.clear();
      void browser.refresh();
      setSystemStatus(false, m.console.statusReset);
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

mountApp();
i18n.subscribe(() => {
  mountApp();
});
