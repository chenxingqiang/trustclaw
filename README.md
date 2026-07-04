# TrustClaw — Personal Trusted Data Space Runtime

**TrustClaw** is a local-first runtime where personal health data, AI-ready clinical datasets, and trustworthy agents collaborate under full audit and evidence ledger guarantees.

V1 demo scope: **GLP-1 assessment agent** on a frozen PTDS architecture (init → chat → Text2SQL → rules → decision → audit → ledger → dashboard).

| Principle | Meaning |
| --- | --- |
| 个人数据不出域 | Raw data stays in local SQLite only |
| 凡答必有据 | Every answer cites local data + rules |
| 凡行必审计 | Every pipeline step is logged |
| Agent 与平台解耦 | GLP-1 is the first business agent, not the platform |

**TrustClaw docs**

[Getting started](trustclaw/GETTING_STARTED.md) · [Vision](VISION.md) · [Product plan](trustclaw/PLAN.md) · [Decisions (审核)](trustclaw/DECISIONS.md) · [OpenClaw reuse](trustclaw/OPENCLAW_REUSE.md) · [Product spec](trustclaw/PRODUCT_SPEC.md) · [5-day roadmap](trustclaw/ROADMAP.md) · [Agent loop guide](trustclaw/AGENTS.md) · [Spec source](trustclaw/docs/SPEC-V1-source.md)

## TrustClaw quick start 

```bash
pnpm install
pnpm trustclaw:setup
pnpm trustclaw:dev
```

Open **PTDS Runtime 控制台** at `http://127.0.0.1:5174/trustclaw/` (dev) or Control UI → **PTDS Console** at `http://127.0.0.1:19001/` (dev gateway) / `http://127.0.0.1:18789/` (prod). See [Getting started](trustclaw/GETTING_STARTED.md) for ports and auth.

**Models & keys (dev profile, `~/.openclaw-dev/`)**

| Role | Setting |
| --- | --- |
| Chat primary | `ollama/qwen2.5:7b` (local Ollama at `http://127.0.0.1:11434`) |
| Chat fallback | `anthropic/claude-sonnet-4-6` |
| Anthropic proxy | Same base URL as `~/.claude/settings.json` → `ANTHROPIC_BASE_URL`; import API key with `pnpm openclaw models auth paste-api-key --provider anthropic --dev` |
| PTDS Text2SQL | `OPENAI_API_KEY` (separate from chat models) |
| Control UI auth | Dev gateway uses token auth on `:19001`; open `pnpm openclaw dashboard --no-open --dev` (token in URL — do not paste into chat) |

Quick setup after `pnpm trustclaw:setup`:

```bash
ollama pull qwen2.5:7b
pnpm openclaw config set models.providers.ollama.baseUrl "http://127.0.0.1:11434" --dev
pnpm openclaw config set env.OLLAMA_API_KEY "ollama-local" --dev
pnpm openclaw models set ollama/qwen2.5:7b --dev
pnpm openclaw models fallbacks add anthropic/claude-sonnet-4-6 --dev
# paste Anthropic key when prompted (can match ~/.claude/settings.json ANTHROPIC_AUTH_TOKEN)
pnpm openclaw models auth paste-api-key --provider anthropic --dev
pnpm openclaw models status --dev
```

**Demo APIs (frozen V1)**

- `POST /api/ptds/init` — initialize local personal data space
- `POST /api/agent/chat` — run audited GLP-1 pipeline

Implementation lives under `trustclaw/`. Runtime still uses the OpenClaw Gateway stack during transition (`openclaw` CLI).

---

## Built on OpenClaw

