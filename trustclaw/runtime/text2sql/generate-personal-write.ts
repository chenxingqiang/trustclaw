import {
  assertDeviceImportStatements,
  DeviceImportSecurityError,
  extractInsertSqlFromLlmOutput,
  extractInsertTables,
  splitInsertStatements,
} from "./device-write-sanitize.js";
import { loadDeviceImportSchemaSnippet } from "./device-write-schema.js";
import { buildPersonalWriteSqlPrompt } from "./personal-write-prompt.js";
import { loadTraSchemaSnippetForObjects } from "./schema-context.js";

export type PersonalWriteGenerateInput = {
  writeRequest: string;
  profileSnapshot: Record<string, unknown>;
  databaseSchema?: string;
  promptTemplate?: string;
};

export type PersonalWriteGenerateOptions = {
  llm: (prompt: string) => Promise<string>;
};

export type PersonalWriteGenerateResult = {
  statements: string[];
  sql: string;
  duration_ms: number;
  source: "llm" | "empty";
  tables: string[];
  write_verification: boolean;
  security_error?: string;
};

export function resolvePersonalWriteSchemaSnippet(writeTables?: readonly string[]): string {
  if (writeTables && writeTables.length > 0) {
    const snippet = loadTraSchemaSnippetForObjects(writeTables);
    if (snippet.trim()) {
      return snippet;
    }
  }
  return loadDeviceImportSchemaSnippet();
}

export async function generatePersonalWriteSql(
  input: PersonalWriteGenerateInput,
  options: PersonalWriteGenerateOptions,
): Promise<PersonalWriteGenerateResult> {
  const started = Date.now();
  const prompt = buildPersonalWriteSqlPrompt({
    writeRequest: input.writeRequest,
    profileSnapshot: input.profileSnapshot,
    databaseSchema: input.databaseSchema,
    promptTemplate: input.promptTemplate,
  });
  const llmRaw = await options.llm(prompt);
  const cleaned = extractInsertSqlFromLlmOutput(llmRaw);
  if (!cleaned) {
    return {
      statements: [],
      sql: "",
      duration_ms: Date.now() - started,
      source: "empty",
      tables: [],
      write_verification: false,
      security_error: "LLM returned no INSERT SQL for the write request.",
    };
  }

  const statements = splitInsertStatements(cleaned);
  try {
    const verified = assertDeviceImportStatements(statements);
    return {
      statements,
      sql: statements.join(";\n"),
      duration_ms: Date.now() - started,
      source: "llm",
      tables: verified.tables,
      write_verification: true,
    };
  } catch (error) {
    const message = error instanceof DeviceImportSecurityError ? error.message : String(error);
    return {
      statements,
      sql: statements.join(";\n"),
      duration_ms: Date.now() - started,
      source: "llm",
      tables: extractInsertTables(cleaned),
      write_verification: false,
      security_error: message,
    };
  }
}
