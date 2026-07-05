# TrustClaw PTDS — 医保 Domain Agent 注册报告

**生成时间：** 2026-07-05  
**患者档案：** 张三（E11 T2DM，BMI 28.4，HbA1c 6.8%）  
**Pack 版本：** medical-insurance-full-chain v2.0.0

---

## ✅ 已注册到 OpenClaw Gateway（agents.list）

| Agent ID                  | 域名称              | 管辖子 Agent 数 | PTDS Scopes                   |
| ------------------------- | ------------------- | --------------- | ----------------------------- |
| `ptds-outpatient`         | 🏥 门诊报销协调器   | 144             | read,chat,browse,audit,ledger |
| `ptds-inpatient`          | 🛏️ 住院结算协调器   | 144             | read,chat,browse,audit,ledger |
| `ptds-pharmacy`           | 💊 药店购药协调器   | 120             | read,chat,browse,audit,ledger |
| `ptds-cross-region`       | 🗺️ 异地就医协调器   | 114             | read,chat,browse,audit,ledger |
| `ptds-audit`              | 🔍 医保稽核协调器   | 132             | read,chat,browse,audit,ledger |
| `ptds-drg`                | 📊 DRG分组协调器    | 110             | read,chat,browse,audit,ledger |
| `ptds-maternity`          | 🍼 生育保险协调器   | 110             | read,chat,browse,audit,ledger |
| `ptds-catastrophic`       | 🏨 大病保险协调器   | 110             | read,chat,browse,audit,ledger |
| `ptds-medical-assistance` | 🤝 医疗救助协调器   | 8               | read,chat,browse,audit,ledger |
| `ptds-tcm`                | 🌿 中医药报销协调器 | 8               | read,chat,browse,audit,ledger |

---

## 📊 全量 1000 Agent 注册清单（PTDS domain_agents 表）

**注册文件：** `domain_agents_registry.sql`（198 KB，10 批 × 100 条 INSERT）  
**全量 JSON：** `scripts/output/agents-all-1000.json`（2.3 MB）  
**轻量索引：** `scripts/output/agents-index.json`（274 KB）

### Panel A 导入方式

```
Panel A → 导入 Domain Agent 注册表 → 选择 domain_agents_registry.sql
```

执行后 PTDS 将创建 `domain_agents` 表并写入 1000 条记录。

---

## 🗺️ 地区覆盖矩阵

| 大区 | 统筹区                                       |
| ---- | -------------------------------------------- |
| 华东 | 上海、南京、苏州、杭州、合肥                 |
| 华南 | 广州、深圳、厦门、南宁、海口                 |
| 华北 | 北京、天津、石家庄、太原、呼和浩特           |
| 华中 | 郑州、武汉、长沙                             |
| 西部 | 成都、重庆、西安、昆明、贵阳、兰州、乌鲁木齐 |
| 东北 | 沈阳、长春、哈尔滨、大连、延吉               |

险种维度：职工基本医保 × 城乡居民医保（各 2 变体）

---

## ⚠️ 激活优先级（张三档案）

基于现有 PTDS 表（diagnoses + labs），以下 19 个 Agent 可部分激活：

**最高优先级（立即可用）：**

- `drg-005` DRG最终判定 → E11 + HbA1c 6.8% → 预判 MDC-10
- `drg-003` MDC分类匹配 → 内分泌疾病组
- `op-003` 门诊慢特病匹配 → T2DM 慢特病资格

**导入一张表即可完全激活：**

- 导入 `disease_catalog_chronic` → 激活 op-003, ph-005, cb-006（3个）
- 导入 `drg_rules` → 激活 drg-003,004,005,009（4个）
- 导入 `insurance_enrollment` → 激活 ph-002, ma-001（2个）

---

## 🔧 扩展至更多 Agent

```bash
# 调整 REGIONS 数组为 337 个地市，可扩展至 ~30,000 Agent
cd domain-agents
node scripts/generate-regional-agents.js
```
