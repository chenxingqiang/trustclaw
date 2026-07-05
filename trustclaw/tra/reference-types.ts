import { z } from "zod";

const nrdlDrugRowSchema = z
  .object({
    drug_id: z.string().trim().min(1),
    generic_name: z.string().trim().min(1),
    active_ingredient: z.string().trim().min(1),
    atc_code: z.string().trim().min(1),
    is_negotiated_drug: z.union([z.literal(0), z.literal(1), z.boolean()]).optional(),
    agreement_expiry_date: z.string().trim().min(1).optional(),
  })
  .strict();

const nrdlPaymentRuleRowSchema = z
  .object({
    rule_id: z.string().trim().min(1),
    drug_id: z.string().trim().min(1),
    rule_category: z.enum(["DIAGNOSIS", "PRIOR_MED", "LAB_LIMIT", "SAFETY_LIMIT"]),
    target_key: z.string().trim().min(1),
    comparison_operator: z.string().trim().min(1),
    comparison_value: z.string().trim().min(1),
    alert_message: z.string().trim().min(1),
  })
  .strict();

export const nrdlReferencePackageSchema = z
  .object({
    $schema: z.string().trim().min(1).optional(),
    metadata: z
      .object({
        version_id: z.string().trim().min(1),
        release_date: z.string().trim().min(1),
        publisher: z.string().trim().min(1),
        package_hash: z.string().trim().min(1),
      })
      .strict(),
    drugs: z.array(nrdlDrugRowSchema).min(1),
    payment_rules: z.array(nrdlPaymentRuleRowSchema).min(1),
  })
  .strict()
  .superRefine((pkg, ctx) => {
    const drugIds = new Set(pkg.drugs.map((drug) => drug.drug_id));
    for (const [index, rule] of pkg.payment_rules.entries()) {
      if (!drugIds.has(rule.drug_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `payment_rules[${index}] references unknown drug_id ${rule.drug_id}`,
          path: ["payment_rules", index, "drug_id"],
        });
      }
    }
  });

export type NrdlReferencePackage = z.infer<typeof nrdlReferencePackageSchema>;

export type ReferencePreviewResult = {
  status: "success" | "error";
  message: string;
  metadata?: NrdlReferencePackage["metadata"];
  drug_count?: number;
  rule_count?: number;
  drug_ids?: string[];
  package_hash?: string;
  changed_from_local?: boolean;
};

export type ReferenceSyncRequest = {
  consentGranted: boolean;
  sessionId: string;
  agentPackId: string;
  sourceLabel?: string;
  package?: unknown;
  url?: string;
  saveSubscriptionUrl?: boolean;
};

export type ReferenceSyncResult = {
  status: "success" | "error";
  message: string;
  version_id?: string;
  drugs_synced?: number;
  rules_synced?: number;
  package_hash?: string;
  subscription_url?: string | null;
  skipped_unchanged?: boolean;
};

export type ReferenceSyncStateRow = {
  sync_id: string;
  version_id: string;
  package_hash: string;
  source_label: string | null;
  subscription_url: string | null;
  consent_session_id: string;
  drug_count: number;
  rule_count: number;
  synced_at: string;
};

export type ReferenceStatusResult = {
  status: "success" | "error";
  message?: string;
  local_drug_count?: number;
  local_rule_count?: number;
  last_sync?: ReferenceSyncStateRow | null;
};
