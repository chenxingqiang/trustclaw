import { readFileSync } from "node:fs";
import { TRA_SCHEMA_V11_SQL } from "../../tra/paths.js";

/** Personal / wearable tables writable via device import (no NRDL or compliance tables). */
export const DEVICE_IMPORT_ALLOWED_TABLES = [
  "data_source_registry",
  "device_registry",
  "body_anthropometrics",
  "lab_test_results",
  "daily_vitals",
  "wearable_sleep_metrics",
  "wearable_activity_metrics",
  "wearable_sleep_epochs",
] as const;

export type DeviceImportAllowedTable = (typeof DEVICE_IMPORT_ALLOWED_TABLES)[number];

const OBJECT_PATTERN = new RegExp(
  `(?:CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+)(?:${DEVICE_IMPORT_ALLOWED_TABLES.join("|")})\\b[\\s\\S]*?;`,
  "gi",
);

let cachedDeviceSchemaSnippet: string | undefined;

export function loadDeviceImportSchemaSnippet(schemaPath: string = TRA_SCHEMA_V11_SQL): string {
  if (cachedDeviceSchemaSnippet && schemaPath === TRA_SCHEMA_V11_SQL) {
    return cachedDeviceSchemaSnippet;
  }
  const ddl = readFileSync(schemaPath, "utf8");
  const matches = ddl.match(OBJECT_PATTERN) ?? [];
  const snippet = matches.join("\n\n").trim();
  if (schemaPath === TRA_SCHEMA_V11_SQL) {
    cachedDeviceSchemaSnippet = snippet;
  }
  return snippet;
}

export function isDeviceImportAllowedTable(name: string): name is DeviceImportAllowedTable {
  return (DEVICE_IMPORT_ALLOWED_TABLES as readonly string[]).includes(name);
}
