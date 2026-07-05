# TrustClaw × OpenClaw 复用映射

目标：**最大化利用 OpenClaw 基础框架**，TrustClaw 只构建 PTDS 差异化能力（数据空间、审计、存证、业务 Agent 管线）。  
继承 OpenClaw 的 **Gateway、多 Provider、多 Channel、Companion Apps、Control UI、Plugin SDK**。

## 三层策略

| 层级 | 含义 | TrustClaw 做法 |
| --- | --- | --- |
| **Inherit 继承** | 直接沿用，不改或极少配置 | Gateway 进程、频道插件、Provider 认证、macOS/iOS/Android/Windows 应用 |
| **Extend 扩展** | 通过官方 Plugin SDK / HTTP / WS 接缝接入 | PTDS API、审计、账本、Pipeline 注册为 `extensions/trustclaw-ptds` |
| **Build 新建** | OpenClaw 无等价物，TrustClaw 自有模块 | PTDS SQLite、Pack 管线、Evidence 哈希链、Runtime Console |

## 系统级映射

| PTDS 规格系统 | TrustClaw 模块 | OpenClaw 复用点 | 策略 |
| --- | --- | --- | --- |
| **PTDS System** | `trustclaw/ptds/` | `src/infra/kysely-sync.ts`、`node:sqlite` 模式 | Extend |
| **AI Ready Dataset** | `trustclaw/ptds/seeds/`、`nrdl_*` 表 | 无（健康域专有） | Build |
| **Agent Runtime** | `trustclaw/runtime/pipeline/` | `src/llm/`（Text2SQL/GLP-1 LLM）、`src/agents/embedded-agent-runner/`（参考） | Extend + Build |
| **Runtime Audit** | `trustclaw/audit/` | `src/infra/diagnostic-events.ts`、`capture_events` 模式 | Extend |
| **Evidence Ledger** | `trustclaw/ledger/` | `src/proxy-capture/store.sqlite.ts`（哈希 blob 思路） | Build |
| **Business Agent (GLP-1)** | `trustclaw/agents/glp1/` | Prompt 管理可借鉴 `skills/` 模式 | Build |
| **UI System** | `trustclaw/ui/` → Phase 2 `ui/` Tab | `ui/src/ui/app-gateway.ts`（WS 客户端）、Control UI 壳 | V1 Build / P2 Extend |
| **HTTP API** | `extensions/trustclaw-ptds/src/api/` | `src/gateway/server/plugins-http.ts` | Extend |

## 关键 OpenClaw 路径（实现时必读）

| 能力 | 路径 | TrustClaw 用途 |
| --- | --- | --- |
| Gateway HTTP 宿主 | `src/gateway/server-http.ts` | 挂载 `/api/ptds/*`、`/api/agent/*` |
| Plugin HTTP 路由 | `src/gateway/server/plugins-http.ts` | `registerHttpRoute` 处理器 |
| Gateway WS Chat | `src/gateway/server-methods/chat.ts` | Phase 2 频道回复；V1 不依赖 |
| Control UI 网关桥 | `ui/src/ui/app-gateway.ts` | Phase 2 Dashboard 实时事件 |
| LLM Provider 栈 | `src/llm/` | Text2SQL、GLP-1 决策生成 |
| 共享 State DB | `src/state/openclaw-state-db.ts` | 可选审计镜像；非 PTDS 个人数据 |
| Agent 事件流 | `src/infra/agent-events.ts` | Phase 2 与 OpenClaw run 对齐 |
| Plugin SDK | `src/plugin-sdk/` | 插件注册、runtime helper |
| 多平台 Apps | `apps/` | **原样继承** — TrustClaw 不 fork 客户端 |
| 频道 | `extensions/telegram`、`whatsapp`、`discord`… | **原样继承** — Phase 2 输出 GLP-1 结论 |
| 配置 | `openclaw.json` | 插件段 `plugins.trustclaw-ptds`；不新增全局键除非必要 |

## 平台适配继承（Phase 2+）

OpenClaw 已覆盖的能力 TrustClaw **不重做**：

- **macOS / iOS / Android / Windows** Companion 与 Gateway 托管
- **Telegram、WhatsApp、Slack、Discord、WebChat** 等消息通道
- **Model Provider** 路由、failover、auth profiles
- **Sandbox / exec approval** 安全模型

TrustClaw 增量价值：

- 个人健康数据 **不出域**（PTDS SQLite）
- 每次 GLP-1（及未来 Agent）回答 **带 Evidence + Audit**
- 业务 Agent 与 Runtime **解耦**（Pipeline Coordinator）

## 推荐插件结构（D2 待确认）

```
extensions/trustclaw-ptds/
  openclaw.plugin.json
  package.json
  src/
    index.ts              # registerHttpRoute, onStartup
    api/
      ptds-init.ts        # POST /api/ptds/init
      agent-chat.ts       # POST /api/agent/chat
      ptds-reset.ts
    runtime-bridge.ts     # import trustclaw/* core

trustclaw/                # 可单测的核心库（无 OpenClaw 深依赖）
  ptds/
  runtime/
  audit/
  ledger/
  agents/
  ui/                     # Runtime Console SPA → plugin 可 serve
```

## 反模式（禁止）

- 在 `src/` 核心写入 GLP-1 业务规则或 TrustClaw 品牌硬编码
- 为 Demo 关闭 OpenClaw 安全默认（DM pairing、gateway auth）
- 复制一套独立 Gateway 进程
- 将 PTDS 个人数据写入云端或 `openclaw.sqlite` 与 agent 状态混表无边界

## 验收：复用是否到位

- [ ] PTDS API 经 **Plugin HTTP** 暴露，非 ad-hoc Express 侧车
- [ ] LLM 调用走 **现有 Provider 配置**，非硬编码 API Key
- [ ] 单命令启动：`openclaw gateway run` + 启用 trustclaw-ptds 插件
- [ ] Phase 2 能在 **不重写频道** 前提下从 Telegram 触发同一 Pipeline
- [ ] Companion Apps **无需修改** 即可连接同一 Gateway（TrustClaw 为插件能力）
