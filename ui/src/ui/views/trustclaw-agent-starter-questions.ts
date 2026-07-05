// Starter question chips for the active TRA domain agent pack.
import { html, nothing, type TemplateResult } from "lit";
import { i18n, t } from "../../i18n/index.ts";
import type { TrustclawAgentPackSummary } from "../controllers/trustclaw-tra.ts";

export type TrustclawAgentStarterQuestionsParams = {
  packs: TrustclawAgentPackSummary[];
  selectedPackId: string | null;
  onSelect: (text: string) => void;
};

function questionText(question: { "zh-CN": string; en: string }): string {
  return i18n.getLocale() === "zh-CN" ? question["zh-CN"] : question.en;
}

function resolvePack(
  packs: TrustclawAgentPackSummary[],
  selectedPackId: string | null,
): TrustclawAgentPackSummary | undefined {
  if (!selectedPackId) {
    return undefined;
  }
  return packs.find((pack) => pack.id === selectedPackId);
}

export function renderTrustclawAgentStarterQuestions(
  params: TrustclawAgentStarterQuestionsParams,
): TemplateResult {
  const pack = resolvePack(params.packs, params.selectedPackId);
  const questions = pack?.starterQuestions;
  if (!questions?.length) {
    return nothing;
  }

  return html`<div
    class="trustclaw-tra-starter-questions"
    aria-label=${t("traPanel.starterQuestionsTitle")}
  >
    <span class="trustclaw-tra-starter-questions__label"
      >${t("traPanel.starterQuestionsTitle")}</span
    >
    <div class="trustclaw-tra-starter-questions__chips" role="list">
      ${questions.map(
        (question, index) => html`<button
          type="button"
          class="trustclaw-tra-starter-questions__chip"
          role="listitem"
          title=${questionText(question)}
          @click=${() => {
            params.onSelect(questionText(question));
          }}
        >
          <span class="trustclaw-tra-starter-questions__chip-index">${index + 1}</span>
          <span class="trustclaw-tra-starter-questions__chip-text">${questionText(question)}</span>
        </button>`,
      )}
    </div>
  </div>`;
}
