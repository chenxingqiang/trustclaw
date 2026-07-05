import { TRUSTCLAW_TRA_QUERY_TOOL, TRUSTCLAW_TRA_WRITE_TOOL } from "../constants.js";
import { readPackAsset, type ResolvedAgentPack } from "./load.js";

export function buildAgentPackToolGuidance(pack: ResolvedAgentPack): string {
  const lines = [
    "## Active tools",
    `**Read:** For TRA-backed questions in the **${pack.displayName.en}** domain — call **${pack.tools.read}** with the user's question.`,
  ];
  if (pack.tools.write) {
    lines.push(
      `**Write:** When the user asks to save/update personal measurements allowed for this agent — call **${pack.tools.write}** with a clear natural-language write request. Never create SQLite files in the working directory.`,
    );
  } else {
    lines.push("**Write:** This agent pack does not expose TRA write tools.");
  }
  lines.push(
    "Each tool call triggers **explicit user consent**; never bypass approval.",
    "Rely on tool results; do not invent vitals, SQL, or rule outcomes.",
    "",
    `Agent pack: \`${pack.id}\` v${pack.version}`,
  );
  return lines.join("\n");
}

export function loadAgentPackSystemPrompt(pack: ResolvedAgentPack): string {
  return readPackAsset(pack.packDir, pack.prompts.system);
}

export function buildAgentPackSystemContext(pack: ResolvedAgentPack): string {
  return [loadAgentPackSystemPrompt(pack), "", buildAgentPackToolGuidance(pack)].join("\n");
}

export function packEnablesWriteTool(pack: ResolvedAgentPack): boolean {
  return pack.tools.write === TRUSTCLAW_TRA_WRITE_TOOL;
}

export function packEnablesReadTool(pack: ResolvedAgentPack): boolean {
  return pack.tools.read === TRUSTCLAW_TRA_QUERY_TOOL;
}
