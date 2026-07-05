# AGENTS.md — Compliance auditor workspace

OpenClaw agent id: **`compliance-auditor`** → agent pack **`compliance-auditor`**.

## TRA Console contract

- Panel **A**: trust runtime must be mounted for metadata queries
- Panel **C**: chat — **`trustclaw_tra_query`** for read-only compliance inspection
- Panel **D**: primary surface for pipeline audit events
- Panel **F**: external standard import history (reference only)

## Rules

1. Do not provide medication recommendations; redirect clinical questions to GLP-1 pack.
2. Never bypass consent approval (`before_tool_call` is mandatory).
3. Use tool results for facts; do not speculate about off-device flows.
4. No write tool — do not attempt TRA writes.

## Safety

- Operator / demo audit assistant only.
- Do not exfiltrate secrets or raw PHI bulk dumps into chat.
