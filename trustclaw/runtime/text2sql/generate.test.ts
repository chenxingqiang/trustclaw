import { describe, expect, it } from "vitest";
import { generateText2Sql } from "./generate.js";
import { buildText2SqlPrompt } from "./prompt.js";
import { extractSqlFromLlmOutput } from "./sanitize.js";
import { loadTraSchemaSnippet } from "./schema-context.js";

const mockLlm = (sql: string) => async () => sql;

describe("trustclaw/runtime/text2sql", () => {
  it("strips markdown fences from LLM output", () => {
    const sql = extractSqlFromLlmOutput(
      "```sql\nSELECT bmi FROM body_anthropometrics LIMIT 1;\n```",
    );
    expect(sql).toBe("SELECT bmi FROM body_anthropometrics LIMIT 1");
    expect(sql).not.toMatch(/```/);
  });

  it('maps "我的BMI是多少" to clean SELECT via LLM Text2SQL path', async () => {
    const result = await generateText2Sql(
      { userQuery: "我的BMI是多少" },
      {
        llm: mockLlm(
          "SELECT bmi, weight_kg, height_m FROM body_anthropometrics ORDER BY recorded_at DESC LIMIT 1",
        ),
      },
    );
    expect(result.source).toBe("llm");
    expect(result.sql).toMatch(/^SELECT\b/i);
    expect(result.sql.toLowerCase()).toContain("body_anthropometrics");
    expect(result.sql.toLowerCase()).toContain("bmi");
    expect(result.sql).not.toMatch(/```/);
    expect(result.handshake.handshake_payload.read_only_verification).toBe(true);
    expect(result.handshake.handshake_payload.allowed_tables).toContain("body_anthropometrics");
  });

  it("builds prompt with schema snippet and user query", () => {
    const prompt = buildText2SqlPrompt({
      userQuery: "我的HbA1c是多少",
      databaseSchema: "CREATE TABLE lab_test_results (test_code TEXT);",
    });
    expect(prompt).toContain("CREATE TABLE lab_test_results");
    expect(prompt).toContain("我的HbA1c是多少");
    expect(prompt).not.toContain("{{USER_QUERY}}");
  });

  it("honors custom prompt templates", () => {
    const prompt = buildText2SqlPrompt({
      userQuery: "list standards",
      databaseSchema: "CREATE TABLE medication_compliance_standards (standard_id TEXT);",
      promptTemplate: "SCHEMA:\n{{DATABASE_SCHEMA}}\nQ:\n{{USER_QUERY}}",
    });
    expect(prompt).toContain("medication_compliance_standards");
    expect(prompt).toContain("list standards");
  });

  it("loads v1.1 schema objects for Text2SQL", () => {
    const schema = loadTraSchemaSnippet();
    expect(schema).toContain("body_anthropometrics");
    expect(schema).toContain("v_glp1_nrdl_check_snapshot");
  });

  it("rejects non-SELECT LLM output in handshake", async () => {
    const result = await generateText2Sql(
      { userQuery: "drop all tables please" },
      { llm: mockLlm("DROP TABLE body_anthropometrics") },
    );
    expect(result.handshake.handshake_payload.read_only_verification).toBe(false);
    expect(result.security_error).toMatch(/Only SELECT/i);
  });

  it("returns empty SQL when LLM output is unrelated to schema", async () => {
    const result = await generateText2Sql({ userQuery: "列出用户姓名" }, { llm: mockLlm("") });
    expect(result.source).toBe("empty");
    expect(result.sql).toBe("");
  });
});
