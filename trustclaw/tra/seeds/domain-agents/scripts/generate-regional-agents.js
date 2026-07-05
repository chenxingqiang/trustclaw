#!/usr/bin/env node
/**
 * generate-regional-agents.js
 * 批量生成 1000 个医保 Domain Agent 配置
 *
 * 策略：
 *   基础包（10 个域 × 平均 9.8 agents = ~102 agents）
 *   + 地区矩阵扩展（按省/险种/环节三维展开）
 *   目标：1000 agents
 *
 * 运行方式：
 *   node generate-regional-agents.js
 *
 * 输出：
 *   ./output/agents-all-1000.json   — 全量 agent 配置
 *   ./output/agents-index.json      — 索引（id + name + domain + region + enabled）
 *   ./output/agents-by-domain/      — 按域分文件（便于按需导入）
 */

const fs = require("fs");
const path = require("path");

// ─── 配置 ──────────────────────────────────────────────────────────────────

const BASE_DIR = path.join(__dirname, "..");
const OUTPUT_DIR = path.join(__dirname, "output");

// 已有基础域文件
const DOMAIN_FILES = [
  "outpatient-agents.json",
  "inpatient-agents.json",
  "pharmacy-agents.json",
  "cross-region-agents.json",
  "audit-agents.json",
  "drg-agents.json",
  "maternity-agents.json",
  "catastrophic-agents.json",
  "medical-assistance-agents.json",
  "tcm-agents.json",
];

// 地区矩阵：6 大区 × 代表性统筹区（共 30 个统筹区）
const REGIONS = [
  // 华东
  { region_code: "SH", region_name: "上海市", zone: "华东", policy_tier: 1 },
  { region_code: "JS-NJ", region_name: "南京市", zone: "华东", policy_tier: 2 },
  { region_code: "JS-SZ", region_name: "苏州市", zone: "华东", policy_tier: 2 },
  { region_code: "ZJ-HZ", region_name: "杭州市", zone: "华东", policy_tier: 2 },
  { region_code: "AH-HF", region_name: "合肥市", zone: "华东", policy_tier: 3 },
  // 华南
  { region_code: "GD-GZ", region_name: "广州市", zone: "华南", policy_tier: 1 },
  { region_code: "GD-SZ", region_name: "深圳市", zone: "华南", policy_tier: 1 },
  { region_code: "FJ-XM", region_name: "厦门市", zone: "华南", policy_tier: 2 },
  { region_code: "GX-NN", region_name: "南宁市", zone: "华南", policy_tier: 3 },
  { region_code: "HI-HK", region_name: "海口市", zone: "华南", policy_tier: 3 },
  // 华北
  { region_code: "BJ", region_name: "北京市", zone: "华北", policy_tier: 1 },
  { region_code: "TJ", region_name: "天津市", zone: "华北", policy_tier: 1 },
  { region_code: "HB-SJZ", region_name: "石家庄市", zone: "华北", policy_tier: 3 },
  { region_code: "SX-TY", region_name: "太原市", zone: "华北", policy_tier: 3 },
  { region_code: "NMG-HH", region_name: "呼和浩特市", zone: "华北", policy_tier: 3 },
  // 华中
  { region_code: "HEN-ZZ", region_name: "郑州市", zone: "华中", policy_tier: 2 },
  { region_code: "HUB-WH", region_name: "武汉市", zone: "华中", policy_tier: 2 },
  { region_code: "HUN-CS", region_name: "长沙市", zone: "华中", policy_tier: 2 },
  // 西部
  { region_code: "SC-CD", region_name: "成都市", zone: "西部", policy_tier: 2 },
  { region_code: "CQ", region_name: "重庆市", zone: "西部", policy_tier: 2 },
  { region_code: "SHX-XA", region_name: "西安市", zone: "西部", policy_tier: 2 },
  { region_code: "YN-KM", region_name: "昆明市", zone: "西部", policy_tier: 3 },
  { region_code: "GZ-GY", region_name: "贵阳市", zone: "西部", policy_tier: 3 },
  { region_code: "GS-LZ", region_name: "兰州市", zone: "西部", policy_tier: 3 },
  { region_code: "XJ-UR", region_name: "乌鲁木齐市", zone: "西部", policy_tier: 3 },
  // 东北
  { region_code: "LN-SY", region_name: "沈阳市", zone: "东北", policy_tier: 2 },
  { region_code: "JL-CC", region_name: "长春市", zone: "东北", policy_tier: 3 },
  { region_code: "HLJ-HRB", region_name: "哈尔滨市", zone: "东北", policy_tier: 3 },
  { region_code: "LN-DL", region_name: "大连市", zone: "东北", policy_tier: 2 },
  { region_code: "JL-YJ", region_name: "延吉市", zone: "东北", policy_tier: 3 },
];

// 险种矩阵
const INSURANCE_TYPES = [
  { type_code: "EMPLOYEE", type_name: "职工基本医疗保险" },
  { type_code: "RESIDENT", type_name: "城乡居民基本医疗保险" },
];

// 需要地区差异化扩展的域（高价值扩展域）
const REGIONAL_EXPAND_DOMAINS = [
  "outpatient",
  "inpatient",
  "pharmacy",
  "cross-region",
  "audit",
  "drg",
  "maternity",
  "catastrophic",
];

// ─── 工具函数 ───────────────────────────────────────────────────────────────

