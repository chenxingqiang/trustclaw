import { appendFileSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { EvidenceReceipt } from "./types.js";

const LEDGER_FILE = "ledger.jsonl";

export function resolveLedgerFilePath(evidenceDir: string): string {
  return path.join(evidenceDir, LEDGER_FILE);
}

export function readEvidenceReceipts(evidenceDir: string): EvidenceReceipt[] {
  const filePath = resolveLedgerFilePath(evidenceDir);
  let raw = "";
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  const receipts: EvidenceReceipt[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      receipts.push(JSON.parse(trimmed) as EvidenceReceipt);
    } catch {
      // Skip malformed lines; verifyChain will fail if chain is broken.
    }
  }
  return receipts;
}

export function readEvidenceChainHead(evidenceDir: string): EvidenceReceipt | null {
  const receipts = readEvidenceReceipts(evidenceDir);
  return receipts.at(-1) ?? null;
}

export function appendEvidenceReceipt(evidenceDir: string, receipt: EvidenceReceipt): void {
  mkdirSync(evidenceDir, { recursive: true });
  appendFileSync(resolveLedgerFilePath(evidenceDir), `${JSON.stringify(receipt)}\n`, "utf8");
}

export function clearEvidenceLedger(evidenceDir: string): void {
  const filePath = resolveLedgerFilePath(evidenceDir);
  try {
    unlinkSync(filePath);
  } catch {
    // Missing ledger is already cleared.
  }
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(filePath, "", "utf8");
}
