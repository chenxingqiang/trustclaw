## TrustClaw Vision

TrustClaw is a **Personal Trusted Data Space Runtime (PTDS Runtime)** — a lightweight local runtime where personal health data, AI-ready reference datasets, and trustworthy agents collaborate under full runtime audit.

This is **not** a single GLP-1 Q&A app. GLP-1 is the first **business agent** demo on the runtime. The platform is designed to host future agents (medication, insurance, training, sleep, nutrition) without rewriting core infrastructure.

**Core principles**

1. **Personal data never leaves PTDS** — raw personal data stays in local SQLite; external agents only receive controlled, de-identified query results.
2. **Every AI answer must be supported by evidence** — conclusions trace to local data sources or rule entries with an immutable evidence chain.
3. **Every agent action must be auditable** — reasoning, tool calls, and queries are captured in runtime audit logs.
4. **Agents decouple from platform** — runtime provides isolation, tools, audit, and ledger; business logic lives in upper-layer agents.

**Demo scope (frozen for V1)**

Five-day delivery target. Implement only the minimum closed loop:

`PTDS init → chat → Text2SQL → rule evaluation → GLP-1 decision → audit → evidence ledger → dashboard`

No non-essential visual polish, refactors, or feature expansion outside this path.

**Technical foundation**

TrustClaw is forked from [OpenClaw](https://github.com/openclaw/openclaw). We reuse its Gateway, agent runner, SQLite/Kysely storage patterns, Control UI shell, and plugin SDK seams. PTDS-specific systems (personal data space, evidence ledger, rule pipeline, demo dashboard) are built as scoped extensions documented in `trustclaw/`.

**Docs**

- **Product loops (canonical):** `trustclaw/AGENTS.md`
- Product features: `trustclaw/PRODUCT.md`
- Getting started: `trustclaw/GETTING_STARTED.md`
- Decisions (审核): `trustclaw/DECISIONS.md`
- Task IDs: `trustclaw/ROADMAP.md`
- OpenClaw reuse: `trustclaw/OPENCLAW_REUSE.md`
- Background plan: `trustclaw/PLAN.md`
- Upstream overview: `README.md`

**What we optimize for (V1)**

- Runnable local demo in Chrome with one command
- Auditable pipeline with no missing steps in the UI
- Evidence receipts with hash-chain integrity
- Declarative GLP-1 agent (prompts + tools, no hardcoded clinical rules in prod)

**What we defer (frozen, illustrative only)**

- Multi-agent routing beyond GLP-1
- Cloud sync, external databases, channel integrations
- Full OpenClaw channel/provider surface rebranding
- CLI/package rename (`openclaw` → `trustclaw`) until post-demo
