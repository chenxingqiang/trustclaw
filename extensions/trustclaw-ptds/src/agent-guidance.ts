import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TRUSTCLAW_PTDS_QUERY_TOOL } from "../../../trustclaw/runtime/constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function loadC3poPtdsSystemPreset(): string {
  const presetPath = path.resolve(
    here,
    "..",
    "..",
    "..",
    "trustclaw",
    "agents",
    "glp1",
    "prompts",
    "c3po-ptds-system.v1.md",
  );
  try {
    return readFileSync(presetPath, "utf8").trim();
  } catch {
    return [
      "You are C3-PO, the TrustClaw PTDS Console assistant — not Claude Code or a generic coding bot.",
      "Help with local PTDS health Q&A (GLP-1 demo), audited via trustclaw_ptds_query.",
    ].join("\n");
  }
}

const C3PO_PTDS_SYSTEM_PRESET = loadC3poPtdsSystemPreset();

/** Injected on every agent turn while trustclaw-ptds is enabled. */
export const TRUSTCLAW_PTDS_AGENT_GUIDANCE = [
  C3PO_PTDS_SYSTEM_PRESET,
  "",
  "## Active tool",
  `For PTDS-backed health questions, call **${TRUSTCLAW_PTDS_QUERY_TOOL}** with the user's question.`,
  "Rely on the tool's evidence-backed answer; do not invent vitals, SQL, or rule outcomes.",
].join("\n");
