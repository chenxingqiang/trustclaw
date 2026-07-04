import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { commitEvidenceReceipt } from "../../../trustclaw/ledger/index.js";
import { setAgentDomainGrant } from "../../../trustclaw/ptds/agent-domain-grants.js";
import { deriveAgentDomainScopes } from "../../../trustclaw/ptds/agent-domain-scopes.js";
import { bootstrapPtdsDatabase } from "../../../trustclaw/ptds/db.js";
import { initializePtds, resetPtds } from "../../../trustclaw/ptds/init.js";
import { readPrescriptionContext } from "../../../trustclaw/ptds/prescription-context.js";
import { PTDS_INIT_DEFAULTS } from "../../../trustclaw/ptds/types.js";
import { getAgentPackRegistry } from "../../../trustclaw/runtime/agent-pack/index.js";
import { createPtdsLedgerHandler } from "./ledger-routes.js";

function createMockResponse(): { statusCode: number; getBody: () => string } & {
  setHeader: () => void;
  end: (chunk: string) => void;
} {
  const state = { statusCode: 200, body: "" };
  return {
    statusCode: 200,
    setHeader: () => {},
    end(chunk: string) {
      state.body = chunk;
    },
    getBody: () => state.body,
    get statusCode() {
      return state.statusCode;
    },
    set statusCode(value: number) {
      state.statusCode = value;
    },
  } as unknown as ReturnType<typeof createMockResponse>;
}

describe("ledger routes", () => {
  it("GET /api/ptds/ledger returns receipts and verify ok", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-ledger-route-"));
    const auditDir = path.join(dir, "ptds-audit");
    const dbPath = path.join(dir, "local_ptds.db");
    const pack = getAgentPackRegistry().get("glp1-eligibility")!;
    setAgentDomainGrant(pack.id, deriveAgentDomainScopes(pack), { dbPath, auditDir });
    try {
      commitEvidenceReceipt({
        evidenceDir: dir,
        audit_trail_id: "aud_route",
        session_id: "sess",
        agent_pack_id: pack.id,
        content_hash: "d".repeat(64),
      });
      const handler = createPtdsLedgerHandler({ evidenceDir: dir, auditDir, dbPath });
      const res = createMockResponse();
      const handled = await handler(
        { method: "GET", url: `/api/ptds/ledger?agentPackId=${pack.id}` } as never,
        res as never,
      );
      expect(handled).toBe(true);
      const body = JSON.parse(res.getBody()) as {
        receipt_count: number;
        verify: { ok: boolean };
      };
      expect(body.receipt_count).toBe(1);
      expect(body.verify.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("prescription_context init", () => {
  it("persists optional init fields for AST evaluation", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "trustclaw-rx-ctx-"));
    const dbPath = path.join(dir, "local_ptds.db");
    try {
      initializePtds(
        {
          ...PTDS_INIT_DEFAULTS,
          weight: 80,
          height: 170,
          hba1c: 6.5,
          isFirstPrescription: false,
          institutionLevel: 2,
          isSpecialistPhysician: false,
        },
        { dbPath },
      );
      const db = bootstrapPtdsDatabase(dbPath);
      try {
        const row = readPrescriptionContext(db);
        expect(row.is_first_prescription).toBe(0);
        expect(row.institution_level).toBe(2);
        expect(row.is_specialist_physician).toBe(0);
      } finally {
        db.close();
      }
      resetPtds({ dbPath });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
