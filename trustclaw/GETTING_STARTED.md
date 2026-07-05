# TrustClaw — Getting Started

TrustClaw runs **on OpenClaw Gateway** with the `trustclaw-ptds` plugin. Product UX is **TrustClaw-first**: Control UI opens **TRA Console** by default; OpenClaw Chat and operator tools remain in the sidebar.

> **TRA** = Trust Runtime for Agent. Legacy API paths still use `/api/ptds/*` (see `DECISIONS.md` D25).

**Product development loops:** driven exclusively by [`AGENTS.md`](./AGENTS.md) (Product loop authority + Infinite Optimization Loop).

## Quick start (development)

Runtime defaults are **TrustClaw-first** (no manual setup required for port/plugin):

- Gateway port **19001** when `gateway.port` is unset (`src/config/trustclaw-product-defaults.ts`)
- Plugin **`trustclaw-ptds`** enabled unless explicitly disabled

```bash
pnpm install --config.minimumReleaseAge=0
pnpm trustclaw:dev            # gateway :19001 + Vite UI :5174
```

Optional — persist port/plugin into config files and sync dev workspace prompts:

```bash
pnpm trustclaw:setup          # writes gateway.port + plugin flag to default/dev profiles
```

Open either:

| URL                                 | Experience                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `http://127.0.0.1:19001/`           | **TrustClaw** — Control UI → **TRA Console** (default tab)                        |
| `http://127.0.0.1:5174/trustclaw/`  | Standalone **TRA Runtime Console** (dev, hot reload; audit panels only — no Chat) |
| `http://127.0.0.1:19001/trustclaw/` | Bundled console (after `pnpm trustclaw:ui:build` + gateway on `:19001`)            |

## Gateway auth (dev)

Dev gateway on `:19001` uses **token auth**. Open Control UI with a tokenized URL (do not paste the gateway token into chat):

```bash
pnpm openclaw dashboard --no-open --dev
```

## Models & API keys (dev profile)

Config file: `~/.openclaw-dev/openclaw.json`. Verify with `pnpm openclaw models status --dev`.

| Purpose           | Model / key                                      | Notes                                                                                                                            |
| ----------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Chat (primary)    | `ollama/qwen2.5:7b`                              | Local Ollama at `http://127.0.0.1:11434`; run `ollama pull qwen2.5:7b`                                                           |
| Chat (fallback)   | `anthropic/claude-sonnet-4-6`                    | Used when Ollama is unreachable                                                                                                  |
| Anthropic proxy   | `~/.claude/settings.json` → `ANTHROPIC_BASE_URL` | Also set via `models.providers.anthropic.baseUrl` and `env.ANTHROPIC_BASE_URL`                                                   |
| Anthropic API key | paste into OpenClaw auth store                   | `pnpm openclaw models auth paste-api-key --provider anthropic --dev` (same value as Claude `ANTHROPIC_AUTH_TOKEN`; never commit) |
| PTDS Text2SQL     | `OPENAI_API_KEY`                                 | Separate from chat models; powers audited SQL pipeline                                                                           |

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

## TRA Console layout

Control UI **TRA Console** tab mirrors the OpenClaw chat page:

- **Center** — OpenClaw native Chat (sessions, tools, streaming)
- **Left rail (A + C + B)** — TRA init + domain agent grants + data browser (`/trustclaw/?embed=left`)
- **Right rail (D + E + F)** — runtime audit + evidence ledger + compliance (`/trustclaw/?embed=right`)

Side rails collapse like Control UI workspace rails. Chat’s internal workspace rail stays collapsed on the TRA tab to avoid a triple-column right edge.

## Language (i18n)

TrustClaw console shares OpenClaw's locale storage key **`openclaw.i18n.locale`**:

| Where you switch                     | Effect                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Control UI → Appearance → Language   | TRA iframe rails update via `storage` + `postMessage`                 |
| TRA console topbar language select  | Updates console + persists same key (Control UI picks it up on reload) |
| URL `?locale=zh-CN` on `/trustclaw/` | Initial locale for standalone console                                  |

