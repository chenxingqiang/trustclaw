# TrustClaw PTDS plugin

Enable in `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "trustclaw-ptds": {
        "enabled": true
      }
    }
  }
}
```

Or run `pnpm trustclaw:setup`.

## Dev / demo

```bash
pnpm trustclaw:dev          # gateway + Vite UI
pnpm trustclaw:ui:build     # static assets → served at /trustclaw/
```

Control UI (TrustClaw-first fork) opens **PTDS Console** tab by default; standalone console also at `/trustclaw/`.

Start Gateway:

```bash
pnpm openclaw gateway run
```

## HTTP routes (Task 102+)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/trustclaw/*` | TrustClaw PTDS Runtime Console (built SPA) |
| POST | `/api/ptds/init` | Initialize local PTDS personal data (v1.1 schema mapping) |
| POST | `/api/ptds/reset` | Clear personal PTDS rows |
| GET | `/api/ptds/status` | Mounted status + GLP-1 snapshot |
| GET | `/api/ptds/tables` | List browsable tables |
| GET | `/api/ptds/browse?table=...` | Read-only table preview |
| POST | `/api/agent/chat` | GLP-1 pipeline chat → Runtime Context JSON |

Text2SQL uses `OPENAI_API_KEY` (optional `TRUSTCLAW_TEXT2SQL_MODEL`, default `gpt-4.1-mini`).

Default DB: `$OPENCLAW_STATE_DIR/state/local_ptds.db` (usually `~/.openclaw/state/local_ptds.db`).
