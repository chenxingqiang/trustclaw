/** Panel B table taxonomy + static lineage edges (subscription vs personal vs reference). */

export type PtdsTableKind = "personal" | "subscribed" | "reference" | "provenance" | "view";

export type PtdsSubscriptionType = "pharma-compliance" | "nrdl-reference" | "device-data";

export type TableCatalogEntry = {
  kind: PtdsTableKind;
  subscription_type?: PtdsSubscriptionType;
  label: { en: string; "zh-CN": string };
  upstream_tables?: readonly string[];
  downstream_tables?: readonly string[];
  provenance_fields?: readonly string[];
  subscription_panel?: "F";
  audit_step?: string;
};

export const PTDS_TABLE_CATALOG: Record<string, TableCatalogEntry> = {
  user_profile: {
    kind: "personal",
    label: { en: "User profile", "zh-CN": "用户画像" },
    upstream_tables: ["Panel A init"],
    downstream_tables: ["v_glp1_nrdl_check_snapshot"],
  },
  body_anthropometrics: {
    kind: "personal",
    label: { en: "Body metrics", "zh-CN": "体征数据" },
    provenance_fields: ["source_id", "provenance_level"],
    upstream_tables: ["data_source_registry", "Panel A init"],
  },
  lab_test_results: {
    kind: "personal",
    label: { en: "Lab results", "zh-CN": "检验结果" },
    provenance_fields: ["source_id", "provenance_level"],
    upstream_tables: ["data_source_registry", "Panel A init", "device import"],
    downstream_tables: ["v_glp1_nrdl_check_snapshot"],
  },
  clinical_diagnoses: {
    kind: "personal",
    label: { en: "Clinical diagnoses", "zh-CN": "临床诊断" },
    provenance_fields: ["source_id", "provenance_level"],
    upstream_tables: ["data_source_registry", "Panel A init"],
    downstream_tables: ["v_glp1_nrdl_check_snapshot"],
  },
  medication_history: {
    kind: "personal",
    label: { en: "Medication history", "zh-CN": "用药史" },
    provenance_fields: ["source_id", "provenance_level"],
    upstream_tables: ["data_source_registry", "Panel A init"],
    downstream_tables: ["v_glp1_nrdl_check_snapshot"],
  },
  daily_vitals: {
    kind: "personal",
    label: { en: "Daily vitals", "zh-CN": "日常体征" },
    provenance_fields: ["source_id", "provenance_level"],
    upstream_tables: ["data_source_registry", "Chat write / device import"],
  },
  wearable_activity_metrics: {
    kind: "personal",
    subscription_type: "device-data",
    label: { en: "Wearable activity", "zh-CN": "穿戴设备活动" },
    provenance_fields: ["source_id", "provenance_level"],
    upstream_tables: ["data_source_registry", "device_registry", "Panel F device import"],
    subscription_panel: "F",
    audit_step: "DEVICE_IMPORT",
  },
  wearable_sleep_metrics: {
    kind: "personal",
    subscription_type: "device-data",
    label: { en: "Wearable sleep", "zh-CN": "穿戴设备睡眠" },
    provenance_fields: ["source_id", "provenance_level"],
    upstream_tables: ["data_source_registry", "Panel F device import"],
    subscription_panel: "F",
    audit_step: "DEVICE_IMPORT",
  },
  wearable_cardiovascular_metrics: {
    kind: "personal",
    subscription_type: "device-data",
    label: { en: "Wearable cardiovascular", "zh-CN": "穿戴设备心血管" },
    provenance_fields: ["source_id", "provenance_level"],
    upstream_tables: ["data_source_registry", "Panel F device import"],
    subscription_panel: "F",
    audit_step: "DEVICE_IMPORT",
  },
  prescription_context: {
    kind: "personal",
    label: { en: "Prescription context", "zh-CN": "处方上下文" },
    upstream_tables: ["Panel A init"],
  },
  data_source_registry: {
    kind: "provenance",
    label: { en: "Data source registry", "zh-CN": "数据源注册表" },
    downstream_tables: [
      "body_anthropometrics",
      "lab_test_results",
      "clinical_diagnoses",
      "medication_history",
      "wearable_activity_metrics",
    ],
  },
  device_registry: {
    kind: "provenance",
    label: { en: "Device registry", "zh-CN": "设备注册表" },
    upstream_tables: ["Panel F device import"],
    downstream_tables: ["wearable_activity_metrics"],
    subscription_type: "device-data",
    subscription_panel: "F",
    audit_step: "DEVICE_IMPORT",
  },
  medication_compliance_standards: {
    kind: "subscribed",
    subscription_type: "pharma-compliance",
    label: { en: "Compliance standards", "zh-CN": "合规标准包" },
    upstream_tables: ["Panel F pharma import"],
    downstream_tables: ["medication_compliance_ast_rules"],
    subscription_panel: "F",
    audit_step: "COMPLIANCE_IMPORT",
  },
  medication_compliance_ast_rules: {
    kind: "subscribed",
    subscription_type: "pharma-compliance",
    label: { en: "Compliance AST rules", "zh-CN": "合规 AST 规则" },
    upstream_tables: ["medication_compliance_standards"],
    downstream_tables: ["Rule evaluation engine"],
    subscription_panel: "F",
    audit_step: "COMPLIANCE_IMPORT",
  },
  nrdl_drug_registry: {
    kind: "subscribed",
    subscription_type: "nrdl-reference",
    label: { en: "NRDL drug registry", "zh-CN": "NRDL 药品目录" },
    upstream_tables: ["Panel F NRDL sync", "nrdl_reference_sync_state"],
    downstream_tables: ["nrdl_payment_rules"],
    subscription_panel: "F",
    audit_step: "REFERENCE_SYNC",
  },
  nrdl_payment_rules: {
    kind: "subscribed",
    subscription_type: "nrdl-reference",
    label: { en: "NRDL payment rules", "zh-CN": "NRDL 支付规则" },
    upstream_tables: ["nrdl_drug_registry", "Panel F NRDL sync"],
    downstream_tables: ["v_glp1_nrdl_check_snapshot"],
    subscription_panel: "F",
    audit_step: "REFERENCE_SYNC",
  },
  nrdl_reference_sync_state: {
    kind: "subscribed",
    subscription_type: "nrdl-reference",
    label: { en: "NRDL sync state", "zh-CN": "NRDL 订阅同步状态" },
    upstream_tables: ["Panel F NRDL subscription URL / file"],
    downstream_tables: ["nrdl_drug_registry", "nrdl_payment_rules"],
    subscription_panel: "F",
    audit_step: "REFERENCE_SYNC",
  },
  v_glp1_nrdl_check_snapshot: {
    kind: "view",
    label: { en: "GLP-1 NRDL check snapshot", "zh-CN": "GLP-1 NRDL 校验快照" },
    upstream_tables: [
      "user_profile",
      "clinical_diagnoses",
      "medication_history",
      "lab_test_results",
      "nrdl_payment_rules",
    ],
    downstream_tables: ["Rule evaluation engine", "Chat agent decision"],
  },
};

export function getTableCatalogEntry(table: string): TableCatalogEntry | undefined {
  return PTDS_TABLE_CATALOG[table];
}

export function classifyPtdsTable(table: string): PtdsTableKind {
  return PTDS_TABLE_CATALOG[table]?.kind ?? "personal";
}

export function isSubscribedTable(table: string): boolean {
  const entry = PTDS_TABLE_CATALOG[table];
  return entry?.kind === "subscribed" || entry?.subscription_type !== undefined;
}

/** Default Panel B tables (D12 + subscribed reference/compliance). */
export const PTDS_BROWSER_DEFAULT_TABLES = [
  "body_anthropometrics",
  "lab_test_results",
  "clinical_diagnoses",
  "medication_compliance_standards",
  "medication_compliance_ast_rules",
  "nrdl_drug_registry",
  "nrdl_payment_rules",
  "nrdl_reference_sync_state",
  "v_glp1_nrdl_check_snapshot",
] as const;
