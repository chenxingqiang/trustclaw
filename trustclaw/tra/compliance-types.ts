import { z } from "zod";

export const complianceAstLeafSchema = z.object({
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export type ComplianceAstLeaf = z.infer<typeof complianceAstLeafSchema>;

export type ComplianceAstNode =
  | ComplianceAstLeaf
  | {
      operator: "AND" | "OR";
      children: ComplianceAstNode[];
    };

export const complianceAstNodeSchema: z.ZodType<ComplianceAstNode> = z.lazy(() =>
  z.union([
    complianceAstLeafSchema,
    z.object({
      operator: z.enum(["AND", "OR"]),
      children: z.array(complianceAstNodeSchema).min(1),
    }),
  ]),
);

export const complianceStandardPackageSchema = z
  .object({
    $schema: z.string().optional(),
    metadata: z.object({
      version_id: z.string().min(1),
      release_date: z.string().min(1),
      publisher: z.string().min(1),
      publisher_signature: z.string().optional(),
      ruleset_hash: z.string().min(1),
    }),
    ast_rules: z
      .array(
        z.object({
          rule_id: z.string().min(1),
          drug_id: z.string().min(1),
          drug_name: z.string().min(1),
          ast_root: complianceAstNodeSchema,
        }),
      )
      .min(1),
  })
  .strict();

export type ComplianceStandardPackage = z.infer<typeof complianceStandardPackageSchema>;

export type MedicationComplianceStandardRow = {
  standard_id: string;
  schema_uri: string | null;
  release_date: string;
  publisher: string;
  publisher_signature: string | null;
  ruleset_hash: string;
  source_file_hash: string;
  source_label: string | null;
  imported_at: string;
  consent_session_id: string;
  is_active: number;
};

export type MedicationComplianceAstRuleRow = {
  rule_id: string;
  standard_id: string;
  drug_id: string;
  drug_name: string;
  ast_root_json: string;
};

export type ComplianceImportRequest = {
  consentGranted: boolean;
  sessionId: string;
  agentPackId: string;
  sourceLabel?: string;
  package: ComplianceStandardPackage;
};

export type ComplianceImportResult = {
  status: "success" | "error";
  message: string;
  standard_id?: string;
  rules_imported?: number;
  drugs_registered?: number;
  source_file_hash?: string;
};

export type CompliancePreviewResult = {
  status: "success" | "error";
  message: string;
  metadata?: ComplianceStandardPackage["metadata"];
  rule_count?: number;
  drug_ids?: string[];
  source_file_hash?: string;
};
