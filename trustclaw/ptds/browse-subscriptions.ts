import { getActiveComplianceStandard } from "./compliance-import.js";
import { openPtdsDatabase } from "./db.js";
import { resolvePtdsDbPath, type PtdsPathOverrides } from "./paths.js";
import { getReferenceSyncState } from "./reference-import.js";
import { PTDS_TABLE_CATALOG, type PtdsSubscriptionType } from "./table-catalog.js";

export type BrowseSubscriptionQuickTable = {
  table: string;
  kind: string;
  subscription_type?: PtdsSubscriptionType;
  label_en: string;
  label_zh: string;
};

export type BrowseSubscriptionSnapshot = {
  pharma: {
    active: boolean;
    standard_id?: string;
    publisher?: string;
    ruleset_hash?: string;
  };
  nrdl: {
    synced: boolean;
    version_id?: string;
    package_hash?: string;
    drug_count: number;
    rule_count: number;
  };
  quick_tables: BrowseSubscriptionQuickTable[];
};

function countTableRows(db: ReturnType<typeof openPtdsDatabase>, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count;
}

export function getBrowseSubscriptionSnapshot(
  dbPathOrOverrides?: string | PtdsPathOverrides,
  env: NodeJS.ProcessEnv = process.env,
): BrowseSubscriptionSnapshot {
  const dbPath =
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? resolvePtdsDbPath(
          typeof dbPathOrOverrides === "string" ? { dbPath: dbPathOrOverrides } : {},
          env,
        )
      : resolvePtdsDbPath(dbPathOrOverrides, env);
  const db = openPtdsDatabase(dbPath);
  try {
    const activeStandard = getActiveComplianceStandard(db);
    const syncState = getReferenceSyncState(db);

    let drugCount = 0;
    let ruleCount = 0;
    try {
      drugCount = countTableRows(db, "nrdl_drug_registry");
      ruleCount = countTableRows(db, "nrdl_payment_rules");
    } catch {
      // Reference tables may be absent before first Panel F sync.
    }

    const quickTables: BrowseSubscriptionQuickTable[] = [];
    for (const [table, entry] of Object.entries(PTDS_TABLE_CATALOG)) {
      if (entry.kind === "subscribed" && entry.subscription_panel === "F") {
        quickTables.push({
          table,
          kind: entry.kind,
          subscription_type: entry.subscription_type,
          label_en: entry.label.en,
          label_zh: entry.label["zh-CN"],
        });
      }
    }

    return {
      pharma: activeStandard
        ? {
            active: true,
            standard_id: activeStandard.standard_id,
            publisher: activeStandard.publisher,
            ruleset_hash: activeStandard.ruleset_hash,
          }
        : { active: false },
      nrdl: {
        synced: Boolean(syncState?.version_id),
        version_id: syncState?.version_id ?? undefined,
        package_hash: syncState?.package_hash ?? undefined,
        drug_count: drugCount,
        rule_count: ruleCount,
      },
      quick_tables: quickTables,
    };
  } finally {
    db.close();
  }
}
