import type { IncomingMessage, ServerResponse } from "node:http";

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function readJsonBody(
  req: IncomingMessage,
  maxBytes = 256 * 1024,
): Promise<{ ok: true; body: unknown } | { ok: false; message: string }> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      return { ok: false, message: "Request body too large." };
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) {
    return { ok: true, body: {} };
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return { ok: true, body: {} };
  }
  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, message: "Invalid JSON body." };
  }
}

export function methodIs(req: IncomingMessage, expected: string): boolean {
  return (req.method ?? "GET").toUpperCase() === expected;
}
