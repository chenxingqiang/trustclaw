import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

export const TRUSTCLAW_UI_BASE_PATH = "/trustclaw";

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function isPathInside(root: string, target: string): boolean {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(target);
  const relative = path.relative(normalizedRoot, normalizedTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** Resolve built SPA assets from plugin dist or repo `trustclaw/ui/dist`. */
export function resolveTrustclawUiRoot(): string | null {
  const pluginDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(pluginDir, "..", "dist", "ui"),
    path.resolve(pluginDir, "..", "..", "..", "trustclaw", "ui", "dist"),
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "index.html"))) {
      return root;
    }
  }
  return null;
}

export function createTrustclawUiHandler(): (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<boolean> {
  const root = resolveTrustclawUiRoot();
  return async (req, res) => {
    const method = (req.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return false;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    let pathname = url.pathname;
    if (pathname === TRUSTCLAW_UI_BASE_PATH) {
      pathname = `${TRUSTCLAW_UI_BASE_PATH}/`;
    }
    if (!pathname.startsWith(`${TRUSTCLAW_UI_BASE_PATH}/`)) {
      return false;
    }

    if (!root) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("TrustClaw UI assets not found. Run `pnpm trustclaw:ui:build`.");
      return true;
    }

    let relativePath = pathname.slice(TRUSTCLAW_UI_BASE_PATH.length).replace(/^\/+/, "");
    if (!relativePath || relativePath.endsWith("/")) {
      relativePath = `${relativePath.replace(/\/+$/, "")}/index.html`.replace(/^\//, "");
    }

    let filePath = path.resolve(root, relativePath);
    if (!isPathInside(root, filePath)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return true;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(root, "index.html");
    }
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end("Not found");
      return true;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME_BY_EXT[ext] ?? "application/octet-stream");
    res.setHeader("Cache-Control", ext === ".html" ? "no-store" : "public, max-age=3600");
    if (method === "HEAD") {
      res.end();
      return true;
    }
    res.end(fs.readFileSync(filePath));
    return true;
  };
}
