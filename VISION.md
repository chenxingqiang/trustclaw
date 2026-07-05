## TrustClaw Vision

TrustClaw is a **Personal Trusted Data Space Runtime (PTDS Runtime)** — a local-first platform where personal health data, subscribed reference datasets, and auditable agents collaborate under explicit consent and immutable evidence.

Business agents (clinical eligibility, reimbursement, compliance review, and others) are **packs on the runtime**, not the platform identity. The runtime stays vertical-agnostic; vertical logic ships as declarative Agent Packs and imported rule sets.

**Core principles**

1. **Personal data never leaves PTDS** — raw personal data stays in local SQLite; external models and tools only receive controlled, consented query surfaces.
2. **Every conclusion must be evidenced** — outputs trace to local data, imported standards, or deterministic rule evaluation with a replayable chain.
3. **Every agent action must be auditable** — consent, tool calls, queries, and commits are recorded with closed step/component semantics.
4. **Agents decouple from platform** — runtime owns isolation, tools, audit, and ledger; business behavior lives in packs and coordinators.

**Platform architecture (production)**

TrustClaw is organized by **planes**, not by a single demo chat script:

| Plane | Responsibility |
| --- | --- |
| **Data** | PTDS schema, personal store, reference sync, SELECT guards, table lineage |
| **Policy** | Consent, domain grants, compliance import, fail-closed gates |
| **Agent** | Agent Pack contract, coordinators, session binding, tool-gated access |
| **Evidence** | Audit trail, hash-chain ledger, operator replay |
| **Operator** | Runtime Console (data/audit/compliance) + Agent workbench (chat/tools) |

A typical production interaction flows through these planes — mount data → grant scope → run pack tools → evaluate rules → commit evidence — but **no fixed vertical pipeline** is canonical at the vision layer. Concrete flows are owned by packs, `DECISIONS.md`, and `trustclaw/AGENTS.md`.

**Technical foundation**

TrustClaw is forked from [OpenClaw](https://github.com/openclaw/openclaw). We reuse Gateway, agent runner, SQLite/Kysely patterns, Control UI shell, and plugin SDK seams. PTDS-specific systems are scoped extensions under `trustclaw/` and `extensions/trustclaw-ptds/`.

**Docs**

- **Product loops (canonical):** `trustclaw/AGENTS.md`
- Getting started: `trustclaw/GETTING_STARTED.md`
- Decisions (审核): `trustclaw/DECISIONS.md`
- OpenClaw reuse: `trustclaw/OPENCLAW_REUSE.md`
- Upstream overview: `README.md`

**What we optimize for**

- **Local-first operations** — single-node install, SQLite state, no silent cloud egress
- **Production auditability** — attributable steps, BLOCKED paths recorded, operator replay
- **Evidence integrity** — hash-chained receipts; no read-through fallback on policy failure
- **Declarative verticals** — rules and packs in data/SQLite, not hardcoded clinical paths in core
- **Catalog scale** — domain agent registry and coordinators without one-process-per-logical-agent

**Roadmap deferrals**

- Channel integrations (Telegram/WhatsApp/WebChat) — D5
- Compliance package cryptographic verification — D21
- Natural-language multi-agent routing — D23
- CLI/package rename (`openclaw` → `trustclaw`) — D13
- Full `domain_agents` registry import — D24
