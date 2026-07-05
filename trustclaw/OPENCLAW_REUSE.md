# TrustClaw × OpenClaw 复用映射

目标：**最大化利用 OpenClaw 基础框架**，TrustClaw 只构建 **Trust Runtime for Agent (TRA)** 差异化能力（可信数据平面、审计、存证、Agent Pack 管线）。  
继承 OpenClaw 的 **Gateway、多 Provider、多 Channel、Companion Apps、Control UI、Plugin SDK**。

## 三层策略

| 层级             | 含义                                     | TrustClaw 做法                                                                  |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| **Inherit 继承** | 直接沿用，不改或极少配置                 | Gateway 进程、频道插件、Provider 认证、macOS/iOS/Android/Windows 应用           |
| **Extend 扩展**  | 通过官方 Plugin SDK / HTTP / WS 接缝接入 | TRA API（`/api/tra/*`）、审计、账本、Pipeline 注册为 `extensions/trustclaw-tra` |
| **Build 新建**   | OpenClaw 无等价物，TrustClaw 自有模块    | TRA SQLite、Pack 管线、Evidence 哈希链、Runtime Console                         |

## 系统级映射

| TRA 平面           | TrustClaw 模块                          | OpenClaw 复用点                                         | 策略           |
| ------------------ | --------------------------------------- | ------------------------------------------------------- | -------------- |
| **Data**           | `trustclaw/tra/`                        | `src/infra/kysely-sync.ts`、`node:sqlite` 模式          | Extend         |
| **Reference data** | `trustclaw/tra/seeds/`、`nrdl_*` 表     | 无（健康域专有）                                        | Build          |
| **Agent**          | `trustclaw/runtime/pipeline/`           | `src/llm/`、`src/agents/embedded-agent-runner/`（参考） | Extend + Build |
| **Evidence**       | `trustclaw/audit/`、`trustclaw/ledger/` | `diagnostic-events` / 哈希存储思路                      | Extend + Build |
| **Agent Packs**    | `trustclaw/agents/*/`                   | Prompt 管理可借鉴 `skills/` 模式                        | Build          |
| **Operator**       | `trustclaw/ui/`                         | Control UI 壳、`app-gateway.ts`                         | Build / Extend |
| **HTTP API**       | `extensions/trustclaw-tra/src/`         | `plugins-http.ts`                                       | Extend         |

## 关键 OpenClaw 路径（实现时必读）

| 能力              | 路径                                          | TrustClaw 用途                    |
| ----------------- | --------------------------------------------- | --------------------------------- |
| Gateway HTTP 宿主 | `src/gateway/server-http.ts`                  | 挂载 `/api/tra/*`、`/api/agent/*` |
| Plugin HTTP 路由  | `src/gateway/server/plugins-http.ts`          | `registerHttpRoute` 处理器        |
| Gateway WS Chat   | `src/gateway/server-methods/chat.ts`          | 频道回复；经 pack 工具链          |
| Control UI 网关桥 | `ui/src/ui/app-gateway.ts`                    | 实时审计事件                      |
| LLM Provider 栈   | `src/llm/`                                    | Text2SQL、Pack 决策生成           |
| 共享 State DB     | `src/state/openclaw-state-db.ts`              | 可选审计镜像；非 TRA 个人数据     |
| Plugin SDK        | `src/plugin-sdk/`                             | 插件注册、runtime helper          |
| 多平台 Apps       | `apps/`                                       | **原样继承**                      |
| 频道              | `extensions/telegram`、`whatsapp`、`discord`… | **原样继承** — 经 pack 输出结论   |
| 配置              | `openclaw.json`                               | 插件段 `plugins.trustclaw-tra`    |

## 平台适配继承（Phase 2+）

OpenClaw 已覆盖的能力 TrustClaw **不重做**：

- **macOS / iOS / Android / Windows** Companion 与 Gateway 托管
- **Telegram、WhatsApp、Slack、Discord、WebChat** 等消息通道
- **Model Provider** 路由、failover、auth profiles
- **Sandbox / exec approval** 安全模型

TrustClaw 增量价值：

- 个人数据 **不出域**（TRA 本地 SQLite）
- 每次 Agent 回答 **带 Evidence + Audit**
- 业务 Agent 与 Runtime **解耦**（Pack + coordinator）

## 推荐插件结构

```
extensions/trustclaw-tra/
  openclaw.plugin.json
  package.json
  src/
    index.ts              # registerHttpRoute, onStartup, tools, hooks
    ...

trustclaw/                # 可单测的核心库（无 OpenClaw 深依赖）
  tra/                   # TRA data plane
  runtime/
  audit/
  ledger/
  agents/
  ui/                     # TRA Runtime Console SPA
```

## 反模式（禁止）

- 在 `src/` 核心写入垂直业务规则或 TrustClaw 品牌硬编码
- 为便利关闭 OpenClaw 安全默认（DM pairing、gateway auth）
- 复制一套独立 Gateway 进程
- 将 TRA 个人数据写入云端或 `openclaw.sqlite` 与 agent 状态混表无边界

## 验收：复用是否到位

- [ ] TRA API 经 **Plugin HTTP** 暴露，非 ad-hoc Express 侧车
- [ ] LLM 调用走 **现有 Provider 配置**，非硬编码 API Key
- [ ] 单命令启动：`openclaw gateway run` + 启用 trustclaw-tra 插件
- [ ] 能在 **不重写频道** 前提下从 Telegram 触发同一 Pack 管线
- [ ] Companion Apps **无需修改** 即可连接同一 Gateway
