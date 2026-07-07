---
name: tra-pack-operations
description: "TRA Business Agent pack operations: init, grants, query/write tools, audit replay. Use in TrustClaw Console chat loops."
---

# TRA pack operations (compliance-auditor workspace)

Use this skill when the user works in **TrustClaw TRA Console** with pack **`compliance-auditor`** / OpenClaw agent `compliance-auditor`.

## When to use

- Mount or re-init personal data (Panel A)
- Grant or explain Panel C scopes for this pack (including `panel.compliance`)
- Answer questions that need **compliance standards / AST rules** via tools
- After tool runs, reference Panel D audit (this pack may omit `LEDGER_COMMIT`)

## Tool contract (do not bypass)

| Intent               | Tool                  | Preconditions                                                         |
| -------------------- | --------------------- | --------------------------------------------------------------------- |
| Read local TRA data  | `trustclaw_tra_query` | Runtime mounted; pack has `tra.chat` grant; consent approved          |
| Durable skill change | `skill_workshop`      | User asked to save/revise standing workflow — not for one-off answers |

This pack has **read-only** tools — do not call `trustclaw_tra_write`.

Never invent SQL results or compliance conclusions. **Rules live in SQLite**, not in this skill file.

## Panel map

| Panel             | API / surface                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| A Init            | `POST /api/tra/init`                                                                                   |
| B Browse          | `GET /api/tra/tables` (pack `readTables`)                                                              |
| C Chat + grants   | OpenClaw chat + `GET/PUT /api/tra/agent-grants`                                                        |
| C2 Pack authoring | Panel `agent-pack-authoring` + `/api/tra/agent-packs/*` (validate/create/save/delete; `agentPacksDir`) |
| D Audit           | `GET /api/tra/audit/events`                                                                            |
| F Compliance      | `POST /api/tra/compliance/*` when `panel.compliance` granted                                           |

## Skill loop hygiene (for authoring agents)

When improving this skill in a Loops turn:

1. **Perceive** — Run one starter question; check audit steps vs pack `pipeline.stages` (no `RULE_EVAL` if omitted).
2. **Strategy** — Change **one** procedure gap.
3. **Implement** — Edit `SKILL.md` or `skill_workshop` proposal.
4. **Verify** — `openclaw skills check`; consent deny; compliance import consent path.
5. **Evolve** — Escalate platform loop if MCA missing.
