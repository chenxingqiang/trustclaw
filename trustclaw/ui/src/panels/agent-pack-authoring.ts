// Panel C2 — Business Agent Pack authoring (Phase 4 validate / save).

import type { AgentPackSummaryRow, TrustclawApiClient } from "../api.js";
import { msg } from "../i18n/index.js";
import {
  buildNewAgentPackDraft,
  formatAgentPackValidationIssues,
  isAgentPackWriteDisabledError,
  packDisplayLabel,
} from "./agent-pack-authoring-format.js";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAgentPackAuthoring(
  root: HTMLElement,
  client: TrustclawApiClient,
): { refresh(): Promise<void> } {
  const m = msg().panels.agentPackAuthoring;
  root.innerHTML = `
    <section class="panel panel--pack-author" data-panel="agent-pack-authoring">
      <header class="panel__header">
        <div class="panel__heading">
          <h2>${escapeHtml(m.title)}</h2>
          <p class="panel__subtitle">${escapeHtml(m.subtitle)}</p>
        </div>
        <span class="tag tag--muted" data-testid="agent-pack-authoring-status">${escapeHtml(m.loading)}</span>
      </header>
      <div class="panel__body">
        <p class="panel-note panel-note--compact">${escapeHtml(m.description)}</p>
        <label>${escapeHtml(m.selectLabel)}
          <select data-testid="agent-pack-authoring-select">
            <option value="">${escapeHtml(m.selectPlaceholder)}</option>
          </select>
        </label>
        <label>${escapeHtml(m.editorLabel)}
          <textarea
            data-testid="agent-pack-authoring-editor"
            rows="12"
            spellcheck="false"
            placeholder="${escapeHtml(m.editorPlaceholder)}"
          ></textarea>
        </label>
        <div class="panel-actions">
          <button type="button" class="btn-inline" data-action="new-draft">${escapeHtml(m.newDraftBtn)}</button>
          <button type="button" class="btn-inline" data-action="load-pack">${escapeHtml(m.loadBtn)}</button>
          <button type="button" class="btn-inline" data-action="validate-pack">${escapeHtml(m.validateBtn)}</button>
          <button type="button" class="btn-inline" data-action="create-pack">${escapeHtml(m.createBtn)}</button>
          <button type="button" class="btn-inline" data-action="save-pack">${escapeHtml(m.saveBtn)}</button>
          <button type="button" class="btn-inline btn-inline--danger" data-action="delete-pack">${escapeHtml(m.deleteBtn)}</button>
        </div>
        <pre class="panel-note panel-note--compact agent-pack-authoring-status" data-testid="agent-pack-authoring-result"></pre>
      </div>
    </section>
  `;

  const statusEl = root.querySelector<HTMLElement>('[data-testid="agent-pack-authoring-status"]')!;
  const selectEl = root.querySelector<HTMLSelectElement>(
    '[data-testid="agent-pack-authoring-select"]',
  )!;
  const editorEl = root.querySelector<HTMLTextAreaElement>(
    '[data-testid="agent-pack-authoring-editor"]',
  )!;
  const resultEl = root.querySelector<HTMLElement>('[data-testid="agent-pack-authoring-result"]')!;
  let packs: AgentPackSummaryRow[] = [];
  let defaultPackId = "";

  function parseEditorManifest(): { ok: true; value: unknown } | { ok: false } {
    try {
      return { ok: true, value: JSON.parse(editorEl.value) };
    } catch {
      setResult(m.invalidJson, "err");
      return { ok: false };
    }
  }

  function readManifestPackId(value: unknown): string {
    if (typeof value !== "object" || value === null || !("id" in value)) {
      return "";
    }
    return String((value as { id: unknown }).id ?? "").trim();
  }

  function resolveTargetPackId(): string {
    const selected = selectEl.value.trim();
    if (selected) {
      return selected;
    }
    try {
      return readManifestPackId(JSON.parse(editorEl.value));
    } catch {
      return "";
    }
  }

  function handlePackWriteError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    if (isAgentPackWriteDisabledError(message)) {
      setResult(m.writeDisabled, "err");
      return true;
    }
    if (message.includes("pack_already_exists") || message.includes("409")) {
      setResult(m.packAlreadyExists, "err");
      return true;
    }
    if (message.includes("default_pack_protected")) {
      setResult(m.defaultPackProtected, "err");
      return true;
    }
    return false;
  }

  function loadNewDraft(): void {
    editorEl.value = JSON.stringify(buildNewAgentPackDraft(), null, 2);
    selectEl.value = "";
    setStatus(m.ready);
    setResult(m.newDraftReady, "muted");
  }

  function setStatus(label: string, tone: "muted" | "ok" | "err" = "muted"): void {
    statusEl.textContent = label;
    statusEl.className = `tag ${tone === "ok" ? "tag--ok" : tone === "err" ? "tag--warn" : "tag--muted"}`;
  }

  function setResult(text: string, tone: "muted" | "ok" | "err" = "muted"): void {
    resultEl.textContent = text;
    resultEl.classList.toggle("agent-pack-authoring-status--ok", tone === "ok");
    resultEl.classList.toggle("agent-pack-authoring-status--err", tone === "err");
  }

  function populateSelect(): void {
    const locale = document.documentElement.lang || "en";
    const current = selectEl.value;
    selectEl.innerHTML = `<option value="">${escapeHtml(m.selectPlaceholder)}</option>${packs
      .map((pack) => {
        const label = `${pack.id} · ${packDisplayLabel(pack, locale)}`;
        return `<option value="${escapeHtml(pack.id)}">${escapeHtml(label)}</option>`;
      })
      .join("")}`;
    if (current && packs.some((pack) => pack.id === current)) {
      selectEl.value = current;
    }
  }

  async function loadSelectedPack(): Promise<void> {
    const packId = selectEl.value.trim();
    if (!packId) {
      setResult(m.selectPackFirst, "err");
      return;
    }
    setStatus(m.loading);
    try {
      const detail = await client.agentPackDetail(packId);
      if (!detail.pack) {
        throw new Error(detail.message ?? m.loadFailed);
      }
      editorEl.value = JSON.stringify(detail.pack, null, 2);
      setStatus(m.ready);
      setResult(m.loadDone.replace("{id}", packId), "ok");
    } catch (error) {
      setStatus(m.error);
      setResult(error instanceof Error ? error.message : String(error), "err");
    }
  }

  async function validateEditor(): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(editorEl.value);
    } catch {
      setResult(m.invalidJson, "err");
      return;
    }
    setStatus(m.validating);
    try {
      const result = await client.validateAgentPack(parsed);
      if (result.ok) {
        setStatus(m.ready);
        setResult(m.validateOk.replace("{id}", String(result.pack.id ?? "")), "ok");
        return;
      }
      setStatus(m.error);
      setResult(formatAgentPackValidationIssues(result.issues), "err");
    } catch (error) {
      setStatus(m.error);
      setResult(error instanceof Error ? error.message : String(error), "err");
    }
  }

  async function saveEditor(): Promise<void> {
    const parsed = parseEditorManifest();
    if (!parsed.ok) {
      return;
    }
    const packId = readManifestPackId(parsed.value);
    if (!packId) {
      setResult(m.missingPackId, "err");
      return;
    }
    setStatus(m.saving);
    try {
      const saved = await client.putAgentPack(packId, parsed.value);
      if (!saved.pack) {
        throw new Error(saved.message ?? m.saveFailed);
      }
      editorEl.value = JSON.stringify(saved.pack, null, 2);
      selectEl.value = packId;
      await refresh();
      setStatus(m.ready);
      setResult(m.saveDone.replace("{id}", packId), "ok");
    } catch (error) {
      setStatus(m.error);
      if (!handlePackWriteError(error)) {
        setResult(error instanceof Error ? error.message : String(error), "err");
      }
    }
  }

  async function createEditor(): Promise<void> {
    const parsed = parseEditorManifest();
    if (!parsed.ok) {
      return;
    }
    const packId = readManifestPackId(parsed.value);
    if (!packId) {
      setResult(m.missingPackId, "err");
      return;
    }
    setStatus(m.creating);
    try {
      const created = await client.createAgentPack(parsed.value);
      if (!created.pack) {
        throw new Error(created.message ?? m.createFailed);
      }
      editorEl.value = JSON.stringify(created.pack, null, 2);
      selectEl.value = packId;
      await refresh();
      setStatus(m.ready);
      setResult(m.createDone.replace("{id}", packId), "ok");
    } catch (error) {
      setStatus(m.error);
      if (!handlePackWriteError(error)) {
        setResult(error instanceof Error ? error.message : String(error), "err");
      }
    }
  }

  async function deleteSelected(): Promise<void> {
    const packId = resolveTargetPackId();
    if (!packId) {
      setResult(m.selectPackOrIdForDelete, "err");
      return;
    }
    if (packId === defaultPackId) {
      setResult(m.defaultPackProtected, "err");
      return;
    }
    if (!window.confirm(m.deleteConfirm.replace("{id}", packId))) {
      return;
    }
    setStatus(m.deleting);
    try {
      const result = await client.deleteAgentPack(packId);
      editorEl.value = "";
      selectEl.value = "";
      await refresh();
      setStatus(m.ready);
      setResult(m.deleteDone.replace("{id}", result.deleted_pack_id ?? packId), "ok");
    } catch (error) {
      setStatus(m.error);
      if (!handlePackWriteError(error)) {
        setResult(error instanceof Error ? error.message : String(error), "err");
      }
    }
  }

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const action = target.getAttribute("data-action");
    if (action === "new-draft") {
      loadNewDraft();
    } else if (action === "load-pack") {
      void loadSelectedPack();
    } else if (action === "validate-pack") {
      void validateEditor();
    } else if (action === "create-pack") {
      void createEditor();
    } else if (action === "save-pack") {
      void saveEditor();
    } else if (action === "delete-pack") {
      void deleteSelected();
    }
  });

  async function refresh(): Promise<void> {
    setStatus(m.loading);
    try {
      const list = await client.agentPacks();
      packs = list.packs ?? [];
      defaultPackId = list.default_pack_id?.trim() ?? "";
      populateSelect();
      setStatus(m.ready);
      setResult(m.listReady.replace("{count}", String(packs.length)), "muted");
    } catch (error) {
      setStatus(m.error);
      setResult(error instanceof Error ? error.message : String(error), "err");
    }
  }

  void refresh();
  return { refresh };
}
