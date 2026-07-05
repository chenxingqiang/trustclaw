# trustclaw/

TrustClaw PTDS 实现根目录。在 **OpenClaw fork** 上构建个人可信数据空间运行时。

## 文档

| 文件 | 说明 |
| --- | --- |
| **[AGENTS.md](./AGENTS.md)** | **产品 Loop 唯一驱动** — 无限优化闭环、DoD 闸门、合规 Must、当前轮次笔记 |
| [PRODUCT.md](./PRODUCT.md) | **产品功能文档** — 双表面、六面板、管线、API、V1 完成度 |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | 本地启动、端口、Console 布局 |
| [DECISIONS.md](./DECISIONS.md) | **待您逐条确认** 的架构决策（Loop 闸门） |
| [ROADMAP.md](./ROADMAP.md) | 任务 ID / 依赖图（策略层只读） |
| [OPENCLAW_REUSE.md](./OPENCLAW_REUSE.md) | OpenClaw 能力继承 / 扩展 / 新建映射 |
| [PLAN.md](./PLAN.md) | 阶段背景（只读参考，不驱动 Loop） |

## 代码布局

```
trustclaw/
  ptds/              # Task 101 ✓ — v1.1 SQLite
  runtime/           # Text2SQL, rules, pipeline (102+)
  audit/ ledger/     # 301, 401
  agents/glp1/       # 业务 Agent prompts
  ui/                # V1 Demo SPA

extensions/trustclaw-ptds/   # 待建 — Gateway HTTP 插件 (D2)
```

## 当前进度

- **101 done** — `trustclaw/ptds/` schema + init + SELECT guard  
- **102+ in progress** — Task 102 done (`extensions/trustclaw-ptds`); next Task 201/501
