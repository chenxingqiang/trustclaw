---
name: tra-pack-operations
description: "TRA Business Agent pack operations: init, grants, query/write tools, audit replay. Use in TrustClaw Console chat loops."
---

# TRA pack operations (nrdl-reimburse workspace)

Use this skill when the user works in **TrustClaw TRA Console** with pack **`nrdl-reimburse`** / OpenClaw agent `nrdl-reimburse`.

## When to use

- Mount or re-init personal data (Panel A)
- Grant or explain Panel C scopes for this pack
- Answer questions that need **local TRA data** via tools
- After tool runs, reference Panel D audit / Panel E ledger when the pack declares those stages

## Tool contract (do not bypass)

| Intent               | Tool                  | Preconditions                                                         |
| -------------------- | --------------------- | --------------------------------------------------------------------- |
| Read local TRA data  | `trustclaw_tra_query` | Runtime mounted; pack has `tra.chat` grant; consent approved          |
| Write personal data  | `trustclaw_tra_write` | Pack declares write tool; `tra.write` grant; write consent            |
| Durable skill change | `skill_workshop`      | User asked to save/revise standing workflow — not for one-off answers |

Never invent SQL results, rule PASS/FAIL, or vitals. Clinical **rules live in SQLite**, not in this skill file.

## Panel map

| Panel             | API / surface                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| A Init            | `POST /api/tra/init`                                                                                   |
| B Browse          | `GET /api/tra/tables` (pack `readTables`)                                                              |
| C Chat + grants   | OpenClaw chat + `GET/PUT /api/tra/agent-grants`                                                        |
| C2 Pack authoring | Panel `agent-pack-authoring` + `/api/tra/agent-packs/*` (validate/create/save/delete; `agentPacksDir`) |
| D Audit           | `GET /api/tra/audit/events`                                                                            |
| E Ledger          | `GET /api/tra/ledger` (when pack has `LEDGER_COMMIT`)                                                  |
| F Compliance      | import / subscription routes (when `panel.compliance` granted)                                         |

## Skill loop hygiene (for authoring agents)

When improving this skill in a Loops turn:

1. **Perceive** — Run one starter question from the pack; check audit steps vs `pipeline.stages`.
2. **Strategy** — Change **one** procedure gap (wording, panel order, tool precondition).
3. **Implement** — Edit `SKILL.md` or `skill_workshop` proposal; do not edit `agent.pack.json` in the same turn unless Strategy says so.
4. **Verify** — `openclaw skills check`; pack vitest; consent deny path still blocks.
5. **Evolve** — Note gap in pack prompt vs skill; escalate platform loop if hook/MCA missing.
