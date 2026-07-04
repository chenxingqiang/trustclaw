// Panel F — Compliance data subscription (pharma standards + NRDL reference).

import type {
  CompliancePreviewResult,
  DeviceImportPreviewResult,
  ReferencePreviewResult,
  TrustclawApiClient,
} from "../api.js";
import { msg } from "../i18n/index.js";
import { mountPanelAgentBar } from "./panel-agent-bar.js";

export interface ComplianceHandlers {
  onImported(): void;
}

type SubscriptionType = "pharma-compliance" | "nrdl-reference" | "device-data";
type SubscriptionMethod = "bundled" | "file" | "url" | "api";

const PHARMA_METHODS: SubscriptionMethod[] = ["bundled", "file"];
const NRDL_METHODS: SubscriptionMethod[] = ["bundled", "url", "file"];
const DEVICE_METHODS: SubscriptionMethod[] = ["api", "file"];

function createConsentSessionId(): string {
  return `ui_${crypto.randomUUID()}`;
}

export function renderCompliance(
  root: HTMLElement,
  client: TrustclawApiClient,
  handlers: ComplianceHandlers,
): { refresh(): Promise<void> } {
  const m = msg().panels.compliance;
  const r = msg().panels.reference;
  const d = msg().panels.device;
  root.innerHTML = `
    <section class="panel panel--f" data-panel="compliance">
      <header class="panel__header">
        <div class="panel__heading">
          <h2>${escapeHtml(m.title)}</h2>
          <p class="panel__subtitle">${escapeHtml(m.subtitle)}</p>
        </div>
        <span class="tag tag--muted" data-testid="subscription-active">${escapeHtml(m.noStandard)}</span>
      </header>
      <div class="panel__body">
        <p class="panel-note">${escapeHtml(m.description)}</p>
        <div class="init-form__grid subscription-form">
          <label>
            ${escapeHtml(m.subscriptionTypeLabel)}
            <select data-testid="subscription-type">
              <option value="pharma-compliance">${escapeHtml(m.typePharmaCompliance)}</option>
              <option value="nrdl-reference">${escapeHtml(m.typeNrdlReference)}</option>
              <option value="device-data">${escapeHtml(m.typeDeviceData)}</option>
            </select>
          </label>
          <label>
            ${escapeHtml(m.subscriptionMethodLabel)}
            <select data-testid="subscription-method"></select>
          </label>
        </div>
        <div class="compliance-active" data-testid="subscription-status"></div>
        <fieldset class="history-fieldset subscription-section" data-section="pharma-file">
          <legend>${escapeHtml(m.sectionFile)}</legend>
          <label class="compliance-file">
            ${escapeHtml(m.fileLabel)}
            <input type="file" accept=".json,application/json" data-testid="compliance-file" />
          </label>
          <p class="panel-note panel-note--compact">${escapeHtml(m.fileHint)}</p>
        </fieldset>
        <fieldset class="history-fieldset subscription-section subscription-section--hidden" data-section="nrdl-url">
          <legend>${escapeHtml(r.sectionUrl)}</legend>
          <label class="compliance-file">
            ${escapeHtml(r.urlLabel)}
            <input type="url" inputmode="url" placeholder="https://…/nrdl-reference.json" data-testid="reference-url" />
          </label>
          <p class="panel-note panel-note--compact">${escapeHtml(r.urlHint)}</p>
        </fieldset>
        <fieldset class="history-fieldset subscription-section subscription-section--hidden" data-section="device-api">
          <legend>${escapeHtml(d.sectionApi)}</legend>
          <label class="compliance-file">
            ${escapeHtml(d.urlLabel)}
            <input type="url" inputmode="url" placeholder="https://…/device-export.json" data-testid="device-url" />
          </label>
          <p class="panel-note panel-note--compact">${escapeHtml(d.urlHint)}</p>
          <label class="compliance-file">
            ${escapeHtml(d.hintLabel)}
            <input type="text" data-testid="device-hint" placeholder="${escapeHtml(d.hintPlaceholder)}" />
          </label>
        </fieldset>
        <fieldset class="history-fieldset subscription-section subscription-section--hidden" data-section="device-file">
          <legend>${escapeHtml(d.sectionFile)}</legend>
          <label class="compliance-file">
            ${escapeHtml(d.fileLabel)}
            <input type="file" accept=".json,application/json" data-testid="device-file" />
          </label>
          <p class="panel-note panel-note--compact">${escapeHtml(d.fileHint)}</p>
          <label class="compliance-file">
            ${escapeHtml(d.hintLabel)}
            <input type="text" data-testid="device-file-hint" placeholder="${escapeHtml(d.hintPlaceholder)}" />
          </label>
        </fieldset>
        <fieldset class="history-fieldset subscription-section subscription-section--hidden" data-section="nrdl-file">
          <legend>${escapeHtml(r.sectionFile)}</legend>
          <label class="compliance-file">
            ${escapeHtml(r.fileLabel)}
            <input type="file" accept=".json,application/json" data-testid="reference-file" />
          </label>
          <p class="panel-note panel-note--compact">${escapeHtml(r.fileHint)}</p>
        </fieldset>
        <fieldset class="history-fieldset">
          <legend>${escapeHtml(m.sectionConsent)}</legend>
          <label class="init-form__check compliance-consent">
            <input type="checkbox" data-testid="subscription-consent" />
            <span data-testid="subscription-consent-label">${escapeHtml(m.consentLabel)}</span>
          </label>
          <p class="panel-note panel-note--compact" data-testid="subscription-consent-hint">${escapeHtml(m.consentHint)}</p>
        </fieldset>
        <div class="actions">
          <button type="button" class="subscription-action subscription-section--hidden" data-action="preview">${escapeHtml(m.previewBtn)}</button>
          <button type="button" class="btn-primary subscription-action subscription-section--hidden" data-action="import" disabled>${escapeHtml(m.importBtn)}</button>
          <button type="button" class="btn-primary subscription-action subscription-section--hidden" data-action="reference-sync" disabled>${escapeHtml(r.syncBtn)}</button>
          <button type="button" class="btn-primary subscription-action subscription-section--hidden" data-action="reference-sync-url" disabled>${escapeHtml(r.syncUrlBtn)}</button>
          <button type="button" class="btn-primary subscription-action subscription-section--hidden" data-action="device-import" disabled>${escapeHtml(d.importBtn)}</button>
          <button type="button" class="subscription-action" data-action="bundled">${escapeHtml(m.bundledBtn)}</button>
        </div>
        <pre data-testid="subscription-result" class="result"></pre>
      </div>
    </section>
  `;

  const typeSelect = root.querySelector<HTMLSelectElement>('[data-testid="subscription-type"]')!;
  const methodSelect = root.querySelector<HTMLSelectElement>(
    '[data-testid="subscription-method"]',
  )!;
  const activeTag = root.querySelector<HTMLElement>('[data-testid="subscription-active"]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-testid="subscription-status"]')!;
  const consentInput = root.querySelector<HTMLInputElement>(
    '[data-testid="subscription-consent"]',
  )!;
  const consentLabelEl = root.querySelector<HTMLElement>(
    '[data-testid="subscription-consent-label"]',
  )!;
  const consentHintEl = root.querySelector<HTMLElement>(
    '[data-testid="subscription-consent-hint"]',
  )!;
  const fileInput = root.querySelector<HTMLInputElement>('[data-testid="compliance-file"]')!;
  const referenceUrlInput = root.querySelector<HTMLInputElement>('[data-testid="reference-url"]')!;
  const referenceFileInput = root.querySelector<HTMLInputElement>(
    '[data-testid="reference-file"]',
  )!;
  const deviceUrlInput = root.querySelector<HTMLInputElement>('[data-testid="device-url"]')!;
  const deviceHintInput = root.querySelector<HTMLInputElement>('[data-testid="device-hint"]')!;
  const deviceFileInput = root.querySelector<HTMLInputElement>('[data-testid="device-file"]')!;
  const deviceFileHintInput = root.querySelector<HTMLInputElement>(
    '[data-testid="device-file-hint"]',
  )!;
  const previewBtn = root.querySelector<HTMLButtonElement>('[data-action="preview"]')!;
  const importBtn = root.querySelector<HTMLButtonElement>('[data-action="import"]')!;
  const referenceSyncBtn = root.querySelector<HTMLButtonElement>('[data-action="reference-sync"]')!;
  const referenceSyncUrlBtn = root.querySelector<HTMLButtonElement>(
    '[data-action="reference-sync-url"]',
  )!;
  const deviceImportBtn = root.querySelector<HTMLButtonElement>('[data-action="device-import"]')!;
  const bundledBtn = root.querySelector<HTMLButtonElement>('[data-action="bundled"]')!;
  const resultEl = root.querySelector<HTMLElement>('[data-testid="subscription-result"]')!;
  const panelBody = root.querySelector<HTMLElement>(".panel__body")!;
  const agentBar = mountPanelAgentBar(panelBody, client, "panel.compliance");
  const selectedPackId = () => agentBar.getSelectedPackId();

  let subscriptionType: SubscriptionType = "pharma-compliance";
  let subscriptionMethod: SubscriptionMethod = "bundled";
  let pendingPackage: unknown = null;
  let pendingSourceLabel = "";
  let lastPreview: CompliancePreviewResult | null = null;
  let pendingReferencePackage: unknown = null;
  let pendingReferenceSourceLabel = "";
  let lastReferencePreview: ReferencePreviewResult | null = null;
  let pendingDevicePackage: unknown = null;
  let pendingDeviceSourceLabel = "";
  let pendingDeviceUrl = "";
  let lastDevicePreview: DeviceImportPreviewResult | null = null;

  function currentMethods(): SubscriptionMethod[] {
    if (subscriptionType === "device-data") {
      return DEVICE_METHODS;
    }
    return subscriptionType === "pharma-compliance" ? PHARMA_METHODS : NRDL_METHODS;
  }

  function methodLabel(method: SubscriptionMethod): string {
    if (method === "bundled") {
      return m.methodBundled;
    }
    if (method === "url") {
      return m.methodUrl;
    }
    if (method === "api") {
      return m.methodApi;
    }
    return m.methodFile;
  }

  function resetPending(): void {
    pendingPackage = null;
    pendingSourceLabel = "";
    lastPreview = null;
    pendingReferencePackage = null;
    pendingReferenceSourceLabel = "";
    lastReferencePreview = null;
    pendingDevicePackage = null;
    pendingDeviceSourceLabel = "";
    pendingDeviceUrl = "";
    lastDevicePreview = null;
    resultEl.textContent = "";
  }

  function syncMethodOptions(): void {
    const methods = currentMethods();
    if (!methods.includes(subscriptionMethod)) {
      subscriptionMethod = methods[0] ?? "bundled";
    }
    methodSelect.innerHTML = methods
      .map(
        (method) =>
          `<option value="${method}"${method === subscriptionMethod ? " selected" : ""}>${escapeHtml(methodLabel(method))}</option>`,
      )
      .join("");
  }

  function setSectionVisible(key: string, visible: boolean): void {
    for (const el of root.querySelectorAll<HTMLElement>(`[data-section="${key}"]`)) {
      el.classList.toggle("subscription-section--hidden", !visible);
    }
  }

  function setActionVisible(action: string, visible: boolean): void {
    const el = root.querySelector<HTMLElement>(`[data-action="${action}"]`);
    el?.classList.toggle("subscription-section--hidden", !visible);
  }

  function syncSubscriptionUi(): void {
    const isPharma = subscriptionType === "pharma-compliance";
    const isNrdl = subscriptionType === "nrdl-reference";
    const isDevice = subscriptionType === "device-data";
    const isBundled = subscriptionMethod === "bundled";
    const isFile = subscriptionMethod === "file";
    const isUrl = subscriptionMethod === "url";
    const isApi = subscriptionMethod === "api";

    if (isPharma) {
      consentLabelEl.textContent = m.consentLabel;
      consentHintEl.textContent = m.consentHint;
    } else if (isNrdl) {
      consentLabelEl.textContent = r.consentLabel;
      consentHintEl.textContent = r.consentHint;
    } else {
      consentLabelEl.textContent = d.consentLabel;
      consentHintEl.textContent = d.consentHint;
    }
    bundledBtn.textContent = isPharma ? m.bundledBtn : r.bundledBtn;
    previewBtn.textContent = isDevice ? d.previewBtn : isPharma ? m.previewBtn : r.previewBtn;

    setSectionVisible("pharma-file", isPharma && isFile);
    setSectionVisible("nrdl-url", isNrdl && isUrl);
    setSectionVisible("nrdl-file", isNrdl && isFile);
    setSectionVisible("device-api", isDevice && isApi);
    setSectionVisible("device-file", isDevice && isFile);

    setActionVisible("preview", isPharma && isFile ? true : isNrdl && isFile ? true : isDevice);
    setActionVisible("import", isPharma && isFile);
    setActionVisible("reference-sync", isNrdl && isFile);
    setActionVisible("reference-sync-url", isNrdl && isUrl);
    setActionVisible("device-import", isDevice);
    setActionVisible("bundled", isBundled);

    void refreshSubscriptionStatus();
    syncActionEnabled();
  }

  function syncActionEnabled(): void {
    const consented = consentInput.checked;
    bundledBtn.disabled = !consented;

    if (subscriptionType === "pharma-compliance" && subscriptionMethod === "file") {
      importBtn.disabled = !(
        consented &&
        pendingPackage !== null &&
        lastPreview?.status === "success"
      );
      return;
    }

    if (subscriptionType === "nrdl-reference" && subscriptionMethod === "file") {
      referenceSyncBtn.disabled = !(
        consented &&
        pendingReferencePackage !== null &&
        lastReferencePreview?.status === "success"
      );
      return;
    }

    if (subscriptionType === "nrdl-reference" && subscriptionMethod === "url") {
      referenceSyncUrlBtn.disabled = !(consented && referenceUrlInput.value.trim().length > 0);
      return;
    }

    if (subscriptionType === "device-data") {
      deviceImportBtn.disabled = !(
        consented &&
        lastDevicePreview?.status === "success" &&
        (lastDevicePreview.sql_statements?.length ?? 0) > 0
      );
    }
  }

  async function refreshDeviceStatus(): Promise<void> {
    try {
      const response = await client.auditEvents("compliance", 40, selectedPackId());
      const last = [...(response.events ?? [])]
        .reverse()
        .find((event) => event.step === "DEVICE_IMPORT" && event.status === "SUCCESS");
      if (!last) {
        activeTag.textContent = d.statusEmpty;
        activeTag.className = "tag tag--muted";
        statusEl.innerHTML = "";
        return;
      }
      const tables = Array.isArray(last.output.tables) ? (last.output.tables as string[]) : [];
      activeTag.textContent = d.statusReady;
      activeTag.className = "tag tag--ok";
      statusEl.innerHTML = `
        <dl class="compliance-meta">
          <div><dt>${escapeHtml(d.metaTables)}</dt><dd>${escapeHtml(tables.join(", ") || "—")}</dd></div>
          <div><dt>${escapeHtml(d.metaStatements)}</dt><dd>${escapeHtml(String(last.output.rows_affected ?? "—"))}</dd></div>
        </dl>
      `;
    } catch {
      activeTag.textContent = d.statusEmpty;
      activeTag.className = "tag tag--muted";
      statusEl.innerHTML = "";
    }
  }

  async function refreshPharmaStatus(): Promise<void> {
    const response = await client.complianceStandards(selectedPackId());
    const active = response.standards?.find((row) => row.is_active === 1);
    if (!active) {
      activeTag.textContent = m.noStandard;
      activeTag.className = "tag tag--muted";
      statusEl.innerHTML = "";
      return;
    }
    activeTag.textContent = m.activeStandard;
    activeTag.className = "tag tag--ok";
    statusEl.innerHTML = `
      <dl class="compliance-meta">
        <div><dt>${escapeHtml(m.metaVersion)}</dt><dd>${escapeHtml(active.standard_id)}</dd></div>
        <div><dt>${escapeHtml(m.metaPublisher)}</dt><dd>${escapeHtml(active.publisher)}</dd></div>
        <div><dt>${escapeHtml(m.metaPublisherSignature)}</dt><dd><code>${escapeHtml(active.publisher_signature ? `${active.publisher_signature.slice(0, 24)}…` : "—")}</code></dd></div>
        <div><dt>${escapeHtml(m.metaRelease)}</dt><dd>${escapeHtml(active.release_date)}</dd></div>
        <div><dt>${escapeHtml(m.metaSource)}</dt><dd>${escapeHtml(active.source_label ?? "—")}</dd></div>
      </dl>
    `;
  }

  async function refreshReferenceStatus(): Promise<void> {
    const status = await client.referenceStatus(selectedPackId());
    const last = status.last_sync;
    if (!last) {
      activeTag.textContent = m.noStandard;
      activeTag.className = "tag tag--muted";
      statusEl.innerHTML = `<p class="panel-note">${escapeHtml(r.statusEmpty)} · ${escapeHtml(String(status.local_drug_count ?? 0))} ${escapeHtml(r.metaDrugs)} · ${escapeHtml(String(status.local_rule_count ?? 0))} ${escapeHtml(r.metaRules)}</p>`;
      return;
    }
    activeTag.textContent = r.statusLoaded
      .replace("{drugs}", String(last.drug_count))
      .replace("{rules}", String(last.rule_count))
      .replace("{synced}", last.synced_at);
    activeTag.className = "tag tag--ok";
    statusEl.innerHTML = `
      <dl class="compliance-meta">
        <div><dt>${escapeHtml(r.metaVersion)}</dt><dd>${escapeHtml(last.version_id)}</dd></div>
        <div><dt>${escapeHtml(r.metaDrugs)}</dt><dd>${escapeHtml(String(last.drug_count))}</dd></div>
        <div><dt>${escapeHtml(r.metaRules)}</dt><dd>${escapeHtml(String(last.rule_count))}</dd></div>
        <div><dt>${escapeHtml(r.metaSynced)}</dt><dd>${escapeHtml(last.synced_at)}</dd></div>
        ${last.subscription_url ? `<div><dt>${escapeHtml(r.metaSubscription)}</dt><dd>${escapeHtml(last.subscription_url)}</dd></div>` : ""}
      </dl>
    `;
  }

  async function refreshSubscriptionStatus(): Promise<void> {
    try {
      if (subscriptionType === "pharma-compliance") {
        await refreshPharmaStatus();
        return;
      }
      if (subscriptionType === "device-data") {
        await refreshDeviceStatus();
        return;
      }
      await refreshReferenceStatus();
    } catch (error) {
      activeTag.textContent = m.loadError;
      activeTag.className = "tag tag--warn";
      statusEl.textContent = (error as Error).message;
    }
  }

  async function readPharmaFile(): Promise<{ package: unknown; sourceLabel: string } | null> {
    const file = fileInput.files?.[0];
    if (!file) {
      resultEl.textContent = m.selectFile;
      return null;
    }
    const text = await file.text();
    pendingSourceLabel = file.name;
    pendingPackage = JSON.parse(text) as unknown;
    return { package: pendingPackage, sourceLabel: pendingSourceLabel };
  }

  async function readReferenceFile(): Promise<{ package: unknown; sourceLabel: string } | null> {
    const file = referenceFileInput.files?.[0];
    if (!file) {
      resultEl.textContent = r.selectSource;
      return null;
    }
    const text = await file.text();
    pendingReferenceSourceLabel = file.name;
    pendingReferencePackage = JSON.parse(text) as unknown;
    return { package: pendingReferencePackage, sourceLabel: pendingReferenceSourceLabel };
  }

  async function readDeviceFile(): Promise<{ package: unknown; sourceLabel: string } | null> {
    const file = deviceFileInput.files?.[0];
    if (!file) {
      resultEl.textContent = d.selectSource;
      return null;
    }
    const text = await file.text();
    pendingDeviceSourceLabel = file.name;
    pendingDevicePackage = JSON.parse(text) as unknown;
    return { package: pendingDevicePackage, sourceLabel: pendingDeviceSourceLabel };
  }

  function deviceHint(): string | undefined {
    const hint =
      subscriptionMethod === "api"
        ? deviceHintInput.value.trim()
        : deviceFileHintInput.value.trim();
    return hint.length > 0 ? hint : undefined;
  }

  typeSelect.addEventListener("change", () => {
    subscriptionType = typeSelect.value as SubscriptionType;
    resetPending();
    consentInput.checked = false;
    syncMethodOptions();
    syncSubscriptionUi();
  });

  methodSelect.addEventListener("change", () => {
    subscriptionMethod = methodSelect.value as SubscriptionMethod;
    resetPending();
    syncSubscriptionUi();
  });

  consentInput.addEventListener("change", syncActionEnabled);
  referenceUrlInput.addEventListener("input", syncActionEnabled);
  deviceUrlInput.addEventListener("input", syncActionEnabled);

  previewBtn.addEventListener("click", () => {
    void (async () => {
      if (subscriptionType === "device-data") {
        resultEl.textContent = d.previewing;
        try {
          const hint = deviceHint();
          if (subscriptionMethod === "api" && !deviceUrlInput.value.trim()) {
            resultEl.textContent = d.selectSource;
            return;
          }
          if (subscriptionMethod === "file" && !(await readDeviceFile())) {
            return;
          }
          if (subscriptionMethod === "api") {
            pendingDeviceUrl = deviceUrlInput.value.trim();
          }
          lastDevicePreview = await client.devicePreview(
            subscriptionMethod === "api"
              ? { url: pendingDeviceUrl, deviceHint: hint }
              : { package: pendingDevicePackage, deviceHint: hint },
            selectedPackId(),
          );
          resultEl.textContent = JSON.stringify(lastDevicePreview, null, 2);
          syncActionEnabled();
        } catch (error) {
          lastDevicePreview = null;
          resultEl.textContent = `${m.loadError}: ${(error as Error).message}`;
          syncActionEnabled();
        }
        return;
      }

      resultEl.textContent = subscriptionType === "pharma-compliance" ? m.previewing : r.previewing;
      try {
        if (subscriptionType === "pharma-compliance") {
          const payload = await readPharmaFile();
          if (!payload) {
            return;
          }
          lastPreview = await client.compliancePreview(payload.package, selectedPackId());
          resultEl.textContent = JSON.stringify(lastPreview, null, 2);
        } else if (subscriptionType === "nrdl-reference") {
          const payload = await readReferenceFile();
          if (!payload) {
            return;
          }
          lastReferencePreview = await client.referencePreview(
            { package: payload.package },
            selectedPackId(),
          );
          resultEl.textContent = JSON.stringify(lastReferencePreview, null, 2);
        }
        syncActionEnabled();
      } catch (error) {
        lastPreview = null;
        lastReferencePreview = null;
        pendingPackage = null;
        pendingReferencePackage = null;
        resultEl.textContent = `${m.loadError}: ${(error as Error).message}`;
        syncActionEnabled();
      }
    })();
  });

  importBtn.addEventListener("click", () => {
    void (async () => {
      if (!consentInput.checked) {
        resultEl.textContent = m.consentRequired;
        return;
      }
      if (!pendingPackage || lastPreview?.status !== "success") {
        resultEl.textContent = m.previewFirst;
        return;
      }
      resultEl.textContent = m.importing;
      try {
        const result = await client.complianceImport(
          {
            consentGranted: true,
            sessionId: createConsentSessionId(),
            sourceLabel: pendingSourceLabel || undefined,
            package: pendingPackage,
          },
          selectedPackId(),
        );
        resultEl.textContent = JSON.stringify(result, null, 2);
        if (result.status === "success") {
          await refreshSubscriptionStatus();
          handlers.onImported();
        }
      } catch (error) {
        resultEl.textContent = `${m.loadError}: ${(error as Error).message}`;
      }
    })();
  });

  referenceSyncBtn.addEventListener("click", () => {
    void (async () => {
      if (!consentInput.checked) {
        resultEl.textContent = r.consentRequired;
        return;
      }
      if (!pendingReferencePackage || lastReferencePreview?.status !== "success") {
        resultEl.textContent = r.previewFirst;
        return;
      }
      resultEl.textContent = r.syncing;
      try {
        const result = await client.referenceSync(
          {
            consentGranted: true,
            sessionId: createConsentSessionId(),
            sourceLabel: pendingReferenceSourceLabel || undefined,
            package: pendingReferencePackage,
          },
          selectedPackId(),
        );
        resultEl.textContent = result.skipped_unchanged
          ? `${r.unchanged}\n${JSON.stringify(result, null, 2)}`
          : JSON.stringify(result, null, 2);
        if (result.status === "success") {
          await refreshSubscriptionStatus();
          handlers.onImported();
        }
      } catch (error) {
        resultEl.textContent = `${r.loadError}: ${(error as Error).message}`;
      }
    })();
  });

  referenceSyncUrlBtn.addEventListener("click", () => {
    void (async () => {
      if (!consentInput.checked) {
        resultEl.textContent = r.consentRequired;
        return;
      }
      const url = referenceUrlInput.value.trim();
      if (!url) {
        resultEl.textContent = r.selectSource;
        return;
      }
      resultEl.textContent = r.syncing;
      try {
        const result = await client.referenceSync(
          {
            consentGranted: true,
            sessionId: createConsentSessionId(),
            url,
            saveSubscriptionUrl: true,
          },
          selectedPackId(),
        );
        resultEl.textContent = result.skipped_unchanged
          ? `${r.unchanged}\n${JSON.stringify(result, null, 2)}`
          : JSON.stringify(result, null, 2);
        if (result.status === "success") {
          await refreshSubscriptionStatus();
          handlers.onImported();
        }
      } catch (error) {
        resultEl.textContent = `${r.loadError}: ${(error as Error).message}`;
      }
    })();
  });

  deviceImportBtn.addEventListener("click", () => {
    void (async () => {
      if (!consentInput.checked) {
        resultEl.textContent = d.consentRequired;
        return;
      }
      if (lastDevicePreview?.status !== "success" || !lastDevicePreview.sql_statements?.length) {
        resultEl.textContent = d.previewFirst;
        return;
      }
      resultEl.textContent = d.importing;
      try {
        const hint = deviceHint();
        const result = await client.deviceImport(
          {
            consentGranted: true,
            sessionId: createConsentSessionId(),
            sourceLabel: pendingDeviceSourceLabel || pendingDeviceUrl || undefined,
            package: pendingDevicePackage ?? undefined,
            url: pendingDeviceUrl || undefined,
            deviceHint: hint,
            sql_statements: lastDevicePreview.sql_statements,
            sql_hash: lastDevicePreview.sql_hash ?? "",
          },
          selectedPackId(),
        );
        resultEl.textContent = JSON.stringify(result, null, 2);
        if (result.status === "success") {
          resetPending();
          consentInput.checked = false;
          await refreshSubscriptionStatus();
          handlers.onImported();
        }
        syncActionEnabled();
      } catch (error) {
        resultEl.textContent = `${m.loadError}: ${(error as Error).message}`;
      }
    })();
  });

  bundledBtn.addEventListener("click", () => {
    void (async () => {
      if (!consentInput.checked) {
        resultEl.textContent =
          subscriptionType === "pharma-compliance"
            ? m.consentRequired
            : subscriptionType === "nrdl-reference"
              ? r.consentRequired
              : d.consentRequired;
        return;
      }
      if (subscriptionType === "device-data") {
        return;
      }
      resultEl.textContent = subscriptionType === "pharma-compliance" ? m.importing : r.syncing;
      try {
        if (subscriptionType === "pharma-compliance") {
          const result = await client.complianceImportBundled(
            {
              consentGranted: true,
              sessionId: createConsentSessionId(),
            },
            selectedPackId(),
          );
          resultEl.textContent = JSON.stringify(result, null, 2);
          if (result.status === "success") {
            resetPending();
            consentInput.checked = false;
            await refreshSubscriptionStatus();
            handlers.onImported();
          }
        } else {
          const result = await client.referenceSyncBundled(
            {
              consentGranted: true,
              sessionId: createConsentSessionId(),
            },
            selectedPackId(),
          );
          resultEl.textContent = result.skipped_unchanged
            ? `${r.unchanged}\n${JSON.stringify(result, null, 2)}`
            : JSON.stringify(result, null, 2);
          if (result.status === "success") {
            resetPending();
            consentInput.checked = false;
            await refreshSubscriptionStatus();
            handlers.onImported();
          }
        }
        syncActionEnabled();
      } catch (error) {
        resultEl.textContent = `${m.loadError}: ${(error as Error).message}`;
      }
    })();
  });

  syncMethodOptions();
  syncSubscriptionUi();

  return {
    async refresh() {
      await agentBar.refresh();
      await refreshSubscriptionStatus();
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
