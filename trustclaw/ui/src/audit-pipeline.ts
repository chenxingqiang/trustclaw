// Shared chat audit pipeline model for Panel D visualization.

export type ChatPipelineStepDef = {
  step: string;
  label: string;
  component: string;
  gate: string;
};

export type ChatPipelineStepState = "pending" | "ok" | "blocked" | "fail";

export const CHAT_PIPELINE_STEP_ORDER = [
  "TEXT2SQL_GEN",
  "DB_QUERY",
  "RULE_EVAL",
  "AGENT_DECISION",
  "LEDGER_COMMIT",
] as const;

/** Pack-declared subset in canonical MCA order; defaults to full five-step chat pipeline. */
export function resolveChatPipelineStepOrder(expectedSteps?: readonly string[]): readonly string[] {
  if (!expectedSteps || expectedSteps.length === 0) {
    return CHAT_PIPELINE_STEP_ORDER;
  }
  const allowed = new Set(expectedSteps);
  return CHAT_PIPELINE_STEP_ORDER.filter((step) => allowed.has(step));
}

export function chatPipelineStepStates(
  events: Array<{ step: string; status: string }>,
  stepOrder: readonly string[] = CHAT_PIPELINE_STEP_ORDER,
): ChatPipelineStepState[] {
  const byStep = new Map(events.map((e) => [e.step, e.status]));
  return stepOrder.map((step) => {
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

export function countSuccessfulChatPipelineSteps(
  events: Array<{ step: string; status: string }>,
  stepOrder: readonly string[],
): number {
  const states = chatPipelineStepStates(events, stepOrder);
  return states.filter((state) => state === "ok").length;
}

export function isChatPipelineComplete(
  events: Array<{ step: string; status: string }>,
  stepOrder: readonly string[],
): boolean {
  if (stepOrder.length === 0) {
    return false;
  }
  const states = chatPipelineStepStates(events, stepOrder);
  return states.length === stepOrder.length && states.every((state) => state === "ok");
}

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
