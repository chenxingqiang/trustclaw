// Panel C — Trustworthy Chat.

import type { AgentChatResponse, RuntimeContextResponse, TrustclawApiClient } from "../api.js";
import { isAgentChatError } from "../api.js";
import { msg } from "../i18n/index.js";

export interface ChatHandlers {
  onRuntimeContext(context: RuntimeContextResponse): void;
}

export function renderChat(
  root: HTMLElement,
  client: TrustclawApiClient,
  handlers: ChatHandlers,
): { setSessionId(next: string): void } {
  const m = msg().panels.chat;
  let sessionId = randomSessionId();

  root.innerHTML = `
    <section class="panel" data-panel="chat">
      <header><h2>${escapeHtml(m.title)}</h2><span class="session" data-testid="chat-session"></span></header>
      <form data-testid="chat-form">
        <textarea name="message" required rows="2" placeholder="${escapeHtml(m.placeholder)}"></textarea>
        <button type="submit">${escapeHtml(m.send)}</button>
      </form>
      <div class="chat-log" data-testid="chat-log"></div>
    </section>
  `;

  const sessionEl = root.querySelector<HTMLElement>('[data-testid="chat-session"]')!;
  const log = root.querySelector<HTMLElement>('[data-testid="chat-log"]')!;
  const form = root.querySelector<HTMLFormElement>('[data-testid="chat-form"]')!;
  sessionEl.textContent = sessionId;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const message = String(data.get("message") ?? "").trim();
    if (!message) return;
    appendMessage(log, "user", message);
    (form.elements.namedItem("message") as HTMLTextAreaElement).value = "";

    let response: AgentChatResponse;
    try {
      response = await client.chat({ session_id: sessionId, message });
    } catch (error) {
      appendMessage(log, "error", (error as Error).message);
      return;
    }

    if (isAgentChatError(response)) {
      appendMessage(log, "error", `${response.status}: ${response.message}`);
      return;
    }
    const decision =
      response.pipeline_stages.agent_decision?.response ?? msg().panels.chat.noResponse;
    appendMessage(log, "assistant", decision);
    handlers.onRuntimeContext(response);
  });

  return {
    setSessionId(next: string) {
      sessionId = next;
      sessionEl.textContent = next;
    },
  };
}

function randomSessionId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `sess_${hex}`;
}

function appendMessage(log: HTMLElement, role: "user" | "assistant" | "error", text: string): void {
  const bubble = document.createElement("div");
  bubble.className = `bubble bubble-${role}`;
  bubble.textContent = text;
  log.append(bubble);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
