# TrustClaw — 决策清单

产品负责人已于 2026-07-04 **全部确认**。状态：`approved` | `rejected` | `deferred`。

| ID      | 决策项                            | 方案                                                                                                                                        | 状态                    | 确认人  | 备注                                                         |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- | ------------------------------------------------------------ |
| **D1**  | 数据 Schema 基准                  | PTDS v1.1（`trustclaw/ptds/schema/v1.1.sql`）；不做规格书简化两表                                                                           | **approved**            | product | Task 101 已完成                                              |
| **D2**  | TrustClaw 在 OpenClaw 中的形态    | `extensions/trustclaw-ptds` 插件 + `trustclaw/` 核心库                                                                                      | **approved**            | product | OpenClaw 为底座，不全量改造 core                             |
| **D3**  | V1 Demo UI                        | V1 独立 SPA（`trustclaw/ui/`）；Phase 2 并入 Control UI                                                                                     | **approved**            | product | 继承 `ui/app-gateway.ts`                                     |
| **D4**  | V1 Chat 传输                      | REST `POST /api/agent/chat`；V1 不走 WS `chat.send`                                                                                         | **approved**            | product |                                                              |
| **D5**  | Phase 2 频道集成                  | GLP-1 结论经 Telegram/WhatsApp/WebChat 等发出                                                                                               | **deferred**            | product | Phase 2 实施；V1 不做                                        |
| **D6**  | 规则引擎                          | TS 确定性匹配（`nrdl_payment_rules` + snapshot view）；不用 LLM                                                                             | **approved**            | product |                                                              |
| **D7**  | Text2SQL                          | LLM + SELECT 守卫（`trustclaw/ptds/query.ts`）                                                                                              | **approved**            | product | 守卫已实现                                                   |
| **D8**  | 审计存储                          | `state/ptds-audit/` JSONL                                                                                                                   | **approved**            | product |                                                              |
| **D9**  | 账本存储                          | `state/ptds-evidence/` 哈希链 JSON                                                                                                          | **approved**            | product |                                                              |
| **D10** | PTDS DB 路径                      | 默认 `state/local_ptds.db`                                                                                                                  | **approved**            | product | 更新 `resolvePtdsDbPath` 默认值                              |
| **D11** | Init 扩展字段                     | 保留 `include_t2dm_diagnosis`                                                                                                               | **approved**            | product | NRDL 演示                                                    |
| **D12** | UI 数据浏览器默认表               | `body_anthropometrics`, `lab_test_results`, `nrdl_payment_rules`, `v_glp1_nrdl_check_snapshot`                                              | **approved**            | product |                                                              |
| **D13** | 品牌与 CLI                        | 对外 TrustClaw；CLI/包名暂 `openclaw`                                                                                                       | **approved**            | product |                                                              |
| **D14** | 业务规则                          | 禁止 TS 硬编码 GLP-1 规则；仅 SQLite 种子                                                                                                   | **approved**            | product |                                                              |
| **D15** | 多 Agent 路由                     | V1 **会话级 pack 绑定** + coordinator lock（Panel C / `session-pack-coordinator`）；**不含**自然语言意图路由                                | **approved（V1 子集）** | product | 全量 Coordinator（Insurance/Medication 自动路由）仍 Phase 3+ |
| **D16** | 外部 NRDL 参考表订阅（B 类）      | HTTPS/JSON 拉取 → 本地 `nrdl_drug_registry` + `nrdl_payment_rules`；不动个人表；consent + `REFERENCE_SYNC` 审计；无运行时远程 DB            | **approved**            | product | Task 502                                                     |
| **D17** | Business Agent Pack 契约          | 声明式 `agent.pack.json` + zod 校验；平台工具与规则引擎可复用                                                                               | **approved**            | product | Phase 2.5                                                    |
| **D18** | 默认 Agent Pack                   | `glp1-eligibility`；OpenClaw `agentId` 可映射到其他 pack                                                                                    | **approved**            | product |                                                              |
| **D19** | 多 Agent 路由 UI                  | V1 **Panel C 领域 Agent 选择器** + `PUT /api/ptds/session/agent-pack`；**不含** Control UI 全量合并                                         | **approved（V1 子集）** | product | 延续 D15；全量多 Agent UX 仍 Phase 3                         |
| **D20** | `prescription_context` 来源       | Init 可选字段写入 `prescription_context` 表；缺省沿用演示默认值                                                                             | **approved**            | product | 替代 `ast-context.ts` 硬编码默认                             |
| **D21** | 合规包 `publisher_signature` 校验 | V1 **仅存储与展示**元数据；密码学验签 deferred                                                                                              | **deferred**            | product | 待 PRODUCT_SPEC 批准验签算法与信任根                         |
| **D22** | 领域 Agent 面板赋权               | Panel C 用户按 `agent.pack.json` 授予 `panel.*` / `ptds.*` scope；API `agentPackId` + `agent-domain-grants.json`；Chat consent 按 pack 隔离 | **approved**            | product | 延续 D17/D19 Agent 解耦                                      |

## 生效说明

- **D1–D4, D6–D14**：可立即进入 Development（按 `ROADMAP.md` 依赖顺序）。
- **D5, D21**：已确认方向，但 **deferred** — V1 不得实现频道桥接或合规包密码学验签。
- **D15, D19（V1 子集）**：会话级 agent pack 绑定 + Panel C 选择器已交付；自然语言多 Agent 意图路由仍不在 V1 范围。
- 变更已确认方案需新开决策项，不得静默偏离。

## 规格书 V1 ↔ 实现（已对齐）

| 规格书              | 实现                         |
| ------------------- | ---------------------------- |
| 简化两表            | v1.1 + Init 映射             |
| Python Rule Matcher | TS 确定性 matcher            |
| React SPA           | V1 独立 SPA（D3）            |
| `./local_ptds.db`   | `state/local_ptds.db`（D10） |

## 下一步（ROADMAP）

1. **Task 102** ✓ — `extensions/trustclaw-ptds` + `POST /api/ptds/init`
2. **Task 201–202** — Text2SQL + 规则引擎
3. **Task 501** — Demo SPA 骨架
