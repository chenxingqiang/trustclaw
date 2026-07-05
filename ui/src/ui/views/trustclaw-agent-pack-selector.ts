// Agent pack selector bar for TRA Console Panel C.
import { html, nothing, type TemplateResult } from "lit";
import { i18n, t } from "../../i18n/index.ts";
import type { TrustclawAgentPackSummary } from "../controllers/trustclaw-tra.ts";

export type TrustclawAgentPackSelectorParams = {
  packs: TrustclawAgentPackSummary[];
  selectedPackId: string | null;
  resolvedFrom: "session" | "lock" | "openclaw_agent" | "default" | "request" | null;
  locked: boolean;
  agentPackMismatch: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onSelect: (packId: string) => void;
};

function packLabel(pack: TrustclawAgentPackSummary): string {
  const locale = i18n.getLocale();
  if (locale === "zh-CN") {
    return pack.displayName["zh-CN"];
  }
  return pack.displayName.en;
}

function resolvedFromHint(params: TrustclawAgentPackSelectorParams): string | null {
  if (params.agentPackMismatch) {
    return t("traPanel.agentPackMismatch");
  }
  if (params.locked || params.resolvedFrom === "lock") {
    return t("traPanel.agentPackLocked");
  }
  if (
    !params.resolvedFrom ||
    params.resolvedFrom === "session" ||
    params.resolvedFrom === "request"
  ) {
    return null;
  }
  if (params.resolvedFrom === "openclaw_agent") {
    return t("traPanel.agentPackFromAgent");
  }
  return t("traPanel.agentPackFromDefault");
}

export function renderTrustclawAgentPackSelector(
  params: TrustclawAgentPackSelectorParams,
): TemplateResult {
  const hint = resolvedFromHint(params);
  const disabled = params.loading || params.saving || params.packs.length === 0;

  return html`<div class="trustclaw-tra-agent-pack" aria-label=${t("traPanel.agentPackLabel")}>
    <label class="trustclaw-tra-agent-pack__label" for="trustclaw-tra-agent-pack-select">
      ${t("traPanel.agentPackLabel")}
    </label>
    <select
      id="trustclaw-tra-agent-pack-select"
      class="trustclaw-tra-agent-pack__select"
      ?disabled=${disabled}
      .value=${params.selectedPackId ?? ""}
      @change=${(event: Event) => {
        const value = (event.currentTarget as HTMLSelectElement).value.trim();
        if (value) {
          params.onSelect(value);
        }
      }}
    >
      ${params.packs.length === 0
        ? html`<option value="">${t("traPanel.agentPackLoading")}</option>`
        : params.packs.map(
            (pack) =>
              html`<option value=${pack.id} ?selected=${pack.id === params.selectedPackId}>
                ${packLabel(pack)}
              </option>`,
          )}
    </select>
    ${params.saving
      ? html`<span class="trustclaw-tra-agent-pack__status">${t("traPanel.agentPackSaving")}</span>`
      : hint
        ? html`<span class="trustclaw-tra-agent-pack__hint">${hint}</span>`
        : nothing}
    ${params.error
      ? html`<span class="trustclaw-tra-agent-pack__error" role="status">${params.error}</span>`
      : nothing}
  </div>`;
}
