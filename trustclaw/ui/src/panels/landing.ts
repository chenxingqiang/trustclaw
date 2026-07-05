// Panel A — Landing & TRA Init.

import {
  computeTraBmi,
  type TraInitRequest,
  TRA_INIT_FORM_DEFAULTS,
  type TrustclawApiClient,
} from "../api.js";
import { msg } from "../i18n/index.js";

export interface LandingHandlers {
  onInitialized(): void;
  onReset(): void;
}

function checkboxField(name: keyof TraInitRequest, label: string, checked = false): string {
  const checkedAttr = checked ? " checked" : "";
  return `<label class="init-form__check"><input name="${name}" type="checkbox"${checkedAttr} /> ${escapeHtml(label)}</label>`;
}

export function renderLanding(
  root: HTMLElement,
  client: TrustclawApiClient,
  handlers: LandingHandlers,
): void {
  const m = msg().panels.landing;
  const d = TRA_INIT_FORM_DEFAULTS;
  root.innerHTML = `
    <section class="panel panel--a" data-panel="landing">
      <header class="panel__header">
        <div class="panel__heading">
          <h2>${escapeHtml(m.title)}</h2>
          <p class="panel__subtitle">${escapeHtml(m.subtitle)}</p>
        </div>
        <span class="tag tag--warn" data-testid="landing-status">${escapeHtml(m.notMounted)}</span>
      </header>
      <div class="panel__body">
        <form class="init-form" data-testid="init-form">
          <fieldset class="history-fieldset">
            <legend>${escapeHtml(m.sectionBasic)}</legend>
            <div class="init-form__grid">
              <label>${escapeHtml(m.patientName)}
                <input name="patientName" type="text" value="${escapeHtml(d.patientName)}" required />
              </label>
              <label>${escapeHtml(m.gender)}
                <select name="gender" required>
                  <option value="男"${d.gender === "男" ? " selected" : ""}>${escapeHtml(m.genderMale)}</option>
                  <option value="女"${d.gender === "女" ? " selected" : ""}>${escapeHtml(m.genderFemale)}</option>
                </select>
              </label>
              <label>${escapeHtml(m.age)}
                <input name="age" type="number" step="1" min="1" max="120" value="${d.age}" required />
              </label>
              <label>${escapeHtml(m.weight)}
                <input name="weight" type="number" step="0.1" value="${d.weight}" required data-bmi-input />
              </label>
              <label>${escapeHtml(m.height)}
                <input name="height" type="number" step="0.1" value="${d.height}" required data-bmi-input />
              </label>
              <label>${escapeHtml(m.bmi)}
                <input name="bmi" type="text" readonly data-testid="bmi-display" value="${computeTraBmi(d.weight, d.height).toFixed(1)}" />
              </label>
              <label>${escapeHtml(m.hba1c)}
                <input name="hba1c" type="number" step="0.1" value="${d.hba1c}" required />
              </label>
            </div>
          </fieldset>
          <fieldset class="history-fieldset">
            <legend>${escapeHtml(m.sectionHighRisk)}</legend>
            <div class="init-form__checks">
              ${checkboxField("isPregnantOrLactating", m.isPregnantOrLactating, d.isPregnantOrLactating)}
              ${checkboxField("hasType2Diabetes", m.hasType2Diabetes, d.hasType2Diabetes)}
              ${checkboxField("thyroidHistory", m.thyroidHistory, d.thyroidHistory)}
              ${checkboxField("pancreatitisHistory", m.pancreatitisHistory, d.pancreatitisHistory)}
              ${checkboxField("cardiovascularRisk", m.cardiovascularRisk, d.cardiovascularRisk)}
              ${checkboxField("gastrointestinalSensitivity", m.gastrointestinalSensitivity, d.gastrointestinalSensitivity)}
            </div>
          </fieldset>
          <fieldset class="history-fieldset">
            <legend>${escapeHtml(m.sectionComorbid)}</legend>
            <div class="init-form__checks">
              ${checkboxField("hasArteriosclerosis", m.hasArteriosclerosis, d.hasArteriosclerosis)}
              ${checkboxField("hasCoronaryHeartDisease", m.hasCoronaryHeartDisease, d.hasCoronaryHeartDisease)}
              ${checkboxField("hasMyocardialInfarction", m.hasMyocardialInfarction, d.hasMyocardialInfarction)}
              ${checkboxField("hasStroke", m.hasStroke, d.hasStroke)}
            </div>
          </fieldset>
          <fieldset class="history-fieldset">
            <legend>${escapeHtml(m.sectionMedHistory)}</legend>
            <div class="init-form__checks">
              ${checkboxField("usedMetforminBadControl", m.usedMetforminBadControl, d.usedMetforminBadControl)}
              ${checkboxField("usedSulfonylureaBadControl", m.usedSulfonylureaBadControl, d.usedSulfonylureaBadControl)}
              ${checkboxField("usedInsulinBadControl", m.usedInsulinBadControl, d.usedInsulinBadControl)}
            </div>
          </fieldset>
          <fieldset class="history-fieldset">
            <legend>${escapeHtml(m.sectionPrescription)}</legend>
            <div class="init-form__grid init-form__grid--prescription">
              ${checkboxField("isFirstPrescription", m.isFirstPrescription, d.isFirstPrescription)}
              ${checkboxField("isSpecialistPhysician", m.isSpecialistPhysician, d.isSpecialistPhysician)}
              <label>${escapeHtml(m.institutionLevel)}
                <select name="institutionLevel">
                  <option value="1"${d.institutionLevel === 1 ? " selected" : ""}>${escapeHtml(m.institutionLevel1)}</option>
                  <option value="2"${d.institutionLevel === 2 ? " selected" : ""}>${escapeHtml(m.institutionLevel2)}</option>
                  <option value="3"${d.institutionLevel === 3 ? " selected" : ""}>${escapeHtml(m.institutionLevel3)}</option>
                </select>
              </label>
            </div>
          </fieldset>
          <div class="actions">
            <button type="submit" class="btn-primary">${escapeHtml(m.initBtn)}</button>
            <button type="button" data-action="reset">${escapeHtml(m.resetBtn)}</button>
          </div>
          <pre data-testid="landing-result" class="result"></pre>
        </form>
      </div>
    </section>
  `;

  const statusEl = root.querySelector<HTMLElement>('[data-testid="landing-status"]')!;
  const resultEl = root.querySelector<HTMLElement>('[data-testid="landing-result"]')!;
  const form = root.querySelector<HTMLFormElement>('[data-testid="init-form"]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-action="reset"]')!;
  const bmiDisplay = root.querySelector<HTMLInputElement>('[data-testid="bmi-display"]')!;

  function refreshBmi(): void {
    const weightEl = form.elements.namedItem("weight") as HTMLInputElement;
    const heightEl = form.elements.namedItem("height") as HTMLInputElement;
    const w = Number(weightEl.value);
    const h = Number(heightEl.value);
    if (Number.isFinite(w) && Number.isFinite(h) && h > 0) {
      bmiDisplay.value = computeTraBmi(w, h).toFixed(1);
    }
  }

  for (const input of form.querySelectorAll<HTMLInputElement>("[data-bmi-input]")) {
    input.addEventListener("input", refreshBmi);
  }

  function setMounted(mounted: boolean): void {
    statusEl.textContent = mounted ? m.mounted : m.notMounted;
    statusEl.classList.toggle("tag--ok", mounted);
    statusEl.classList.toggle("tag--warn", !mounted);
  }

  void client.status().then((s) => {
    if (s.mounted) {
      setMounted(true);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const body: TraInitRequest = {
      patientName: String(data.get("patientName") ?? d.patientName).trim(),
      gender: String(data.get("gender")) === "女" ? "女" : "男",
      age: Number(data.get("age")),
      weight: Number(data.get("weight")),
      height: Number(data.get("height")),
      bmi: Number(bmiDisplay.value),
      hba1c: Number(data.get("hba1c")),
      isPregnantOrLactating: Boolean(data.get("isPregnantOrLactating")),
      hasType2Diabetes: Boolean(data.get("hasType2Diabetes")),
      thyroidHistory: Boolean(data.get("thyroidHistory")),
      pancreatitisHistory: Boolean(data.get("pancreatitisHistory")),
      cardiovascularRisk: Boolean(data.get("cardiovascularRisk")),
      gastrointestinalSensitivity: Boolean(data.get("gastrointestinalSensitivity")),
      hasArteriosclerosis: Boolean(data.get("hasArteriosclerosis")),
      hasCoronaryHeartDisease: Boolean(data.get("hasCoronaryHeartDisease")),
      hasMyocardialInfarction: Boolean(data.get("hasMyocardialInfarction")),
      hasStroke: Boolean(data.get("hasStroke")),
      usedMetforminBadControl: Boolean(data.get("usedMetforminBadControl")),
      usedSulfonylureaBadControl: Boolean(data.get("usedSulfonylureaBadControl")),
      usedInsulinBadControl: Boolean(data.get("usedInsulinBadControl")),
      isFirstPrescription: Boolean(data.get("isFirstPrescription")),
      institutionLevel: Number(data.get("institutionLevel") ?? d.institutionLevel),
      isSpecialistPhysician: Boolean(data.get("isSpecialistPhysician")),
    };
    resultEl.textContent = m.mounting;
    try {
      const response = await client.init(body);
      resultEl.textContent = JSON.stringify(response, null, 2);
      if (response.status === "success") {
        setMounted(true);
        handlers.onInitialized();
      } else {
        setMounted(false);
        resultEl.textContent = `${m.initFailed}: ${response.message}\n${resultEl.textContent}`;
      }
    } catch (error) {
      setMounted(false);
      resultEl.textContent = `${msg().panels.browser.loadError}: ${(error as Error).message}`;
    }
  });

  resetBtn.addEventListener("click", async () => {
    resultEl.textContent = m.resetting;
    try {
      const response = await client.reset();
      resultEl.textContent = JSON.stringify(response, null, 2);
      setMounted(false);
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
