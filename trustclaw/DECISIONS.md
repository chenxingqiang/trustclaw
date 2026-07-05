# TrustClaw — 决策清单

**V1 已交付（2026-07-05）。** 状态：`delivered` | `approved` | `deferred`。变更已确认方案须新开决策项，不得静默偏离。

| ID  | 决策                                                                  | 状态      |
| --- | --------------------------------------------------------------------- | --------- |
| D1  | PTDS v1.1 schema（`trustclaw/ptds/schema/v1.1.sql`）                  | delivered |
| D2  | `extensions/trustclaw-ptds` + `trustclaw/` 核心库；不改 OpenClaw core | delivered |
| D3  | PTDS Console（`trustclaw/ui/` → `/trustclaw`）；Panel A–F             | delivered |
| D4  | Chat：`POST /api/agent/chat` + Runtime Context                        | delivered |
| D5  | 频道集成（Telegram/WhatsApp/WebChat 等）                              | deferred  |
| D6  | 规则引擎：TS 确定性匹配；不用 LLM 判规则                              | delivered |
| D7  | Text2SQL：LLM + SELECT 守卫（`trustclaw/ptds/query.ts`）              | delivered |
| D8  | 审计：`state/ptds-audit/` JSONL                                       | delivered |
| D9  | 账本：`state/ptds-evidence/` 哈希链                                   | delivered |
| D10 | PTDS DB 默认 `state/local_ptds.db`                                    | delivered |
| D11 | Init 扩展字段写入 canonical 表                                        | delivered |
| D12 | 数据浏览器默认表 + 订阅表血缘                                         | delivered |
| D13 | 品牌 TrustClaw；CLI/路径暂 `openclaw`                                 | approved  |
| D14 | 业务规则仅 SQLite/合规导入；禁止 TS 硬编码 GLP-1                      | delivered |
| D15 | 会话级 Agent Pack 绑定 + coordinator lock                             | delivered |
| D16 | NRDL 参考表 HTTPS 订阅 → 本地表；无运行时远程 DB                      | delivered |
| D17 | `agent.pack.json` 契约 + Pack 注册表                                  | delivered |
| D18 | 默认 Pack：`glp1-eligibility`                                         | delivered |
| D19 | Panel C 赋权 + session pack API + 逻辑 Agent 目录 API/UI              | delivered |
| D20 | `prescription_context` 来自 Init 可选字段                             | delivered |
| D21 | 合规包 `publisher_signature` 密码学验签                               | deferred  |
| D22 | 领域 Agent scope 赋权；fail-closed；按 pack 隔离 consent              | delivered |
| D23 | 自然语言多 Agent 意图路由                                             | deferred  |
| D24 | `domain_agents` 千级目录种子 + 浏览；全量导入为运营动作               | approved  |

**开放项：** D5、D21、D23（V2）；D13（品牌化）；D24（全量注册导入）。
