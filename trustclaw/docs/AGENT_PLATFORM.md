# TrustClaw Business Agent Platform

TrustClaw separates **TRA platform capabilities** from **declarative Business Agent packs**. GLP-1/C3-PO is the first pack; additional医保/健康 agents ship as new directories under `trustclaw/agents/`.

## Architecture

| Layer                | Owner                                                               | Responsibility                                                          |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **TRA platform**     | `trustclaw/tra/`, `trustclaw/runtime/`, `extensions/trustclaw-tra/` | SQLite, Text2SQL guards, consent, audit, ledger, plugin tools           |
| **Agent Pack**       | `trustclaw/agents/<pack>/agent.pack.json`                           | Persona prompts, tool subset, rule engine, consent policy, audit labels |
| **OpenClaw binding** | `openclaw.json` `agents.list` + plugin hooks                        | Maps `agentId` → pack; injects system context per turn                  |

## Agent Pack contract

Schema: `trustclaw/agents/_schema/agent-pack.v1.json`  
Loader: `trustclaw/runtime/agent-pack/`  
Registry: `AgentPackRegistry.load()` / `GET /api/tra/agent-packs`

### Minimal pack layout

```
trustclaw/agents/my-agent/
  agent.pack.json
  prompts/
    my-agent-system.v1.md
```

### Bundled packs (V1)

| Pack id              | OpenClaw `agentId`   | Read | Write | Rule engine      |
| -------------------- | -------------------- | ---- | ----- | ---------------- |
| `glp1-eligibility`   | `main` (default)     | ✓    | ✓     | `ast-compliance` |
| `nrdl-reimburse`     | `nrdl-reimburse`     | ✓    | —     | `nrdl-table`     |
| `compliance-auditor` | `compliance-auditor` | ✓    | —     | `none`           |

## Platform tools (shared)

| Tool                  | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `trustclaw_tra_query` | SELECT Text2SQL + GLP-1 pipeline read path |
| `trustclaw_tra_write` | INSERT Text2SQL personal/device writes     |

Packs declare which tools are exposed. Consent policy is pack-scoped (`consent.read.allowAlways`, `consent.write.allowAlways`).

## OpenClaw configuration

```json
{
  "agents": {
    "list": [
      { "id": "main", "workspace": "trustclaw/workspace/dev" },
      { "id": "nrdl-reimburse", "workspace": "trustclaw/workspace/nrdl-reimburse" },
      { "id": "compliance-auditor", "workspace": "trustclaw/workspace/compliance-auditor" }
    ]
  },
  "plugins": {
    "entries": {
      "trustclaw-tra": {
        "enabled": true,
        "config": {
          "defaultAgentPack": "glp1-eligibility"
        }
      }
    }
  }
}
```

Plugin hooks:

- `before_prompt_build` → `buildTrustclawTraAgentGuidance({ sessionKey, openclawAgentId })`
- `before_tool_call` → consent gates per pack policy

## Pipeline Coordinator (D15)

`trustclaw/runtime/coordinator/session-pack-coordinator.ts` binds one **agent pack per chat session** so tool calls, consent, Text2SQL, and prompts do not drift when the OpenClaw sidebar agent changes mid-session.

### Resolution priority

1. **session** — explicit Panel C `PUT /api/tra/session/agent-pack`
2. **lock** — coordinator lock from the first `bindLock` resolve (prompt/tool)
3. **openclaw_agent** / **default** — only before a lock exists
4. **request** — `POST /api/agent/chat` with `agent_pack_id` (also binds when `bindLock`)

Storage: `state/tra-audit/session-agent-packs.json` with `sessions` (UI override) and `locks` (coordinator).

| Endpoint                                          | Purpose                                       |
| ------------------------------------------------- | --------------------------------------------- |
| `GET /api/tra/session/agent-pack?session_id=…`    | Preview effective pack (`bindLock: false`)    |
| `PUT /api/tra/session/agent-pack`                 | User selects pack; sets override **and** lock |
| `DELETE /api/tra/session/agent-pack?session_id=…` | Clear override + lock (e.g. after `/new`)     |

Hot paths (`before_prompt_build`, `before_tool_call`, TRA tools) call `resolveBoundAgentPack()` (`bindLock: true`).

## REST API

| Endpoint                                       | Purpose                                                    |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `GET /api/tra/agent-packs`                     | List installed packs + default id                          |
| `GET /api/tra/session/agent-pack?session_id=…` | Resolved pack for a chat session                           |
| `PUT /api/tra/session/agent-pack`              | Bind `{ session_id, agent_pack_id }` for Panel C selector  |
| `POST /api/agent/chat`                         | Optional `agent_pack_id` overrides pack for HTTP chat demo |

Runtime Context responses include `agent_pack_id`.

## Adding a new healthcare agent

1. Create `trustclaw/agents/<id>/agent.pack.json` (validate against schema).
2. Add `prompts/*-system.v1.md` persona (no hardcoded clinical rules — rules live in SQLite/AST).
3. Map `openclaw.agentId` to an OpenClaw agent profile.
4. Choose `rules.engine` and `pipeline.decisionBuilder`.
5. Run `pnpm test extensions/trustclaw-tra` and restart Gateway.

## Phase roadmap

| Phase             | Scope                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| **2.5 (current)** | Pack schema, registry, GLP-1 migration, 3 template packs, API list                               |
| **3**             | Panel C agent selector; session-bound pack; multi-agent workspaces; pack-scoped Text2SQL prompts |
| **4**             | Pack authoring CLI/UI; signed external packs                                                     |

## Compliance notes

- Packs must not bypass `before_tool_call` consent.
- `compliance-auditor` sets `consent.read.allowAlways: false` — every read requires approval.
- Write tools are blocked when omitted from `tools` in the pack.

See also: `trustclaw/AGENTS.md` (compliance review), `trustclaw/DECISIONS.md` (D17–D19).
