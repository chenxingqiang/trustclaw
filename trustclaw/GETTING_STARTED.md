# TrustClaw — Getting Started

TrustClaw runs **on OpenClaw Gateway** with the `trustclaw-ptds` plugin. Product UX is **TrustClaw-first**: Control UI opens **PTDS Console** by default; OpenClaw Chat and operator tools remain in the sidebar.

## Quick start (development)

```bash
pnpm install --config.minimumReleaseAge=0
pnpm trustclaw:setup          # enable plugins.entries.trustclaw-ptds (default + dev profiles)
pnpm trustclaw:dev            # gateway :19001 + Vite UI :5174
```

Open either:

| URL                                 | Experience                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `http://127.0.0.1:19001/`           | OpenClaw Control UI → **PTDS Console** (native chat center, collapsible A/B/D/E side rails) |
| `http://127.0.0.1:5174/trustclaw/`  | Standalone PTDS Runtime Console (dev, hot reload; center chat iframe to gateway `/chat`)    |
| `http://127.0.0.1:18789/`           | Production gateway Control UI (same PTDS workbench after setup)                             |
| `http://127.0.0.1:18789/trustclaw/` | Production-style bundled console (after `pnpm trustclaw:ui:build`)                          |

Set `OPENAI_API_KEY` for Text2SQL in chat.

## PTDS Console layout

Control UI **PTDS Console** tab mirrors the OpenClaw chat page:

- **Center (C)** — OpenClaw native Chat (sessions, tools, streaming)
- **Left rail (A + B)** — PTDS init + data browser (`/trustclaw/?embed=left`)
- **Right rail (D + E)** — runtime audit + evidence ledger (`/trustclaw/?embed=right`)

Side rails collapse like Control UI workspace rails. Chat’s internal workspace rail stays collapsed on the PTDS tab to avoid a triple-column right edge.

## Language (i18n)

TrustClaw console shares OpenClaw's locale storage key **`openclaw.i18n.locale`**:

| Where you switch                     | Effect                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Control UI → Appearance → Language   | PTDS iframe rails update via `storage` + `postMessage`                 |
| PTDS console topbar language select  | Updates console + persists same key (Control UI picks it up on reload) |
| URL `?locale=zh-CN` on `/trustclaw/` | Initial locale for standalone console                                  |

Supported console bundles: **English (`en`)** and **简体中文 (`zh-CN`)**; `zh-TW` maps to `zh-CN`.

## Demo flow (frozen V1)

1. **A · PTDS 初始化区** — `POST /api/ptds/init`
2. **B · 数据浏览器** — browse local SQLite tables
3. **C · 可信问答** — OpenClaw Chat calls `trustclaw_ptds_query`; audit/ledger rails refresh from tool Runtime Context
4. **D · 运行时审计** — pipeline stages from Runtime Context
5. **E · 凭证账本** — receipt placeholder (Task 401)

## Architecture (TrustClaw × OpenClaw)

```
OpenClaw Gateway (:19001 dev, :18789 prod)
  ├── Control UI (/)           → default tab: PTDS Console (native chat + side rails)
  ├── /trustclaw/*           → TrustClaw demo SPA (plugin static; embed=left|right)
  └── /api/ptds/*, /api/agent/chat → PTDS plugin APIs
```

Personal data stays in `~/.openclaw/state/local_ptds.db`. See `OPENCLAW_REUSE.md` for inherit/extend/build map.

## Production-style run

```bash
pnpm trustclaw:setup
pnpm trustclaw:ui:build
pnpm openclaw gateway run
# → http://127.0.0.1:18789/  (PTDS Console tab)
```

## Branding note (D13)

- **Product brand:** TrustClaw
- **CLI / package:** still `openclaw` during V1
- **Mac DMG:** upstream OpenClaw app; TrustClaw value is Gateway plugin + console UI
