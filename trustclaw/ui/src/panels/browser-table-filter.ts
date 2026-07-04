import type { PtdsTableCatalogRow } from "../api.js";

export type BrowserCategory = "all" | "personal" | "subscribed";

export function filterTablesByCategory(
  tables: string[],
  catalog: PtdsTableCatalogRow[] | undefined,
  category: BrowserCategory,
): string[] {
  if (category === "all" || !catalog?.length) {
    return tables;
  }
  const byTable = new Map(catalog.map((row) => [row.table, row]));
  return tables.filter((table) => {
    const row = byTable.get(table);
    if (!row) {
      return category === "personal";
    }
    if (category === "subscribed") {
      return row.kind === "subscribed";
    }
    return row.kind === "personal" || row.kind === "view" || row.kind === "provenance";
  });
}