This repository forks [OpenClaw](https://github.com/openclaw/openclaw) — a multi-channel personal AI assistant and Gateway. TrustClaw reuses its agent runtime, SQLite patterns, Gateway, and Control UI shell while adding PTDS-specific systems.

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

[OpenClaw docs](https://docs.openclaw.ai) · [Upstream README](https://github.com/openclaw/openclaw/blob/main/README.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)

Preferred upstream setup: run `openclaw onboard` in your terminal.
Works with npm, pnpm, or bun. Runtime: **Node 24 (recommended) or Node 22.19+**.

## Install (recommended)

Runtime: **Node 24 (recommended) or Node 22.19+**.

```bash
npm install -g openclaw@latest
# or: pnpm add -g openclaw@latest

openclaw onboard --install-daemon
```

OpenClaw Onboard installs the Gateway daemon (launchd/systemd user service) so it stays running.

## Quick start (TL;DR)

Runtime: **Node 24 (recommended) or Node 22.19+**.

Full beginner guide (auth, pairing, channels): [Getting started](https://docs.openclaw.ai/start/getting-started)

Recommended daemon mode:

```bash
openclaw onboard --install-daemon
openclaw gateway status
```

Foreground/debug mode:

```bash
openclaw gateway stop
openclaw gateway --port 18789 --verbose
```

Send a test message or ask the assistant after either startup mode is running:

```bash
# Send a message
openclaw message send --target +1234567890 --message "Hello from OpenClaw"

# Talk to the assistant (optionally deliver back to any connected channel: WhatsApp/Telegram/Slack/Discord/Google Chat/Signal/iMessage/IRC/Microsoft Teams/Matrix/Feishu/LINE/Mattermost/Nextcloud Talk/Nostr/Synology Chat/Tlon/Twitch/Zalo/Zalo Personal/WeChat/QQ/WebChat)
openclaw agent --message "Ship checklist" --thinking high
```

Upgrading? [Updating guide](https://docs.openclaw.ai/install/updating) (and run `openclaw doctor`).

Models config + CLI: [Models](https://docs.openclaw.ai/concepts/models). Auth profile rotation + fallbacks: [Model failover](https://docs.openclaw.ai/concepts/model-failover).

## Security defaults (DM access)

OpenClaw connects to real messaging surfaces. Treat inbound DMs as **untrusted input**.

Full security guide: [Security](https://docs.openclaw.ai/gateway/security).
Before remote exposure, use the [Gateway exposure runbook](https://docs.openclaw.ai/gateway/security/exposure-runbook).

Default behavior on Telegram/WhatsApp/Signal/iMessage/Microsoft Teams/Discord/Google Chat/Slack:

- **DM pairing** (`dmPolicy="pairing"` / `channels.discord.dmPolicy="pairing"` / `channels.slack.dmPolicy="pairing"`; legacy: `channels.discord.dm.policy`, `channels.slack.dm.policy`): unknown senders receive a short pairing code and the bot does not process their message.
- Approve with: `openclaw pairing approve <channel> <code>` (then the sender is added to a local allowlist store).
- Public inbound DMs require an explicit opt-in: set `dmPolicy="open"` and include `"*"` in the channel allowlist (`allowFrom` / `channels.discord.allowFrom` / `channels.slack.allowFrom`; legacy: `channels.discord.dm.allowFrom`, `channels.slack.dm.allowFrom`).

Run `openclaw doctor` to surface risky/misconfigured DM policies.

## Highlights

- **[Local-first Gateway](https://docs.openclaw.ai/gateway)** — single control plane for sessions, channels, tools, and events.
- **[Multi-channel inbox](https://docs.openclaw.ai/channels)** — WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, Zalo Personal, WeChat, QQ, WebChat, macOS, iOS/Android.
- **[Multi-agent routing](https://docs.openclaw.ai/gateway/configuration)** — route inbound channels/accounts/peers to isolated agents (workspaces + per-agent sessions).
- **[Voice Wake](https://docs.openclaw.ai/nodes/voicewake) + [Talk Mode](https://docs.openclaw.ai/nodes/talk)** — wake words on macOS/iOS and continuous voice on Android (ElevenLabs + system TTS fallback).
- **[Live Canvas](https://docs.openclaw.ai/platforms/mac/canvas)** — agent-driven visual workspace with [A2UI](https://docs.openclaw.ai/platforms/mac/canvas#canvas-a2ui).
- **[First-class tools](https://docs.openclaw.ai/tools)** — browser, canvas, nodes, cron, sessions, and Discord/Slack actions.
- **[Companion apps](https://docs.openclaw.ai/platforms)** — Windows Hub, macOS menu bar app, and iOS/Android [nodes](https://docs.openclaw.ai/nodes).
- **[Onboarding](https://docs.openclaw.ai/start/wizard) + [skills](https://docs.openclaw.ai/tools/skills)** — onboarding-driven setup with bundled/managed/workspace skills.

## Security model (important)

- Default: tools run on the host for the `main` session, so the agent has full access when it is just you.
- Group/channel safety: set `agents.defaults.sandbox.mode: "non-main"` to run non-`main` sessions inside sandboxes. Docker is the default sandbox backend; SSH and OpenShell backends are also available.
- Typical sandbox default: allow `bash`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`; deny `browser`, `canvas`, `nodes`, `cron`, `discord`, `gateway`.
- Before exposing anything remotely, read [Security](https://docs.openclaw.ai/gateway/security), [Gateway exposure runbook](https://docs.openclaw.ai/gateway/security/exposure-runbook), [Sandboxing](https://docs.openclaw.ai/gateway/sandboxing), and [Configuration](https://docs.openclaw.ai/gateway/configuration).

## Operator quick refs

- Chat commands: `/status`, `/new`, `/reset`, `/compact`, `/think <level>`, `/verbose on|off`, `/trace on|off`, `/usage off|tokens|full`, `/restart`, `/activation mention|always`
- Session tools: `sessions_list`, `sessions_history`, `sessions_send`
- Skills registry: [ClawHub](https://clawhub.ai)
- Architecture overview: [Architecture](https://docs.openclaw.ai/concepts/architecture)

## Docs by goal

- New here: [Getting started](https://docs.openclaw.ai/start/getting-started), [Onboarding](https://docs.openclaw.ai/start/wizard), [Updating](https://docs.openclaw.ai/install/updating)
- Channel setup: [Channels index](https://docs.openclaw.ai/channels), [WhatsApp](https://docs.openclaw.ai/channels/whatsapp), [Telegram](https://docs.openclaw.ai/channels/telegram), [Discord](https://docs.openclaw.ai/channels/discord), [Slack](https://docs.openclaw.ai/channels/slack)
- Apps + nodes: [Windows Hub](https://docs.openclaw.ai/platforms/windows), [macOS](https://docs.openclaw.ai/platforms/macos), [iOS](https://docs.openclaw.ai/platforms/ios), [Android](https://docs.openclaw.ai/platforms/android), [Nodes](https://docs.openclaw.ai/nodes)
- Config + security: [Configuration](https://docs.openclaw.ai/gateway/configuration), [Security](https://docs.openclaw.ai/gateway/security), [Exposure runbook](https://docs.openclaw.ai/gateway/security/exposure-runbook), [Sandboxing](https://docs.openclaw.ai/gateway/sandboxing)
- Remote + web: [Gateway](https://docs.openclaw.ai/gateway), [Remote access](https://docs.openclaw.ai/gateway/remote), [Tailscale](https://docs.openclaw.ai/gateway/tailscale), [Web surfaces](https://docs.openclaw.ai/web)
- Tools + automation: [Tools](https://docs.openclaw.ai/tools), [Skills](https://docs.openclaw.ai/tools/skills), [Cron jobs](https://docs.openclaw.ai/automation/cron-jobs), [Webhooks](https://docs.openclaw.ai/automation/webhook), [Gmail Pub/Sub](https://docs.openclaw.ai/automation/gmail-pubsub)
- Internals: [Architecture](https://docs.openclaw.ai/concepts/architecture), [Agent](https://docs.openclaw.ai/concepts/agent), [Session model](https://docs.openclaw.ai/concepts/session), [Gateway protocol](https://docs.openclaw.ai/reference/rpc)
- Troubleshooting: [Channel troubleshooting](https://docs.openclaw.ai/channels/troubleshooting), [Logging](https://docs.openclaw.ai/logging), [Docs home](https://docs.openclaw.ai)

## Apps (optional)

The Gateway alone delivers a great experience. All apps are optional and add extra features.

If you plan to build/run companion apps, follow the platform runbooks below.

### macOS (OpenClaw.app) (optional)

- Menu bar control for the Gateway and health.
- Voice Wake + push-to-talk overlay.
- WebChat + debug tools.
- Remote gateway control over SSH.

Note: signed builds required for macOS permissions to stick across rebuilds (see [macOS Permissions](https://docs.openclaw.ai/platforms/mac/permissions)).

### iOS node (optional)

- Pairs as a node over the Gateway WebSocket (device pairing).
- Voice trigger forwarding + Canvas surface.
- Controlled via `openclaw nodes …`.

Runbook: [iOS connect](https://docs.openclaw.ai/platforms/ios).

### Android node (optional)

- Pairs as a WS node via device pairing (`openclaw devices ...`).
- Exposes Connect/Chat/Voice tabs plus Canvas, Camera, Screen capture, and Android device command families.
- Runbook: [Android connect](https://docs.openclaw.ai/platforms/android).

## From source (development)

Use `pnpm` for source checkouts. The repository is a pnpm workspace, and bundled
plugins load from `extensions/*` during development so their package-local
dependencies and your edits are used directly. Plain `npm install` at the repo
root is not a supported source setup.

For the dev loop:

```bash
git clone <this-repo>
cd trustclaw   # or your checkout directory

pnpm install

# First run only (or after resetting local OpenClaw config/workspace)
pnpm openclaw setup

# Optional: prebuild Control UI before first startup
pnpm ui:build

# Dev loop (auto-reload on source/config changes)
pnpm gateway:watch
```

If you need a built `dist/` from the checkout (for Node, packaging, or release validation), run:

```bash
pnpm build
pnpm ui:build
```

`pnpm openclaw setup` writes the local config/workspace needed for `pnpm gateway:watch`. It is safe to re-run, but you normally only need it on first setup or after resetting local state. `pnpm gateway:watch` does not rebuild `dist/control-ui`, so rerun `pnpm ui:build` after `ui/` changes or use `pnpm ui:dev` when iterating on the Control UI. If you want this checkout to run onboarding directly, use `pnpm openclaw onboard --install-daemon`.

Note: `pnpm openclaw ...` runs TypeScript directly (via `tsx`). `pnpm build` produces `dist/` for running via Node / the packaged `openclaw` binary, while `pnpm gateway:watch` rebuilds the runtime on demand during the dev loop.

## Development channels

- **stable**: tagged releases (`vYYYY.M.D` or `vYYYY.M.D-<patch>`), npm dist-tag `latest`.
- **beta**: prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta` (macOS app may be missing).
- **dev**: moving head of `main`, npm dist-tag `dev` (when published).

Switch channels (git + npm): `openclaw update --channel stable|beta|dev`.
Details: [Development channels](https://docs.openclaw.ai/install/development-channels).

## Agent workspace + skills

- Workspace root: `~/.openclaw/workspace` (configurable via `agents.defaults.workspace`).
- Injected prompt files: `AGENTS.md`, `SOUL.md`, `TOOLS.md`.
- Skills: `~/.openclaw/workspace/skills/<skill>/SKILL.md`.

## Configuration

Minimal `~/.openclaw/openclaw.json` (model + defaults):

```json5
{
  agent: {
    model: "<provider>/<model-id>",
  },
}
```

[Full configuration reference (all keys + examples).](https://docs.openclaw.ai/gateway/configuration)


## Upstream (OpenClaw)

TrustClaw builds on [OpenClaw](https://github.com/openclaw/openclaw). Sponsors, star history, Molty branding, and the full contributor wall live in the [upstream README](https://github.com/openclaw/openclaw/blob/main/README.md). OpenClaw docs: [docs.openclaw.ai](https://docs.openclaw.ai).

TrustClaw-specific docs: [Getting started](trustclaw/GETTING_STARTED.md) · [Vision](VISION.md) · [Product plan](trustclaw/PLAN.md).
