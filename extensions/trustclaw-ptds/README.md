# TrustClaw TRA plugin

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

Control UI (TrustClaw-first fork) opens **TRA Console** tab by default; standalone console also at `/trustclaw/`.

Start Gateway:

```bash
pnpm openclaw gateway run
```

## HTTP routes (Task 102+)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/trustclaw/*` | TrustClaw TRA Runtime Console (built SPA) |
| POST | `/api/ptds/init` | Initialize local TRA personal data (v1.1 schema mapping) |
| POST | `/api/ptds/reset` | Clear personal TRA data rows |
| GET | `/api/ptds/status` | Mounted status + pack snapshot |
| GET | `/api/ptds/tables` | List browsable tables |
| GET | `/api/ptds/browse?table=...` | Read-only table preview |
| POST | `/api/agent/chat` | Pack pipeline chat → Runtime Context JSON |

Text2SQL uses `OPENAI_API_KEY` (optional `TRUSTCLAW_TEXT2SQL_MODEL`, default `gpt-4.1-mini`).

Default DB: `$OPENCLAW_STATE_DIR/state/local_ptds.db` (usually `~/.openclaw/state/local_ptds.db`).

Legacy note: API paths and plugin id still use the `ptds` prefix (see `trustclaw/DECISIONS.md` D25).
