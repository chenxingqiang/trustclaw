// TrustClaw demo SPA entry — PTDS Runtime Console (mockup-aligned 3-column layout).
// Panels share one TrustclawApiClient; gateway URL comes from same origin or Vite proxy.

import "./styles.css";
import { createApiClient } from "./api.js";
import { renderLanding } from "./panels/landing.js";
import { renderBrowser } from "./panels/browser.js";
import { renderChat } from "./panels/chat.js";
import { renderAudit } from "./panels/audit.js";
import { renderLedger } from "./panels/ledger.js";

const gatewayUrl =
  (import.meta as ImportMeta & { env?: { VITE_GATEWAY_URL?: string } }).env?.VITE_GATEWAY_URL ??
  window.location.origin;

const client = createApiClient(gatewayUrl);

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing #app root");
}

let systemStatus = "检查中…";

const topbar = document.createElement("header");
topbar.className = "topbar";
topbar.innerHTML = `
  <div class="topbar__title">
    <span>PTDS Runtime 控制台</span>
    <span class="topbar__badge">TrustClaw V1</span>
  </div>
  <div class="topbar__status">
    <span class="status-dot" data-testid="system-status-dot"></span>
    <span data-testid="system-status-text">系统状态：${systemStatus}</span>
  </div>
  <div class="topbar__actions">
    <button type="button" data-action="theme">切换主题</button>
  </div>
`;
app.append(topbar);

const statusDot = topbar.querySelector<HTMLElement>('[data-testid="system-status-dot"]')!;
const statusText = topbar.querySelector<HTMLElement>('[data-testid="system-status-text"]')!;

function setSystemStatus(running: boolean, detail?: string): void {
  systemStatus = running ? "运行中" : (detail ?? "未就绪");
  statusDot.classList.toggle("status-dot--ok", running);
  statusText.textContent = `系统状态：${systemStatus}`;
}

topbar.querySelector<HTMLButtonElement>('[data-action="theme"]')?.addEventListener("click", () => {
  document.documentElement.classList.toggle("theme-claw-light");
});

const layout = document.createElement("div");
layout.className = "console-layout";
layout.innerHTML = `
  <div class="console-column console-column--left"></div>
  <div class="console-column console-column--center"></div>
  <div class="console-column console-column--right"></div>
`;
app.append(layout);

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
    setSystemStatus(false, "已 Reset");
  },
});

void client.status().then((s) => {
  setSystemStatus(s.mounted, s.mounted ? "运行中" : "未挂载 PTDS");
});
