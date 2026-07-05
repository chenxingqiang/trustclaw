import { openTraDatabase } from "./db.js";
import { resolveTraDbPath, type TraPathOverrides } from "./paths.js";
import {
  classifyTraTable,
  getTableCatalogEntry,
  type TraSubscriptionType,
  type TraTableKind,
} from "./table-catalog.js";

export type LineageNodeRole = "table" | "source" | "subscription" | "panel" | "engine";

export type LineageNode = {
  id: string;
  role: LineageNodeRole;
  label: string;
  meta?: Record<string, string | number | null>;
};

export type LineageEdge = {
  from: string;
  to: string;
  label?: string;
};

export type TableLineageSnapshot = {
  table: string;
  kind: TraTableKind;
  subscription_type?: TraSubscriptionType;
  provenance_fields: string[];
  nodes: LineageNode[];
  edges: LineageEdge[];
  live?: {
    active_standard_id?: string | null;
    ruleset_hash?: string | null;
    consent_session_id?: string | null;
    reference_version_id?: string | null;
    reference_package_hash?: string | null;
    subscription_url?: string | null;
    source_ids?: Array<{
      source_id: string;
      source_name: string;
      source_category: string;
      reliability_level: number;
      row_count: number;
    }>;
  };
};

function pathId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function addNode(nodes: LineageNode[], seen: Set<string>, node: LineageNode): void {
  if (seen.has(node.id)) {
    return;
  }
  seen.add(node.id);
  nodes.push(node);
}

function addEdge(edges: LineageEdge[], from: string, to: string, label?: string): void {
  edges.push({ from, to, label });
}

function readScalar<T>(
  db: ReturnType<typeof openTraDatabase>,
  sql: string,
  params: unknown[] = [],
): T | undefined {
  const row = db.prepare(sql).get(...params) as T | undefined;
  return row;
}

function readActiveCompliance(db: ReturnType<typeof openTraDatabase>):
  | {
      standard_id: string;
      ruleset_hash: string;
      consent_session_id: string;
    }
  | undefined {
  return readScalar(
    db,
    `SELECT standard_id, ruleset_hash, consent_session_id
     FROM medication_compliance_standards
     WHERE is_active = 1
     ORDER BY imported_at DESC
     LIMIT 1`,
  );
}

function readReferenceSyncState(db: ReturnType<typeof openTraDatabase>):
  | {
      version_id: string;
      package_hash: string;
      subscription_url: string | null;
      consent_session_id: string;
    }
  | undefined {
  return readScalar(
    db,
    `SELECT version_id, package_hash, subscription_url, consent_session_id
     FROM nrdl_reference_sync_state
     WHERE sync_id = 'active'
     LIMIT 1`,
  );
}

function readSourceLineage(
  db: ReturnType<typeof openTraDatabase>,
  table: string,
): TableLineageSnapshot["live"] extends infer L
  ? L extends { source_ids?: infer S }
    ? S
    : never
  : never {
  if (!/^[a-zA-Z0-9_]+$/.test(table)) {
    return [];
  }
  const hasSourceId = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((col) => (col as { name: string }).name === "source_id");
  if (!hasSourceId) {
    return [];
  }
  const rows = db
    .prepare(
      `SELECT r.source_id, r.source_name, r.source_category, r.reliability_level,
              COUNT(*) AS row_count
       FROM ${table} t
       INNER JOIN data_source_registry r ON r.source_id = t.source_id
       WHERE t.source_id IS NOT NULL
       GROUP BY r.source_id, r.source_name, r.source_category, r.reliability_level
       ORDER BY row_count DESC`,
    )
    .all() as Array<{
    source_id: string;
    source_name: string;
    source_category: string;
    reliability_level: number;
    row_count: number;
  }>;
  return rows;
}

