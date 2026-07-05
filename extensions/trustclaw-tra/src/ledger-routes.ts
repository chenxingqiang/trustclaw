import type { IncomingMessage, ServerResponse } from "node:http";
import { readEvidenceReceipts, verifyEvidenceChain } from "../../../trustclaw/ledger/index.js";
import {
  resolveTrustclawPaths,
  type TrustclawPluginConfig,
} from "../../../trustclaw/tra/config.js";
import { requireAgentDomainGrant } from "./agent-grant-guard.js";
import { methodIs, sendJson } from "./http-utils.js";

export function createTraLedgerHandler(pluginConfig: TrustclawPluginConfig | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!methodIs(req, "GET")) {
      sendJson(res, 405, { status: "error", message: "Method not allowed." });
      return true;
    }

    const guard = requireAgentDomainGrant(req, "panel.ledger", pluginConfig);
    if (!guard.ok) {
      sendJson(res, guard.status, { status: "error", message: guard.message });
      return true;
    }

    const paths = guard.paths;
    const receipts = readEvidenceReceipts(paths.evidenceDir).filter(
      (receipt) => receipt.agent_pack_id === guard.pack.id,
    );
    const verify = verifyEvidenceChain(receipts);
    sendJson(res, 200, {
      status: "success",
      agent_pack_id: guard.pack.id,
      evidence_dir: paths.evidenceDir,
      receipt_count: receipts.length,
      receipts,
      verify,
    });
    return true;
  };
}
