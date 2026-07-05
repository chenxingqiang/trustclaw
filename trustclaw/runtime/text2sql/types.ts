export type Text2SqlGenerateInput = {
  userQuery: string;
  /** Full or subset DDL injected into the prompt. */
  databaseSchema?: string;
  /** Pack-specific prompt template with {{DATABASE_SCHEMA}} and {{USER_QUERY}} placeholders. */
  promptTemplate?: string;
};

export type Text2SqlLlmCaller = (prompt: string) => Promise<string>;

export type Text2SqlGenerateOptions = {
  llm: Text2SqlLlmCaller;
};

export type Text2SqlHandshake = {
  source_agent: "Text2SQLAgent";
  target_system: "TRA_SQLite_Engine";
  handshake_payload: {
    sanitized_sql: string;
    read_only_verification: boolean;
    allowed_tables: string[];
  };
};

export type Text2SqlGenerateResult = {
  sql: string;
  duration_ms: number;
  source: "llm" | "empty";
  handshake: Text2SqlHandshake;
  security_error?: string;
};
