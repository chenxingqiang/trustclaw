import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTraSchemaSnippet } from "./schema-context.js";

const DEFAULT_PROMPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../agents/glp1/prompts/text2sql.v1.md",
);

let cachedDefaultTemplate: string | undefined;

export function loadDefaultText2SqlPromptTemplate(): string {
  if (cachedDefaultTemplate) {
    return cachedDefaultTemplate;
  }
  cachedDefaultTemplate = readFileSync(DEFAULT_PROMPT_PATH, "utf8");
  return cachedDefaultTemplate;
}

export function buildText2SqlPrompt(params: {
  userQuery: string;
  databaseSchema?: string;
  promptTemplate?: string;
}): string {
  const schema = params.databaseSchema?.trim() || loadTraSchemaSnippet();
  const template = params.promptTemplate?.trim() || loadDefaultText2SqlPromptTemplate();
  return template
    .replace("{{DATABASE_SCHEMA}}", schema)
    .replace("{{USER_QUERY}}", params.userQuery.trim());
}