Supported console bundles: **English (`en`)** and **简体中文 (`zh-CN`)**; `zh-TW` maps to `zh-CN`.

## Theme

TRA side rails follow OpenClaw Control UI **Appearance → theme** via shared `openclaw.control.settings.v1*` localStorage and `openclaw:theme` postMessage. Embedded panels use the same `data-theme-mode="light"` tokens as the center chat.

## C3-PO system prompt (TRA Console chat)

The **dev** agent (`C3-PO`) uses TrustClaw TRA presets — not the generic Claude Code / debug persona:

- Plugin hook `before_prompt_build` injects `trustclaw/agents/glp1/prompts/c3po-ptds-system.v1.md`
- `pnpm trustclaw:setup` syncs `trustclaw/workspace/dev/{SOUL,IDENTITY,AGENTS}.md` → `~/.openclaw/workspace-dev/`

After setup, **start a new chat session** (or `/new`) so the updated system prompt loads. Ask “What can you do?” — the reply should describe TRA panels A–E and `trustclaw_ptds_query`, not IDE/coding features.

## Multi-agent packs (Phase 3)

`pnpm trustclaw:setup` registers three OpenClaw agents and syncs workspace prompts:

| OpenClaw `agentId`   | Agent pack                 | Workspace template                       |
| -------------------- | -------------------------- | ---------------------------------------- |
| `main` (dev)         | `glp1-eligibility` (C3-PO) | `trustclaw/workspace/dev`                |
| `nrdl-reimburse`     | `nrdl-reimburse`           | `trustclaw/workspace/nrdl-reimburse`     |
| `compliance-auditor` | `compliance-auditor`       | `trustclaw/workspace/compliance-auditor` |

In **TRA Console**, use the **领域 Agent** dropdown above chat to bind a pack per session (`PUT /api/ptds/session/agent-pack`), or switch the OpenClaw agent in the chat sidebar. Restart Gateway after `trustclaw:setup` so new agents appear.

## Operator smoke — platform regression

典型运维路径（非架构 canonical 流程；垂直细节由 Agent Pack 决定）：

1. **A · TRA 初始化区** — `POST /api/ptds/init`
2. **C · 领域 Agent 赋权** — per-pack scopes (`GET/PUT /api/ptds/agent-grants`)
3. **B · 数据浏览器** — browse local SQLite tables
4. **Audited Chat (Control UI)** — pack 工具链（如 `trustclaw_ptds_query`）；审计/账本侧栏随 Runtime Context 刷新
5. **D · 运行时审计** — pipeline stages from Runtime Context
6. **E · 凭证账本** — SHA-256 链式 receipt；Reset 清空 TRA 个人数据 + audit + ledger
7. **F · 合规订阅** — 外部标准 import with consent

### Two-pass manual regression

