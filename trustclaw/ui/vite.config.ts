import path from "node:path";
import { fileURLToPath } from "node:url";
import type { UserConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "dist");
const gatewayPort =
  process.env.OPENCLAW_GATEWAY_PORT ?? process.env.TRUSTCLAW_GATEWAY_PORT ?? "19001";
const bakedGatewayUrl =
  process.env.VITE_GATEWAY_URL !== undefined
    ? process.env.VITE_GATEWAY_URL
    : `http://127.0.0.1:${gatewayPort}`;
const gatewayTarget = bakedGatewayUrl || `http://127.0.0.1:${gatewayPort}`;

export default function trustclawUiViteConfig(): UserConfig {
  return {
    root: here,
    base: "/trustclaw/",
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: true,
    },
    server: {
      host: "127.0.0.1",
      port: Number(process.env.TRUSTCLAW_UI_PORT ?? "5174"),
      strictPort: true,
      proxy: {
        "/api": {
          target: gatewayTarget,
          changeOrigin: true,
        },
      },
    },
    define: {
      "import.meta.env.VITE_GATEWAY_URL": JSON.stringify(bakedGatewayUrl),
    },
    preview: {
      port: Number(process.env.TRUSTCLAW_UI_PORT ?? "5174"),
      strictPort: true,
      proxy: {
        "/api": {
          target: gatewayTarget,
          changeOrigin: true,
        },
      },
    },
  };
}