export function buildTableLineage(
  table: string,
  dbPathOrOverrides?: string | TraPathOverrides,
): TableLineageSnapshot {
  const catalog = getTableCatalogEntry(table);
  const kind = classifyTraTable(table);
  const nodes: LineageNode[] = [];
  const edges: LineageEdge[] = [];
  const seen = new Set<string>();

  const tableNodeId = `table:${table}`;
  addNode(nodes, seen, {
    id: tableNodeId,
    role: "table",
    label: table,
    meta: catalog ? { kind } : undefined,
  });

  for (const upstream of catalog?.upstream_tables ?? []) {
    const upstreamId =
      upstream.startsWith("Panel ") || upstream.includes(" ")
        ? `panel:${pathId(upstream)}`
        : `table:${upstream}`;
    addNode(nodes, seen, {
      id: upstreamId,
      role: upstream.startsWith("Panel ")
        ? "panel"
        : upstream.includes("engine")
          ? "engine"
          : "table",
      label: upstream,
    });
    addEdge(edges, upstreamId, tableNodeId, "upstream");
  }

  for (const downstream of catalog?.downstream_tables ?? []) {
    const downstreamId =
      downstream.includes("engine") || downstream.includes("Chat")
        ? `engine:${pathId(downstream)}`
        : `table:${downstream}`;
    addNode(nodes, seen, {
      id: downstreamId,
      role: downstream.includes("engine") || downstream.includes("Chat") ? "engine" : "table",
      label: downstream,
    });
    addEdge(edges, tableNodeId, downstreamId, "downstream");
  }

  const dbPath = resolveTraDbPath(
    typeof dbPathOrOverrides === "string" || dbPathOrOverrides === undefined
      ? typeof dbPathOrOverrides === "string"
        ? { dbPath: dbPathOrOverrides }
        : {}
      : dbPathOrOverrides,
  );
  const db = openTraDatabase(dbPath);
  const live: TableLineageSnapshot["live"] = {};

  try {
    if (
      table === "medication_compliance_standards" ||
      table === "medication_compliance_ast_rules"
    ) {
      const active = readActiveCompliance(db);
      if (active) {
        live.active_standard_id = active.standard_id;
        live.ruleset_hash = active.ruleset_hash;
        live.consent_session_id = active.consent_session_id;
        addNode(nodes, seen, {
          id: `subscription:pharma-compliance`,
          role: "subscription",
          label: "Panel F · pharma compliance",
          meta: {
            standard_id: active.standard_id,
            ruleset_hash: active.ruleset_hash,
          },
        });
        addEdge(edges, "subscription:pharma-compliance", tableNodeId, "COMPLIANCE_IMPORT");
      }
    }

    if (
      table === "nrdl_drug_registry" ||
      table === "nrdl_payment_rules" ||
      table === "nrdl_reference_sync_state"
    ) {
      const sync = readReferenceSyncState(db);
      if (sync) {
        live.reference_version_id = sync.version_id;
        live.reference_package_hash = sync.package_hash;
        live.subscription_url = sync.subscription_url;
        live.consent_session_id = sync.consent_session_id;
        addNode(nodes, seen, {
          id: "subscription:nrdl-reference",
          role: "subscription",
          label: "Panel F · NRDL reference",
          meta: {
            version_id: sync.version_id,
            package_hash: sync.package_hash,
          },
        });
        addEdge(edges, "subscription:nrdl-reference", tableNodeId, "REFERENCE_SYNC");
      }
    }

    const sourceIds = readSourceLineage(db, table);
    if (sourceIds.length > 0) {
      live.source_ids = sourceIds;
      for (const source of sourceIds) {
        const sourceNodeId = `source:${source.source_id}`;
        addNode(nodes, seen, {
          id: sourceNodeId,
          role: "source",
          label: source.source_name,
          meta: {
            source_id: source.source_id,
            category: source.source_category,
            reliability_level: source.reliability_level,
            row_count: source.row_count,
          },
        });
        addEdge(edges, sourceNodeId, tableNodeId, "provenance");
      }
    }
  } finally {
    db.close();
  }

  return {
    table,
    kind,
    subscription_type: catalog?.subscription_type,
    provenance_fields: [...(catalog?.provenance_fields ?? [])],
    nodes,
    edges,
    live: Object.keys(live).length > 0 ? live : undefined,
  };
}

export function summarizeTableCatalog(table: string): {
  table: string;
  kind: TraTableKind;
  subscription_type?: TraSubscriptionType;
  label_en: string;
  label_zh: string;
} {
  const catalog = getTableCatalogEntry(table);
  const kind = classifyTraTable(table);
  return {
    table,
    kind,
    subscription_type: catalog?.subscription_type,
    label_en: catalog?.label.en ?? table,
    label_zh: catalog?.label["zh-CN"] ?? table,
  };
}
