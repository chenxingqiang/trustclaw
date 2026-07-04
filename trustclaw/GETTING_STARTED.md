# TrustClaw — Getting Started

TrustClaw runs **on OpenClaw Gateway** with the `trustclaw-ptds` plugin. Product UX is **TrustClaw-first**: Control UI opens **PTDS Console** by default; OpenClaw Chat and operator tools remain in the sidebar.

## Quick start (development)

```bash
pnpm install
pnpm trustclaw:setup          # enable plugins.entries.trustclaw-ptds
pnpm trustclaw:dev            # gateway :18789 + Vite UI :5174
```

Open either:

| URL                                 | Experience                                                         |
| ----------------------------------- | ------------------------------------------------------------------ |
| `http://127.0.0.1:5174/trustclaw/`  | Standalone PTDS Runtime Console (dev, hot reload)                  |
| `http://127.0.0.1:18789/`           | OpenClaw Control UI → **PTDS Console** tab (iframe)                |
| `http://127.0.0.1:18789/trustclaw/` | Production-style bundled console (after `pnpm trustclaw:ui:build`) |

Set `OPENAI_API_KEY` for Text2SQL in chat.

## Language (i18n)

TrustClaw console shares OpenClaw's locale storage key **`openclaw.i18n.locale`**:

| Where you switch                     | Effect                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Control UI → Appearance → Language   | PTDS iframe updates via `storage` + `postMessage`                      |
| PTDS console topbar language select  | Updates console + persists same key (Control UI picks it up on reload) |
| URL `?locale=zh-CN` on `/trustclaw/` | Initial locale for standalone console                                  |

Supported console bundles: **English (`en`)** and **简体中文 (`zh-CN`)**; `zh-TW` maps to `zh-CN`.

## Demo flow (frozen V1)

1. **A · PTDS 初始化区** — `POST /api/ptds/init`
2. **B · 数据浏览器** — browse local SQLite tables
3. **C · 可信问答** — `POST /api/agent/chat` → GLP-1 + Evidence
4. **D · 运行时审计** — pipeline stages from Runtime Context
5. **E · 凭证账本** — receipt placeholder (Task 401)

## Architecture (TrustClaw × OpenClaw)

```
OpenClaw Gateway (:18789)
  ├── Control UI (/)           → default tab: PTDS Console
  ├── /trustclaw/*           → TrustClaw demo SPA (plugin static)
  └── /api/ptds/*, /api/agent/chat → PTDS plugin APIs
```

Personal data stays in `~/.openclaw/state/local_ptds.db`. See `OPENCLAW_REUSE.md` for inherit/extend/build map.

## Production-style run

```bash
pnpm trustclaw:setup
pnpm trustclaw:ui:build
pnpm openclaw gateway run
# → http://127.0.0.1:18789/trustclaw/
```

## Branding note (D13)

- **Product brand:** TrustClaw
- **CLI / package:** still `openclaw` during V1
- **Mac DMG:** upstream OpenClaw app; TrustClaw value is Gateway plugin + console UI
