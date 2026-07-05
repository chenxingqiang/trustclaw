# trustclaw/

TrustClaw PTDS 实现根目录。在 **OpenClaw fork** 上构建个人可信数据空间运行时。

## 文档

| 文件 | 说明 |
| --- | --- |
| [../VISION.md](../VISION.md) | **平台 north star** — 五平面架构 |
| **[AGENTS.md](./AGENTS.md)** | **产品 Loop 唯一驱动** — 无限优化闭环、生产就绪闸门、合规 Must |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | 本地启动、端口、Console 布局 |
| [DECISIONS.md](./DECISIONS.md) | 架构决策闸门 |
| [OPENCLAW_REUSE.md](./OPENCLAW_REUSE.md) | OpenClaw 能力继承 / 扩展 / 新建映射 |
| [docs/AGENT_PLATFORM.md](./docs/AGENT_PLATFORM.md) | Business Agent Pack 契约与注册表 |

## 代码布局

```
trustclaw/
  ptds/              # PTDS SQLite + domain_agents
  runtime/           # Text2SQL, rules, pipeline, agent-pack
  audit/ ledger/     # JSONL 审计 + 证据哈希链
  agents/            # 声明式 Agent Pack
  ui/                # PTDS Runtime Console SPA

extensions/trustclaw-ptds/   # Gateway HTTP 插件（/api/ptds/*, /api/agent/*）
```

## 状态

**平台 baseline 已落地**（`DECISIONS.md` D1–D24）。架构叙事以 `VISION.md` 五平面为准；迭代 Loop 只读 `AGENTS.md`。开放项：D5、D21、D23（deferred）；D13、D24（approved）。

本地启动见 `GETTING_STARTED.md`。