上线前或重大改动后，**手工跑两遍**以下清单（无 orchestrator）。对照 `AGENTS.md` [生产就绪闸门](AGENTS.md#生产就绪闸门production-readiness)。

**Pass 1 — happy path**

1. `pnpm trustclaw:setup && pnpm trustclaw:dev` → open `http://127.0.0.1:19001/` TRA Console (or `:5174/trustclaw/`).
2. **A** — Initialize with defaults; confirm **处方上下文** fields (first prescription, institution level, specialist).
3. **C** — Grant `glp1-eligibility` scopes (`ptds.chat`, `panel.browse`, etc.) and save.
4. **B** — Browse `user_profile` / `v_glp1_nrdl_check_snapshot`.
5. **Chat** — New chat session; ask a GLP-1 eligibility question; approve `trustclaw_ptds_query` if prompted.
6. **D** — Refresh audit: five pipeline steps + compliance section if import/consent occurred.
7. **E** — Ledger badge **verified**; `block_height` increments after second chat; `previous_evidence_hash` links blocks.
8. **F** (optional) — Import compliance standard with consent; Panel D shows summarized `COMPLIANCE_IMPORT`.

**Pass 2 — reset**

1. **A** — **Reset TRA**; status returns to not mounted.
2. Repeat steps 2–7 from Pass 1 on a **new** chat session.
3. Confirm audit JSONL + `ledger.jsonl` were cleared before re-init (Panel E empty until next chat).

**Automated proof (CI/local):** `extensions/trustclaw-ptds/src/dod-reset-demo.test.ts` — init → 2× chat → reset → re-init → chat with fresh `block_height: 0`.

**Blocking fixes**

| Symptom                                                   | Fix                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `plugin manifest not found: .../dist/extensions/acpx/...` | `pnpm trustclaw:setup` disables `acpx` when dist manifest is absent |
| Gateway ECONNREFUSED on `:19001`                          | Wait for gateway ready log; do not start Vite alone                 |
| Init 400 after route changes                              | Restart `pnpm trustclaw:dev` + hard refresh                         |

## Architecture (TrustClaw × OpenClaw)

```
OpenClaw Gateway (TrustClaw default **:19001**; upstream OpenClaw alone still uses :18789)
  ├── Control UI (/)           → default tab: TRA Console (native chat + side rails)
  ├── /trustclaw/*           → TRA Runtime Console static (plugin serve; embed=left|right)
  └── /api/ptds/*, /api/agent/chat → TRA plugin APIs
```

Personal data stays in `~/.openclaw/state/local_ptds.db`. See `OPENCLAW_REUSE.md` for inherit/extend/build map.

## Production-style run

```bash
pnpm trustclaw:setup
pnpm trustclaw:ui:build
pnpm openclaw gateway run
# → http://127.0.0.1:19001/  (TRA Console tab; requires trustclaw:setup first)
```

## Branding note (D13)

- **Product brand:** TrustClaw
- **CLI / package:** still `openclaw` during V1
- **ARM64 Docker (offline / 内网):** `docker/trustclaw-arm64/` — see that directory `README.md`
- **Mac DMG:** `pnpm trustclaw:mac:dist` → `dist/TrustClaw-<version>.dmg` (menu bar shows **TrustClaw**; internal binary remains OpenClaw)

### ARM64 Docker

```bash
cd docker/trustclaw-arm64
./scripts/build-arm64.sh
cp app.env.example app.env && cp app.env.dev.example app.env.dev
# edit app.env.dev → ANTHROPIC_API_KEY
docker compose up -d
```

- Control UI: `http://127.0.0.1:8080/` (token from `app.env`)
- TRA Runtime Console: `http://127.0.0.1:15174/trustclaw/`
- Offline: `./scripts/save-bundle.sh` → `dist/trustclaw-app-arm64.tar`
- Hub push (VPN): `./scripts/push-dockerhub.sh arm64`

```bash
# Prepare local config + API keys first (copied into DMG at build time)
pnpm trustclaw:setup
pnpm openclaw models auth paste-api-key --provider anthropic   # if not in ~/.claude/settings.json

# Local debug DMG (ad-hoc sign when no Developer ID cert)
ALLOW_ADHOC_SIGNING=1 BUILD_ARCHS=arm64 SKIP_NOTARIZE=1 SKIP_DSYM=1 BUILD_CONFIG=debug \
  pnpm trustclaw:mac:dist
```

Build reads `~/.openclaw/openclaw.json`, `agents/*/agent/auth-profiles.json`, `credentials/`, `.env`, and Claude `~/.claude/settings.json` into the app bundle. **First launch** installs them into `~/.openclaw` (upgrade replaces when bundle version changes). Use `TRUSTCLAW_MAC_CONFIG_DEV=1` to source `~/.openclaw-dev` instead.

### Windows portable zip

```bash
pnpm trustclaw:setup
SKIP_BUILD=1 pnpm trustclaw:win:dist   # after pnpm build; or omit SKIP_BUILD for full rebuild
```

Output: `dist/TrustClaw-<version>-win-x64.zip`

On Windows: unzip → double-click `Start-TrustClaw.cmd` → open `http://127.0.0.1:19001/`. First run installs npm deps (`npm ci --omit=dev`, needs network). Config + keys copy to `%USERPROFILE%\.openclaw`.

Native WinUI tray app (`OpenClawCompanion-Setup-x64.exe`) is upstream OpenClaw; this zip is **TrustClaw Gateway + PTDS + bundled config**.
