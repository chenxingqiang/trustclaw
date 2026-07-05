import { readFileSync } from "node:fs";
import { TRA_COMPLIANCE_STANDARDS_SQL, TRA_SCHEMA_V11_SQL } from "../../tra/paths.js";

/** Tables/views exposed to Text2SQL for GLP-1 TRA queries. */
export const TEXT2SQL_SCHEMA_OBJECTS = [
  "user_profile",
  "body_anthropometrics",
  "lab_test_results",
  "clinical_diagnoses",
  "medication_history",
  "nrdl_drug_registry",
  "nrdl_payment_rules",
  "v_glp1_nrdl_check_snapshot",
] as const;

function buildObjectPattern(objects: readonly string[]): RegExp {
  const escaped = objects.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(
    `(?:CREATE\\s+(?:TABLE|VIEW)\\s+IF\\s+NOT\\s+EXISTS\\s+|CREATE\\s+(?:TABLE|VIEW)\\s+)(?:${escaped.join("|")})\\b[\\s\\S]*?;`,
    "gi",
  );
}

function extractSchemaObjects(ddl: string, objects: readonly string[]): string {
  if (objects.length === 0) {
    return "";
  }
  const matches = ddl.match(buildObjectPattern(objects)) ?? [];
  return matches.join("\n\n").trim();
}

let cachedSchemaSnippet: string | undefined;

export function loadTraSchemaSnippet(schemaPath: string = TRA_SCHEMA_V11_SQL): string {
  if (cachedSchemaSnippet && schemaPath === TRA_SCHEMA_V11_SQL) {
    return cachedSchemaSnippet;
  }
  const ddl = readFileSync(schemaPath, "utf8");
  const snippet = extractSchemaObjects(ddl, TEXT2SQL_SCHEMA_OBJECTS);
  if (schemaPath === TRA_SCHEMA_V11_SQL) {
    cachedSchemaSnippet = snippet;
  }
  return snippet;
}

export function loadTraSchemaSnippetForObjects(objects: readonly string[]): string {
  const unique = [...new Set(objects.map((value) => value.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return loadTraSchemaSnippet();
  }

  const v11Snippet = extractSchemaObjects(readFileSync(TRA_SCHEMA_V11_SQL, "utf8"), unique);
  const complianceSnippet = extractSchemaObjects(
    readFileSync(TRA_COMPLIANCE_STANDARDS_SQL, "utf8"),
    unique,
  );
  return [v11Snippet, complianceSnippet].filter(Boolean).join("\n\n").trim();
}
