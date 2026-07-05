-- =====================================================================
-- TrustClaw TRA Schema Migration: domain_agents 注册表
-- version: v2.0  generated: 2026-07-05
-- 用途：供 Panel C 动态查询、授权 1000 个逻辑 Domain Agent
-- 导入方式：Panel A → 导入 SQL Migration → 选择本文件
-- =====================================================================

-- 1. 创建表
CREATE TABLE IF NOT EXISTS domain_agents (
    agent_id        TEXT PRIMARY KEY,
    agent_name      TEXT NOT NULL,
    domain          TEXT NOT NULL,
    subdomain       TEXT,
    region          TEXT NOT NULL DEFAULT '全国',
    insurance_type  TEXT NOT NULL DEFAULT 'ALL',
    enabled         TEXT NOT NULL DEFAULT 'false',
    tra_scopes     TEXT NOT NULL DEFAULT 'tra.read,tra.chat,panel.browse,panel.audit',
    tra_write      INTEGER NOT NULL DEFAULT 0,
    pack_id         TEXT,
    pack_version    TEXT DEFAULT '2.0.0',
    registered_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(pack_id) REFERENCES domain_agent_packs(pack_id) ON DELETE SET NULL
);

-- 2. Pack 注册表（对应工作区 trustclaw-agents/ 下的 agent.pack.json）
CREATE TABLE IF NOT EXISTS domain_agent_packs (
    pack_id         TEXT PRIMARY KEY,
    display_name_zh TEXT NOT NULL,
    display_name_en TEXT NOT NULL,
    domain          TEXT NOT NULL,
    pack_path       TEXT NOT NULL,
    version         TEXT NOT NULL DEFAULT '1.0.0',
    has_write       INTEGER NOT NULL DEFAULT 0,
    registered_at   TEXT DEFAULT (datetime('now'))
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_domain_agents_domain    ON domain_agents (domain);
CREATE INDEX IF NOT EXISTS idx_domain_agents_region    ON domain_agents (region);
CREATE INDEX IF NOT EXISTS idx_domain_agents_enabled   ON domain_agents (enabled);
CREATE INDEX IF NOT EXISTS idx_domain_agents_pack      ON domain_agents (pack_id);

-- 4. 注册 10 个 Domain Agent Pack
INSERT OR REPLACE INTO domain_agent_packs VALUES
('tra-outpatient',         '门诊医保报销',         'Outpatient Insurance Reimbursement',   'outpatient',         '/home/node/.openclaw/workspace/trustclaw-agents/tra-outpatient',         '1.0.0', 1, datetime('now')),
('tra-inpatient',          '住院医保结算',         'Inpatient Insurance Settlement',        'inpatient',          '/home/node/.openclaw/workspace/trustclaw-agents/tra-inpatient',           '1.0.0', 1, datetime('now')),
('tra-pharmacy',           '定点药店购药',         'Designated Pharmacy Drug Purchase',     'pharmacy',           '/home/node/.openclaw/workspace/trustclaw-agents/tra-pharmacy',            '1.0.0', 0, datetime('now')),
('tra-cross-region',       '异地就医报销',         'Cross-Region Medical Reimbursement',    'cross-region',       '/home/node/.openclaw/workspace/trustclaw-agents/tra-cross-region',        '1.0.0', 0, datetime('now')),
('tra-audit',              '医保稽核',             'Insurance Audit & Fraud Detection',     'audit',              '/home/node/.openclaw/workspace/trustclaw-agents/tra-audit',               '1.0.0', 0, datetime('now')),
('tra-drg',                'DRG/DIP分组与结算',    'DRG/DIP Grouping & Settlement',         'drg',                '/home/node/.openclaw/workspace/trustclaw-agents/tra-drg',                 '1.0.0', 0, datetime('now')),
('tra-maternity',          '生育保险',             'Maternity Insurance',                   'maternity',          '/home/node/.openclaw/workspace/trustclaw-agents/tra-maternity',           '1.0.0', 1, datetime('now')),
('tra-catastrophic',       '大病保险',             'Catastrophic Illness Insurance',        'catastrophic',       '/home/node/.openclaw/workspace/trustclaw-agents/tra-catastrophic',        '1.0.0', 0, datetime('now')),
('tra-medical-assistance', '医疗救助',             'Medical Financial Assistance',          'medical-assistance', '/home/node/.openclaw/workspace/trustclaw-agents/tra-medical-assistance',  '1.0.0', 0, datetime('now')),
('tra-tcm',                '中医药医保报销',       'TCM Insurance Reimbursement',           'tcm',                '/home/node/.openclaw/workspace/trustclaw-agents/tra-tcm',                 '1.0.0', 0, datetime('now'));

-- 5. 批量写入全国版基础 Agent（102 条）
-- 门诊 12 个
INSERT OR REPLACE INTO domain_agents (agent_id,agent_name,domain,subdomain,enabled,tra_scopes,tra_write,pack_id) VALUES
('op-001','门诊参保资格核验','outpatient','eligibility','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient'),
('op-002','门诊统筹待遇资格判断','outpatient','benefit-category','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient'),
('op-003','门诊慢特病病种匹配','outpatient','chronic-disease','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient'),
('op-004','门诊NRDL药品目录核验','outpatient','drug-catalog','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient'),
('op-005','门诊诊疗项目合规审查','outpatient','procedure-compliance','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient'),
('op-006','门诊自付比例计算','outpatient','cost-sharing','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient'),
('op-007','门诊起付线核定','outpatient','deductible','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient'),
('op-008','门诊统筹基金支付计算','outpatient','fund-payment','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient'),
('op-009','门诊年度封顶线判断','outpatient','annual-cap','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient'),
('op-010','门诊处方合规审核','outpatient','prescription-compliance','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient'),
('op-011','门诊实时费用结算','outpatient','settlement','false','tra.read,tra.chat,panel.browse,panel.audit,panel.ledger',1,'tra-outpatient'),
('op-012','门诊年度费用统计汇总','outpatient','statistics','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-outpatient');

-- 住院 12 个
INSERT OR REPLACE INTO domain_agents (agent_id,agent_name,domain,subdomain,enabled,tra_scopes,tra_write,pack_id) VALUES
('ip-001','住院参保资格核验','inpatient','eligibility','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient'),
('ip-002','住院前置审批判断','inpatient','pre-authorization','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient'),
('ip-003','住院起付线核定','inpatient','deductible','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient'),
('ip-004','住院费用分段计算','inpatient','cost-segmentation','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient'),
('ip-005','住院报销比例匹配','inpatient','reimbursement-ratio','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient'),
('ip-006','住院药品费用审核','inpatient','drug-audit','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient'),
('ip-007','住院耗材费用审核','inpatient','consumables-audit','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient'),
('ip-008','住院手术费用核算','inpatient','surgery-billing','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient'),
('ip-009','住院高值耗材预审','inpatient','high-value-items','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient'),
('ip-010','住院病案首页核验','inpatient','medical-record','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient'),
('ip-011','住院出院结算核算','inpatient','discharge-settlement','false','tra.read,tra.chat,panel.browse,panel.audit,panel.ledger',1,'tra-inpatient'),
('ip-012','住院费用清单核对','inpatient','bill-reconciliation','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-inpatient');

-- 药店 10 个
INSERT OR REPLACE INTO domain_agents (agent_id,agent_name,domain,subdomain,enabled,tra_scopes,tra_write,pack_id) VALUES
('ph-001','定点药店资格验证','pharmacy','pharmacy-eligibility','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-pharmacy'),
('ph-002','参保人购药资格核验','pharmacy','buyer-eligibility','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-pharmacy'),
('ph-003','处方合规性审核','pharmacy','prescription-compliance','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-pharmacy'),
('ph-004','NRDL乙类药品核验','pharmacy','drug-category-b','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-pharmacy'),
('ph-005','慢病专项购药资格判断','pharmacy','chronic-drug-benefit','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-pharmacy'),
('ph-006','购药数量频次限制核查','pharmacy','quantity-frequency-check','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-pharmacy'),
('ph-007','特殊药品购买审批','pharmacy','special-drug-approval','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-pharmacy'),
('ph-008','药店统筹基金支付计算','pharmacy','fund-payment','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-pharmacy'),
('ph-009','药店医保结算核对','pharmacy','settlement-reconciliation','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-pharmacy'),
('ph-010','药店费用汇总上传','pharmacy','billing-upload','false','tra.read,tra.chat,panel.browse,panel.audit,panel.ledger',1,'tra-pharmacy');

-- 异地 10 个
INSERT OR REPLACE INTO domain_agents (agent_id,agent_name,domain,subdomain,enabled,tra_scopes,tra_write,pack_id) VALUES
('cr-001','异地就医备案状态核验','cross-region','registration-status','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-cross-region'),
('cr-002','异地就医报销政策匹配','cross-region','policy-matching','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-cross-region'),
('cr-003','跨省直接结算资格核验','cross-region','direct-settlement','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-cross-region'),
('cr-004','异地门诊费用审核','cross-region','outpatient-review','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-cross-region'),
('cr-005','异地住院费用审核','cross-region','inpatient-review','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-cross-region'),
('cr-006','异地急诊认定判断','cross-region','emergency-recognition','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-cross-region'),
('cr-007','异地转诊审批验证','cross-region','referral-verification','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-cross-region'),
('cr-008','异地医疗机构等级核验','cross-region','hospital-level-check','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-cross-region'),
('cr-009','异地手工报销费用计算','cross-region','manual-reimbursement','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-cross-region'),
('cr-010','跨省结算差异处理','cross-region','cross-province-reconciliation','false','tra.read,tra.chat,panel.browse,panel.audit,panel.ledger',1,'tra-cross-region');

-- 稽核 12 个
INSERT OR REPLACE INTO domain_agents (agent_id,agent_name,domain,subdomain,enabled,tra_scopes,tra_write,pack_id) VALUES
('au-001','就诊记录真实性核查','audit','record-authenticity','false','tra.read,tra.chat,panel.browse,panel.audit,panel.compliance',0,'tra-audit'),
('au-002','重复收费智能检测','audit','duplicate-charge','false','tra.read,tra.chat,panel.browse,panel.audit,panel.compliance',0,'tra-audit'),
('au-003','超量开药识别','audit','over-prescription','partial','tra.read,tra.chat,panel.browse,panel.audit,panel.compliance',0,'tra-audit'),
('au-004','挂床住院核查','audit','ghost-hospitalization','false','tra.read,tra.chat,panel.browse,panel.audit,panel.compliance',0,'tra-audit'),
('au-005','分解住院识别','audit','split-hospitalization','partial','tra.read,tra.chat,panel.browse,panel.audit,panel.compliance',0,'tra-audit'),
('au-006','违规使用医保卡检测','audit','card-misuse','false','tra.read,tra.chat,panel.browse,panel.audit,panel.compliance',0,'tra-audit'),
('au-007','欺诈骗保智能预警','audit','fraud-detection','false','tra.read,tra.chat,panel.browse,panel.audit,panel.compliance',0,'tra-audit'),
('au-008','医疗费用异常评分','audit','expense-anomaly-score','false','tra.read,tra.chat,panel.browse,panel.audit,panel.compliance',0,'tra-audit'),
('au-009','医生行为分析','audit','physician-behavior','false','tra.read,tra.chat,panel.browse,panel.audit,panel.compliance',0,'tra-audit'),
('au-010','定点机构稽核评级','audit','institution-rating','false','tra.read,tra.chat,panel.browse,panel.audit,panel.compliance',0,'tra-audit'),
('au-011','稽核案件队列管理','audit','case-queue-management','false','tra.read,tra.chat,panel.browse,panel.audit,panel.ledger,panel.compliance',1,'tra-audit'),
('au-012','稽核结果反馈处理','audit','result-feedback','false','tra.read,tra.chat,panel.browse,panel.audit,panel.ledger,panel.compliance',1,'tra-audit');

-- DRG 10 个
INSERT OR REPLACE INTO domain_agents (agent_id,agent_name,domain,subdomain,enabled,tra_scopes,tra_write,pack_id) VALUES
('drg-001','主诊断ICD编码核验','drg','primary-diagnosis','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-drg'),
('drg-002','手术操作编码核验','drg','procedure-coding','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-drg'),
('drg-003','MDC主要诊断分类匹配','drg','mdc-matching','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-drg'),
('drg-004','ADRG相邻诊断分组匹配','drg','adrg-matching','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-drg'),
('drg-005','DRG分组规则最终判定','drg','drg-final-grouping','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-drg'),
('drg-006','DRG权重系数查询','drg','drg-weight-lookup','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-drg'),
('drg-007','DRG基准费率核定','drg','drg-rate-determination','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-drg'),
('drg-008','DRG结算差异分析','drg','drg-variance-analysis','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-drg'),
('drg-009','DIP病种分值计算','drg','dip-calculation','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-drg'),
('drg-010','DRG/DIP绩效评估报告','drg','performance-report','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-drg');

-- 生育 10 个
INSERT OR REPLACE INTO domain_agents (agent_id,agent_name,domain,subdomain,enabled,tra_scopes,tra_write,pack_id) VALUES
('mt-001','生育险参保状态核验','maternity','enrollment-check','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-maternity'),
('mt-002','生育资格认定','maternity','eligibility-recognition','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-maternity'),
('mt-003','产前检查报销','maternity','prenatal-reimbursement','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-maternity'),
('mt-004','分娩费用结算','maternity','delivery-settlement','false','tra.read,tra.chat,panel.browse,panel.audit,panel.ledger',1,'tra-maternity'),
('mt-005','生育津贴计算','maternity','maternity-allowance','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-maternity'),
('mt-006','流产/计划生育手术报销','maternity','abortion-family-planning','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-maternity'),
('mt-007','新生儿参保登记','maternity','newborn-enrollment','false','tra.read,tra.chat,panel.browse,panel.audit,panel.ledger',1,'tra-maternity'),
('mt-008','多胎补贴核定','maternity','multiple-birth-supplement','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-maternity'),
('mt-009','生育医疗费手工报销','maternity','manual-reimbursement','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-maternity'),
('mt-010','辅助生殖技术报销','maternity','art-reimbursement','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-maternity');

-- 大病 10 个
INSERT OR REPLACE INTO domain_agents (agent_id,agent_name,domain,subdomain,enabled,tra_scopes,tra_write,pack_id) VALUES
('cb-001','大病保险触发判断','catastrophic','trigger-check','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-catastrophic'),
('cb-002','大病个人负担累积计算','catastrophic','self-paid-accumulation','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-catastrophic'),
('cb-003','大病报销比例匹配','catastrophic','reimbursement-ratio','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-catastrophic'),
('cb-004','大病年度封顶核定','catastrophic','annual-cap','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-catastrophic'),
('cb-005','大病与基本医保协同结算','catastrophic','coordination-settlement','false','tra.read,tra.chat,panel.browse,panel.audit,panel.ledger',1,'tra-catastrophic'),
('cb-006','大病特殊病种认定','catastrophic','special-disease-recognition','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-catastrophic'),
('cb-007','大病保险二次报销计算','catastrophic','second-reimbursement','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-catastrophic'),
('cb-008','大病跨年度费用处理','catastrophic','cross-year-handling','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-catastrophic'),
('cb-009','重大疾病单病种结算','catastrophic','critical-illness-settlement','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-catastrophic'),
('cb-010','大病保险运营机构协议管理','catastrophic','operator-agreement','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-catastrophic');

-- 救助 8 个
INSERT OR REPLACE INTO domain_agents (agent_id,agent_name,domain,subdomain,enabled,tra_scopes,tra_write,pack_id) VALUES
('ma-001','医疗救助资格认定','medical-assistance','eligibility-recognition','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-medical-assistance'),
('ma-002','救助优先支付判断','medical-assistance','priority-payment','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-medical-assistance'),
('ma-003','门诊救助限额核定','medical-assistance','outpatient-assistance-cap','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-medical-assistance'),
('ma-004','住院救助比例计算','medical-assistance','inpatient-assistance-ratio','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-medical-assistance'),
('ma-005','医疗救助与基本医保衔接','medical-assistance','insurance-linkage','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-medical-assistance'),
('ma-006','慈善救助协同结算','medical-assistance','charity-coordination','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-medical-assistance'),
('ma-007','救助申请材料核验','medical-assistance','application-document-check','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-medical-assistance'),
('ma-008','救助年度费用汇总','medical-assistance','annual-summary','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-medical-assistance');

-- 中医 8 个
INSERT OR REPLACE INTO domain_agents (agent_id,agent_name,domain,subdomain,enabled,tra_scopes,tra_write,pack_id) VALUES
('tc-001','中医诊疗项目目录核验','tcm','tcm-procedure-catalog','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-tcm'),
('tc-002','中药饮片报销资格判断','tcm','herbal-decoction-reimbursement','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-tcm'),
('tc-003','中成药NRDL核验','tcm','patent-medicine-nrdl','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-tcm'),
('tc-004','针灸推拿项目报销','tcm','acupuncture-massage','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-tcm'),
('tc-005','中医特色技术报销比例','tcm','tcm-special-technology','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-tcm'),
('tc-006','中医住院诊疗合规审核','tcm','tcm-inpatient-compliance','partial','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-tcm'),
('tc-007','中医院等级及协议核验','tcm','tcm-hospital-verification','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-tcm'),
('tc-008','中医药报销年度统计','tcm','tcm-annual-statistics','false','tra.read,tra.chat,panel.browse,panel.audit',0,'tra-tcm');

-- 6. 验证
SELECT domain, COUNT(*) as agent_count, SUM(CASE WHEN enabled='partial' THEN 1 ELSE 0 END) as partial_count
FROM domain_agents
GROUP BY domain
ORDER BY agent_count DESC;
