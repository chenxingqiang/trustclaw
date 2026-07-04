// Shared chat audit pipeline model for Panel D visualization.

export type ChatPipelineStepDef = {
  step: string;
  label: string;
  component: string;
  gate: string;
};

export type ChatPipelineStepState = "pending" | "ok" | "blocked" | "fail";

export function chatPipelineStepStates(
  events: Array<{ step: string; status: string }>,
): ChatPipelineStepState[] {
  const byStep = new Map(events.map((e) => [e.step, e.status]));
  return CHAT_PIPELINE_STEP_ORDER.map((step) => {
    const status = byStep.get(step);
    if (!status) {
      return "pending";
    }
    if (status === "SUCCESS") {
      return "ok";
    }
    if (status === "BLOCKED") {
      return "blocked";
    }
    return "fail";
  });
}

export const CHAT_PIPELINE_STEP_ORDER = [
  "TEXT2SQL_GEN",
  "DB_QUERY",
  "RULE_EVAL",
  "AGENT_DECISION",
  "LEDGER_COMMIT",
] as const;

export function renderChatPipelineFlow(
  steps: ChatPipelineStepDef[],
  states: ChatPipelineStepState[],
): string {
  return `<ol class="audit-pipeline" data-testid="audit-pipeline-flow">
    ${steps
      .map((step, index) => {
        const state = states[index] ?? "pending";
        return `<li class="audit-pipeline__step audit-pipeline__step--${state}" data-step="${escapeAttr(step.step)}">
          <span class="audit-pipeline__index">${index + 1}</span>
          <div class="audit-pipeline__body">
            <strong class="audit-pipeline__title">${escapeHtml(step.label)}</strong>
            <code class="audit-pipeline__component">${escapeHtml(step.component)}</code>
            <p class="audit-pipeline__gate">${escapeHtml(step.gate)}</p>
          </div>
        </li>`;
      })
      .join("")}
  </ol>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(input: string): string {
  return escapeHtml(input);
}
