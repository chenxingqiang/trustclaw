import { assertReadOnlySelectSql, TraQuerySecurityError } from "../../tra/query.js";
import { extractReferencedTables } from "./extract-tables.js";
import { buildText2SqlPrompt } from "./prompt.js";
import { extractSqlFromLlmOutput } from "./sanitize.js";
import type {
  Text2SqlGenerateInput,
  Text2SqlGenerateOptions,
  Text2SqlGenerateResult,
  Text2SqlHandshake,
} from "./types.js";

function buildHandshake(params: {
  sql: string;
  readOnly: boolean;
  tables: string[];
}): Text2SqlHandshake {
  return {
    source_agent: "Text2SQLAgent",
    target_system: "TRA_SQLite_Engine",
    handshake_payload: {
      sanitized_sql: params.sql,
      read_only_verification: params.readOnly,
      allowed_tables: params.tables,
    },
  };
}

function finalizeSql(rawSql: string): {
  sql: string;
  readOnly: boolean;
  tables: string[];
  securityError?: string;
} {
  const cleaned = extractSqlFromLlmOutput(rawSql);
  if (!cleaned) {
    return { sql: "", readOnly: false, tables: [] };
  }
  try {
    const safeSql = assertReadOnlySelectSql(cleaned);
    return {
      sql: safeSql,
      readOnly: true,
      tables: extractReferencedTables(safeSql),
    };
  } catch (error) {
    const message = error instanceof TraQuerySecurityError ? error.message : String(error);
    return {
      sql: cleaned,
      readOnly: false,
      tables: extractReferencedTables(cleaned),
      securityError: message,
    };
  }
}

export async function generateText2Sql(
  input: Text2SqlGenerateInput,
  options: Text2SqlGenerateOptions,
): Promise<Text2SqlGenerateResult> {
  const started = Date.now();
  const prompt = buildText2SqlPrompt({
    userQuery: input.userQuery,
    databaseSchema: input.databaseSchema,
    promptTemplate: input.promptTemplate,
  });
  const llmRaw = await options.llm(prompt);
  const finalized = finalizeSql(llmRaw);

  return {
    sql: finalized.sql,
    duration_ms: Date.now() - started,
    source: finalized.sql ? "llm" : "empty",
    handshake: buildHandshake({
      sql: finalized.sql,
      readOnly: finalized.readOnly,
      tables: finalized.tables,
    }),
    security_error: finalized.securityError,
  };
}
