# TrustClaw TRA plugin

Enable in `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "trustclaw-tra": {
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

| Method | Path                        | Purpose                                                  |
| ------ | --------------------------- | -------------------------------------------------------- |
| GET    | `/trustclaw/*`              | TrustClaw TRA Runtime Console (built SPA)                |
| POST   | `/api/tra/init`             | Initialize local TRA personal data (v1.1 schema mapping) |
| POST   | `/api/tra/reset`            | Clear personal TRA data rows                             |
| GET    | `/api/tra/status`           | Mounted status + pack snapshot                           |
| GET    | `/api/tra/tables`           | List browsable tables                                    |
| GET    | `/api/tra/browse?table=...` | Read-only table preview                                  |
| POST   | `/api/agent/chat`           | Pack pipeline chat → Runtime Context JSON                |

Text2SQL uses `OPENAI_API_KEY` (optional `TRUSTCLAW_TEXT2SQL_MODEL`, default `gpt-4.1-mini`).

Default DB: `$OPENCLAW_STATE_DIR/state/local_tra.db` (usually `~/.openclaw/state/local_tra.db`).
