import { describe, expect, it } from "vitest";
import type { PtdsTableCatalogRow } from "../api.js";
import { filterTablesByCategory } from "./browser-table-filter.js";

const catalog: PtdsTableCatalogRow[] = [
  {
    table: "lab_test_results",
    kind: "personal",
    label_en: "Lab",
    label_zh: "检验",
  },
  {
    table: "nrdl_payment_rules",
    kind: "subscribed",
    subscription_type: "nrdl-reference",
    label_en: "NRDL rules",
    label_zh: "NRDL 规则",
  },
];

describe("browser lineage helpers", () => {
  it("filters subscribed tables only", () => {
    const tables = ["lab_test_results", "nrdl_payment_rules"];
    expect(filterTablesByCategory(tables, catalog, "subscribed")).toEqual(["nrdl_payment_rules"]);
    expect(filterTablesByCategory(tables, catalog, "personal")).toEqual(["lab_test_results"]);
    expect(filterTablesByCategory(tables, catalog, "all")).toEqual(tables);
  });
});
