import { TRUSTCLAW_PTDS_QUERY_TOOL } from "../../../trustclaw/runtime/constants.js";

export const TRUSTCLAW_PTDS_AGENT_GUIDANCE = [
  "TrustClaw PTDS is available for GLP-1 and personal health questions backed by the local PTDS database.",
  `For GLP-1 eligibility, semaglutide/liraglutide coverage, HbA1c/BMI/contraindications, or other PTDS-backed health questions, call ${TRUSTCLAW_PTDS_QUERY_TOOL} with the user's question.`,
  "Do not invent vitals or rule outcomes; rely on the tool response and cite its evidence-backed answer.",
].join("\n");
