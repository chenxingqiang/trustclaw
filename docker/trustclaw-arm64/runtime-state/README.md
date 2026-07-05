# Docker runtime state (local mirror)

Local copy of the `trustclaw-data` volume from the running container.

**Do not commit secrets.** This tree is gitignored except this README.

## Sync commands

From `docker/trustclaw-arm64/`:

```bash
# Container → local (volume + product seeds)
./scripts/pull-container-state.sh

# Local build → container (plugin bundle + UI + trustclaw sources)
./scripts/push-container-code.sh
```

## Layout

| Path                          | Source in container                                              |
| ----------------------------- | ---------------------------------------------------------------- |
| `openclaw.json`               | `/home/node/.openclaw/openclaw.json` (API keys redacted on pull) |
| `state/`                      | `state/local_ptds.db`, `trustclaw-agents-merged/`, `ptds-audit/` |
| `workspace/domain-agents/`    | Domain agent registry JSON/SQL                                   |
| `workspace/trustclaw-agents/` | PTDS agent pack symlinks/sources                                 |
| `npm/`                        | Installed channel plugins (e.g. WeChat)                          |

Product registry files are also copied to `trustclaw/ptds/seeds/domain-agents/` on pull.
