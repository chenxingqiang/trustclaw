import { describe, expect, it } from "vitest";
import type { PtdsTableCatalogRow, PtdsTableLineage } from "../api.js";
import { buildLineageFlowSteps } from "./browser-lineage-flow.js";
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

  it("builds ordered lineage flow steps", () => {
    const lineage: PtdsTableLineage = {
      table: "nrdl_payment_rules",
      kind: "subscribed",
      provenance_fields: [],
      nodes: [
        { id: "panel:Panel_F_NRDL_sync", role: "panel", label: "Panel F NRDL sync" },
        { id: "table:nrdl_drug_registry", role: "table", label: "nrdl_drug_registry" },
        { id: "table:nrdl_payment_rules", role: "table", label: "nrdl_payment_rules" },
        {
          id: "table:v_glp1_nrdl_check_snapshot",
          role: "table",
          label: "v_glp1_nrdl_check_snapshot",
        },
      ],
      edges: [
        { from: "panel:Panel_F_NRDL_sync", to: "table:nrdl_payment_rules", label: "upstream" },
        { from: "table:nrdl_drug_registry", to: "table:nrdl_payment_rules", label: "upstream" },
        {
          from: "table:nrdl_payment_rules",
          to: "table:v_glp1_nrdl_check_snapshot",
          label: "downstream",
        },
      ],
    };
    expect(buildLineageFlowSteps(lineage)).toEqual([
      "Panel F NRDL sync",
      "nrdl_drug_registry",
      "nrdl_payment_rules",
      "v_glp1_nrdl_check_snapshot",
    ]);
  });
});
