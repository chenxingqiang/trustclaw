// Panel A — Landing & PTDS Init.

import type { PtdsInitRequest, TrustclawApiClient } from "../api.js";
import { msg } from "../i18n/index.js";

export interface LandingHandlers {
  onInitialized(): void;
  onReset(): void;
}

export function renderLanding(
  root: HTMLElement,
  client: TrustclawApiClient,
  handlers: LandingHandlers,
): void {
  const m = msg().panels.landing;
  root.innerHTML = `
    <section class="panel" data-panel="landing">
      <header><h2>${escapeHtml(m.title)}</h2><span class="status" data-testid="landing-status">${escapeHtml(m.notMounted)}</span></header>
      <form data-testid="init-form">
        <label>${escapeHtml(m.name)} <input name="name" type="text" value="张三" /></label>
        <label>${escapeHtml(m.weight)} <input name="weight" type="number" step="0.1" value="82" required /></label>
        <label>${escapeHtml(m.height)} <input name="height" type="number" step="0.1" value="170" required /></label>
        <label>${escapeHtml(m.hba1c)} <input name="hba1c" type="number" step="0.1" value="6.8" required /></label>
        <fieldset class="history-fieldset">
          <legend>${escapeHtml(m.historyLegend)}</legend>
          <label><input name="thyroid_cancer_history" type="checkbox" /> ${escapeHtml(m.thyroid)}</label>
          <label><input name="pancreatitis_history" type="checkbox" /> ${escapeHtml(m.pancreatitis)}</label>
          <label><input name="include_t2dm_diagnosis" type="checkbox" checked /> ${escapeHtml(m.t2dm)}</label>
        </fieldset>
        <div class="actions">
          <button type="submit">${escapeHtml(m.initBtn)}</button>
          <button type="button" data-action="reset">${escapeHtml(m.resetBtn)}</button>
        </div>
        <pre data-testid="landing-result" class="result"></pre>
      </form>
    </section>
  `;

  const statusEl = root.querySelector<HTMLElement>('[data-testid="landing-status"]')!;
  const resultEl = root.querySelector<HTMLElement>('[data-testid="landing-result"]')!;
  const form = root.querySelector<HTMLFormElement>('[data-testid="init-form"]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-action="reset"]')!;

  void client.status().then((s) => {
    if (s.mounted) {
      statusEl.textContent = m.mounted;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const body: PtdsInitRequest = {
      weight: Number(data.get("weight")),
      height: Number(data.get("height")),
      hba1c: Number(data.get("hba1c")),
      thyroid_cancer_history: data.get("thyroid_cancer_history") ? 1 : 0,
      pancreatitis_history: data.get("pancreatitis_history") ? 1 : 0,
      include_t2dm_diagnosis: Boolean(data.get("include_t2dm_diagnosis")),
    };
    const name = String(data.get("name") ?? "").trim();
    if (name) {
      body.name = name;
    }
    resultEl.textContent = m.mounting;
    try {
      const response = await client.init(body);
      resultEl.textContent = JSON.stringify(response, null, 2);
      if (response.status === "success") {
        statusEl.textContent = m.mounted;
        handlers.onInitialized();
      }
    } catch (error) {
      resultEl.textContent = `${msg().panels.browser.loadError}: ${(error as Error).message}`;
    }
  });

  resetBtn.addEventListener("click", async () => {
    resultEl.textContent = m.resetting;
    try {
      const response = await client.reset();
      resultEl.textContent = JSON.stringify(response, null, 2);
      statusEl.textContent = m.notMounted;
      handlers.onReset();
    } catch (error) {
      resultEl.textContent = `${msg().panels.browser.loadError}: ${(error as Error).message}`;
    }
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
