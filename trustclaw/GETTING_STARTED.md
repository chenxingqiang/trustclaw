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
| `http://127.0.0.1:19001/`           | **TrustClaw dev** — OpenClaw Control UI → **PTDS Console** (use `:19001`, not `:18789`)   |
| `http://127.0.0.1:5174/trustclaw/`  | Standalone PTDS Runtime Console (dev, hot reload; center chat iframe to gateway `/chat`) |
| `http://127.0.0.1:18789/`           | Default OpenClaw gateway (no TrustClaw dev plugin unless configured separately)            |
| `http://127.0.0.1:18789/trustclaw/` | Production-style bundled console (after `pnpm trustclaw:ui:build`)                         |

## Gateway auth (dev)

Dev gateway on `:19001` uses **token auth**. Open Control UI with a tokenized URL (do not paste the gateway token into chat):

```bash
pnpm openclaw dashboard --no-open --dev
```

## Models & API keys (dev profile)

Config file: `~/.openclaw-dev/openclaw.json`. Verify with `pnpm openclaw models status --dev`.

| Purpose | Model / key | Notes |
| --- | --- | --- |
| Chat (primary) | `ollama/qwen2.5:7b` | Local Ollama at `http://127.0.0.1:11434`; run `ollama pull qwen2.5:7b` |
| Chat (fallback) | `anthropic/claude-sonnet-4-6` | Used when Ollama is unreachable |
| Anthropic proxy | `~/.claude/settings.json` → `ANTHROPIC_BASE_URL` | Also set via `models.providers.anthropic.baseUrl` and `env.ANTHROPIC_BASE_URL` |
| Anthropic API key | paste into OpenClaw auth store | `pnpm openclaw models auth paste-api-key --provider anthropic --dev` (same value as Claude `ANTHROPIC_AUTH_TOKEN`; never commit) |
| PTDS Text2SQL | `OPENAI_API_KEY` | Separate from chat models; powers audited SQL pipeline |

Example setup:

```bash
ollama pull qwen2.5:7b
pnpm openclaw config set models.providers.ollama.baseUrl "http://127.0.0.1:11434" --dev
pnpm openclaw config set env.OLLAMA_API_KEY "ollama-local" --dev
pnpm openclaw models set ollama/qwen2.5:7b --dev
pnpm openclaw models fallbacks add anthropic/claude-sonnet-4-6 --dev
pnpm openclaw models auth paste-api-key --provider anthropic --dev
export OPENAI_API_KEY=...   # for Text2SQL
pnpm openclaw models status --dev
```

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