function loadBaseAgents() {
  const agents = [];
  for (const file of DOMAIN_FILES) {
    const filePath = path.join(BASE_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  跳过缺失文件: ${file}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    agents.push(...data.agents);
  }
  return agents;
}

/**
 * 根据基础 agent 和地区/险种生成地区变体
 */
function generateRegionalVariant(baseAgent, region, insuranceType) {
  const variantId = `${baseAgent.id}-${region.region_code.toLowerCase()}-${insuranceType.type_code.toLowerCase()}`;
  return {
    ...baseAgent,
    id: variantId,
    name: `${baseAgent.name}【${region.region_name}·${insuranceType.type_name.slice(0, 4)}】`,
    version: "1.0.0",
    region: {
      region_code: region.region_code,
      region_name: region.region_name,
      zone: region.zone,
      policy_tier: region.policy_tier,
    },
    insurance_type: {
      type_code: insuranceType.type_code,
      type_name: insuranceType.type_name,
    },
    regional_policy_overrides: {
      note: `${region.region_name}地区${insuranceType.type_name}政策参数，需从 insurance_policy_rules 表中 WHERE region_code='${region.region_code}' AND insurance_type='${insuranceType.type_code}' 加载`,
      policy_tier: region.policy_tier,
      requires_regional_policy_data: true,
    },
    enabled: false,
    missing_data_warning:
      (baseAgent.missing_data_warning || "").replace(
        "需开放 TRA 数据表才能激活",
        `需开放 TRA 数据表才能激活【${region.region_name}·${insuranceType.type_name.slice(0, 4)}版本】`,
      ) + `\n• insurance_policy_rules WHERE region_code='${region.region_code}' — 本地区政策参数`,
  };
}

// ─── 主流程 ─────────────────────────────────────────────────────────────────

function main() {
  console.log("📦 加载基础 Agent 配置...");
  const baseAgents = loadBaseAgents();
  console.log(`   基础 Agent 数量: ${baseAgents.length}`);

  const allAgents = [...baseAgents];

  // 筛选需要地区扩展的基础 agent
  const expandBase = baseAgents.filter((a) => REGIONAL_EXPAND_DOMAINS.includes(a.domain));
  console.log(`🗺️  地区扩展候选 Agent: ${expandBase.length}`);

  // 计算需要扩展多少个以达到 1000
  const TARGET = 1000;
  const needed = TARGET - baseAgents.length;
  const perAgent = Math.ceil(needed / expandBase.length);

  // 建立扩展队列：region × insuranceType 组合
  const combinations = [];
  for (const r of REGIONS) {
    for (const t of INSURANCE_TYPES) {
      combinations.push({ region: r, insuranceType: t });
    }
  }
  // 60 combinations total (30 regions × 2 types)

  let generated = 0;
  outer: for (const combo of combinations) {
    for (const baseAgent of expandBase) {
      if (allAgents.length >= TARGET) break outer;
      // 避免重复（基础 agent 已含全国版）
      const variant = generateRegionalVariant(baseAgent, combo.region, combo.insuranceType);
      allAgents.push(variant);
      generated++;
    }
  }

  console.log(`✅ 扩展生成: ${generated} 个地区变体`);
  console.log(`📊 总计 Agent: ${allAgents.length}`);

  // ── 写出文件 ──
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. 全量文件
  const allPayload = {
    pack_id: "medical-insurance-full-chain-1000",
    pack_name: "医保医药报销全链路 Domain Agent Pack（1000 Agent 版）",
    version: "2.0.0",
    openclaw_pack_spec: "1.0",
    total_agents: allAgents.length,
    generated_at: new Date().toISOString(),
    agents: allAgents,
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "agents-all-1000.json"),
    JSON.stringify(allPayload, null, 2),
    "utf8",
  );
  console.log(`📄 写出: output/agents-all-1000.json`);

  // 2. 索引文件（轻量）
  const index = allAgents.map((a) => ({
    id: a.id,
    name: a.name,
    domain: a.domain,
    subdomain: a.subdomain,
    region: a.region ? a.region.region_name : "全国",
    insurance_type: a.insurance_type ? a.insurance_type.type_code : "ALL",
    enabled: a.enabled,
  }));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "agents-index.json"),
    JSON.stringify({ total: index.length, agents: index }, null, 2),
    "utf8",
  );
  console.log(`📄 写出: output/agents-index.json`);

  // 3. 按域分文件
  const byDomain = {};
  for (const a of allAgents) {
    if (!byDomain[a.domain]) byDomain[a.domain] = [];
    byDomain[a.domain].push(a);
  }
  const byDomainDir = path.join(OUTPUT_DIR, "agents-by-domain");
  if (!fs.existsSync(byDomainDir)) fs.mkdirSync(byDomainDir);
  for (const [domain, agents] of Object.entries(byDomain)) {
    const outPath = path.join(byDomainDir, `${domain}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify({ domain, total: agents.length, agents }, null, 2),
      "utf8",
    );
  }
  console.log(`📂 按域文件写出至: output/agents-by-domain/ (${Object.keys(byDomain).length} 个域)`);

  // 4. 统计摘要
  const enabledCount = allAgents.filter((a) => a.enabled === true).length;
  const partialCount = allAgents.filter((a) => a.enabled === "partial").length;
  const disabledCount = allAgents.filter((a) => a.enabled === false).length;
  const domainStats = {};
  for (const a of allAgents) {
    domainStats[a.domain] = (domainStats[a.domain] || 0) + 1;
  }

  console.log("\n══════════════════════════════════════════");
  console.log(`  总计 Agent : ${allAgents.length}`);
  console.log(`  ✅ 已激活  : ${enabledCount}`);
  console.log(`  🟡 部分激活: ${partialCount}`);
  console.log(`  🔴 待激活  : ${disabledCount}`);
  console.log("  按域分布:");
  for (const [d, cnt] of Object.entries(domainStats)) {
    console.log(`    ${d.padEnd(20)} ${cnt}`);
  }
  console.log("══════════════════════════════════════════\n");
}

main();
