-- =====================================================================
-- PRAGMA 设定：保障热数据高频并发写入性能与数据完整性
-- =====================================================================
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- =====================================================================
-- 0. 数据来源与机构注册层 (Data Provenance Layer - 基石元数据)
-- =====================================================================
CREATE TABLE IF NOT EXISTS data_source_registry (
    source_id TEXT PRIMARY KEY,                     -- 唯一源标识（如 'COMPOUND_LAB', 'YUELING_BIO'）
    source_name TEXT NOT NULL,                      -- 数据源/机构名称
    source_category TEXT NOT NULL,                  -- 'HOSPITAL', 'CONSUMER_LAB', 'WEARABLE', 'GENETIC_SERVICE', 'PATIENT_SELF'
    organization_code TEXT,                         -- 统一机构代码/医疗机构代码
    reliability_level INTEGER NOT NULL DEFAULT 1,   -- 溯源可信等级：1=自测, 2=穿戴设备API, 3=临床或认证临检机构
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 1. 静态参考数据集层 (AI Ready Reference Dataset - 只读)
-- =====================================================================
CREATE TABLE IF NOT EXISTS nrdl_drug_registry (
    drug_id TEXT PRIMARY KEY,
    generic_name TEXT NOT NULL,                     -- 药品通用名
    active_ingredient TEXT NOT NULL,                -- 活性成分
    atc_code TEXT NOT NULL,                         -- ATC 编码
    is_negotiated_drug INTEGER DEFAULT 1,           -- 是否为国家医保谈判药品
    agreement_expiry_date DATE,                     -- 协议到期日
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nrdl_payment_rules (
    rule_id TEXT PRIMARY KEY,
    drug_id TEXT NOT NULL,                          -- 关联药品 ID
    rule_category TEXT NOT NULL,                    -- 规则大类（DIAGNOSIS/PRIOR_MED/LAB_LIMIT/SAFETY_LIMIT）
    target_key TEXT NOT NULL,                       -- 判定键（如 ICD-10 代码或生化代码）
    comparison_operator TEXT NOT NULL,              -- 比较操作符（>=, ==, <=, NOT_IN）
    comparison_value TEXT NOT NULL,                 -- 阈值
    alert_message TEXT NOT NULL,                    -- 阻断或提醒文案
    FOREIGN KEY(drug_id) REFERENCES nrdl_drug_registry(drug_id)
);

-- =====================================================================
-- 2. 冷数据层 (Cold Data - 个人画像及基因学组学数据)
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_profile (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                             -- 姓名
    birth_date DATE NOT NULL,                       -- 出生日期（YYYY-MM-DD）
    biological_sex INTEGER NOT NULL,                -- 生物学性别（1=男，2=女）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_genetic_variants (
    variant_id INTEGER PRIMARY KEY AUTOINCREMENT,
    rs_id TEXT NOT NULL,                            -- 突变点位（如 rs10305420）
    gene_symbol TEXT NOT NULL,                      -- 相关基因（如 GLP1R）
    genotype TEXT NOT NULL,                         -- 突变分型（如 CC, CT, TT）
    source_id TEXT,                                 -- 外键关联数据源
    source_file_hash TEXT,                          -- 原始文件哈希
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_id) REFERENCES data_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS user_genetic_traits (
    trait_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,                         -- 'DISEASE_RISK', 'TRAIT', 'CARRIER', 'NUTRITION'
    trait_code TEXT NOT NULL,                       -- 内部唯一代码
    trait_name_cn TEXT NOT NULL,                    -- 中文名称
    interpreted_result TEXT NOT NULL,               -- 解释结论
    risk_multiplier REAL,                           -- 风险倍数
    source_id TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_id) REFERENCES data_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS user_pgx_phenotypes (
    pgx_id INTEGER PRIMARY KEY AUTOINCREMENT,
    gene_symbol TEXT NOT NULL,                      -- 相关基因
    diplo_genotype TEXT,                            -- 基因双倍型（如 '*58:01'）
    drug_name_target TEXT NOT NULL,                 -- 目标药物（如 '别嘌醇'）
    phenotype_translation TEXT NOT NULL,            -- 翻译表型（如 '过敏高风险'）
    clinical_guideline_source TEXT,                 -- 指南来源
    recommendation_code TEXT NOT NULL,              -- 建议代码：'AVOID', 'ADJUST_DOSAGE', 'MONITOR', 'STANDARD'
    clinical_advice_text TEXT NOT NULL,             -- 用药指导文案
    source_id TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_id) REFERENCES data_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS device_registry (
    device_id TEXT PRIMARY KEY,                     -- 设备唯一标识（如 OURA_3_ZHOKE）
    brand_name TEXT NOT NULL,                       -- 厂商品牌
    model_name TEXT,                                -- 型号
    serial_number TEXT,                             -- 硬件序列号
    last_sync_timestamp TIMESTAMP,                  -- 最后一次 API 同步时间
    is_active INTEGER DEFAULT 1,                    -- 激活状态
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 3. 温数据层 (Warm Data - 循证临床快照、生化时序、几何成分)
-- =====================================================================
CREATE TABLE IF NOT EXISTS clinical_diagnoses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icd10_code TEXT NOT NULL,                       -- ICD-10 代码
    diagnosis_name TEXT NOT NULL,                   -- 诊断名称
    diagnosed_at DATE NOT NULL,                     -- 确诊日期
    source_id TEXT,
    is_active INTEGER DEFAULT 1,                    -- 1=有效, 0=已治愈
    provenance_level INTEGER NOT NULL DEFAULT 3,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_id) REFERENCES data_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS medication_history (
    med_id INTEGER PRIMARY KEY AUTOINCREMENT,
    drug_name TEXT NOT NULL,                        -- 药物名称
    atc_code TEXT NOT NULL,                         -- ATC 编码
    daily_dosage_mg REAL,                           -- 日给药剂量
    start_date DATE NOT NULL,                       -- 起始时间
    end_date DATE,                                  -- 停药时间（为 NULL 代表仍在服用）
    termination_reason TEXT,                        -- 停药原因（'INEFFECTIVE'=控制不佳, 'INTOLERANT'=不耐受）
    source_id TEXT,
    provenance_level INTEGER NOT NULL DEFAULT 3,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_id) REFERENCES data_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS lab_test_results (
    test_id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at TIMESTAMP NOT NULL,                 -- 化验时间
    test_code TEXT NOT NULL,                        -- 编码（'HbA1c', 'ApoB', 'Uric_Acid' 等）
    test_value REAL,                                -- 数值型测定值
    test_value_text TEXT,                           -- 文本型测定值
    test_unit TEXT,                                 -- 单位
    reference_range_low REAL,                       -- 正常下限
    reference_range_high REAL,                      -- 正常上限
    clinical_status TEXT,                           -- 临床分类状态（NORMAL, HIGH, LOW 等）
    percentile_rank_peer REAL,                      -- 同龄人百分位
    source_id TEXT,
    provenance_level INTEGER NOT NULL DEFAULT 3,
    source_document_hash TEXT,                      -- 原始报告防篡改哈希
    FOREIGN KEY(source_id) REFERENCES data_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS body_anthropometrics (
    body_id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at TIMESTAMP NOT NULL,
    height_m REAL NOT NULL,
    weight_kg REAL NOT NULL,
    fat_mass_kg REAL,
    bone_mass_kg REAL,
    muscle_mass_kg REAL,
    hydration_kg REAL,
    arm_circumference_cm REAL,
    neck_circumference_cm REAL,
    waist_circumference_cm REAL,
    hip_circumference_cm REAL,
    waist_to_hip_ratio REAL GENERATED ALWAYS AS (waist_circumference_cm / hip_circumference_cm) STORED,
    bmi REAL GENERATED ALWAYS AS (weight_kg / (height_m * height_m)) STORED,
    source_id TEXT,
    provenance_level INTEGER NOT NULL,
    recorder_user_id TEXT,
    FOREIGN KEY(source_id) REFERENCES data_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS daily_vitals (
    vital_id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at TIMESTAMP NOT NULL,
    systolic_bp_mmhg INTEGER NOT NULL,
    diastolic_bp_mmhg INTEGER NOT NULL,
    resting_heart_rate_bpm INTEGER,
    source_id TEXT,
    provenance_level INTEGER NOT NULL,
    recorder_user_id TEXT,
    FOREIGN KEY(source_id) REFERENCES data_source_registry(source_id)
);

-- =====================================================================
-- 4. 热数据层 (Hot Data - 穿戴流式、日度睡眠/运动汇总)
-- =====================================================================
CREATE TABLE IF NOT EXISTS wearable_sleep_metrics (
    sleep_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    recorded_date DATE NOT NULL,
    bedtime_start TEXT NOT NULL,
    bedtime_end TEXT NOT NULL,
    sleep_score INTEGER,                            -- 睡眠综合评分
    sleep_efficiency_pct REAL,                      -- 睡眠效率
    sleep_latency_sec INTEGER,                      -- 入睡潜伏期
    total_sleep_duration_sec INTEGER NOT NULL,      -- 总睡眠时长
    total_bedtime_sec INTEGER NOT NULL,
    deep_sleep_duration_sec INTEGER,
    rem_sleep_duration_sec INTEGER,
    light_sleep_duration_sec INTEGER,
    awake_time_sec INTEGER,
    respiratory_rate REAL,
    temperature_deviation_c REAL,                   -- 皮肤温度偏离基线值
    temperature_trend_deviation REAL,
    restfulness_score INTEGER,
    restless_sleep_sec INTEGER,
    sleep_timing_score INTEGER,
    resting_heart_rate_score INTEGER,               -- Oura RHR 评分
    rem_sleep_score INTEGER,                        -- Oura REM 评分
    deep_sleep_score INTEGER,                       -- Oura 深度睡眠评分
    sleep_latency_score INTEGER,                    -- Oura 入睡延迟评分
    temperature_score INTEGER,                      -- Oura 体温健康得分
    previous_night_score INTEGER,                   -- 前晚睡眠质量得分
    FOREIGN KEY(device_id) REFERENCES device_registry(device_id)
);

CREATE TABLE IF NOT EXISTS wearable_sleep_epochs (
    epoch_id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    start_timestamp TIMESTAMP NOT NULL,
    duration_sec INTEGER NOT NULL,
    sleep_state INTEGER NOT NULL,                   -- 0=醒，1=浅睡，2=深睡
    FOREIGN KEY(device_id) REFERENCES device_registry(device_id)
);

CREATE TABLE IF NOT EXISTS wearable_activity_metrics (
    activity_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    recorded_date DATE NOT NULL,
    steps INTEGER DEFAULT 0,
    equivalent_walking_dist_m REAL,
    total_burn_kcal INTEGER NOT NULL,
    active_burn_kcal INTEGER NOT NULL,
    average_met REAL,
    inactive_time_sec INTEGER,
    low_activity_time_sec INTEGER,
    medium_activity_time_sec INTEGER,
    high_activity_time_sec INTEGER,
    long_periods_inactivity INTEGER,
    activity_score INTEGER,
    meet_daily_targets_score INTEGER,
    elevation_m REAL DEFAULT 0.0,                   -- 累计爬楼高度
    floors_climbed INTEGER DEFAULT 0,
    swimming_laps INTEGER DEFAULT 0,
    hrv_balance_score INTEGER,                      -- Oura HRV 平衡度评分
    recovery_index_score INTEGER,                   -- Oura 恢复力指数评分
    FOREIGN KEY(device_id) REFERENCES device_registry(device_id)
);

CREATE TABLE IF NOT EXISTS wearable_cardiovascular_metrics (
    cardio_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    recorded_timestamp TIMESTAMP NOT NULL,
    average_resting_hr REAL,
    lowest_resting_hr REAL,
    average_hrv REAL,
    hrv_balance_score INTEGER,
    pwv_m_s REAL,                                   -- 脉搏波速度 PWV (m/s)
    spo2_pct REAL,                                  -- 血氧饱和度 (%)
    recovery_index_score INTEGER,
    readiness_score INTEGER,                        -- 综合体力准备度
    FOREIGN KEY(device_id) REFERENCES device_registry(device_id)
);

CREATE TABLE IF NOT EXISTS wearable_ecg_signals (
    ecg_id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    recorded_at TIMESTAMP NOT NULL,
    sampling_frequency_hz REAL NOT NULL,
    duration_sec REAL NOT NULL,
    wear_position INTEGER NOT NULL,                 -- 0=右手腕, 1=左手腕 等
    signal_unit TEXT NOT NULL,                      -- uV 或 mV
    signal_payload TEXT NOT NULL,                   -- 原始高频心电数据点文本序列
    FOREIGN KEY(device_id) REFERENCES device_registry(device_id)
);

-- =====================================================================
-- 5. 事件数据层 (Event Data - 表观遗传时钟、时序复测及环境损伤)
-- =====================================================================
CREATE TABLE IF NOT EXISTS epigenetic_clocks_summary (
    clock_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tested_at DATE NOT NULL,                        -- 采样日期
    reported_at DATE,                               -- 报告日期
    algorithm_provider TEXT NOT NULL,               -- 算法提供商
    biological_age REAL NOT NULL,                   -- 整体生理年龄
    chronological_age REAL NOT NULL,                -- 实际日历年龄
    aging_acceleration_factor REAL,                 -- 衰老加速度 AAF
    vitality_index INTEGER,                         -- 健康活力指数
    telomere_length_kb REAL,                        -- 端粒绝对长度 (kb)
    telomere_age REAL,                              -- 端粒预测生理年龄
    telomere_percentile REAL,                       -- 战胜同龄人占比
    source_id TEXT,
    provenance_level INTEGER DEFAULT 3,
    report_hash TEXT,
    FOREIGN KEY(source_id) REFERENCES data_source_registry(source_id)
);

CREATE TABLE IF NOT EXISTS epigenetic_organ_system_ages (
    organ_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    clock_record_id INTEGER NOT NULL,
    organ_code TEXT NOT NULL,                       -- 系统代码：'HEART', 'BRAIN', 'IMMUNE' 等
    epigenetic_age REAL NOT NULL,                   -- 分项系统生理年龄
    percentile_rank REAL,                           -- 击败同龄人占比
    FOREIGN KEY(clock_record_id) REFERENCES epigenetic_clocks_summary(clock_record_id)
);

CREATE TABLE IF NOT EXISTS epigenetic_loci_measurements (
    loci_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    clock_record_id INTEGER NOT NULL,
    loci_cg_id TEXT NOT NULL,                       -- 甲基化位点 CG 号
    gene_symbol TEXT NOT NULL,                      -- 相关基因
    measured_value REAL NOT NULL,                   -- 甲基化实测值 %
    ref_population_mean REAL NOT NULL,              -- 人群正常平均水平
    clinical_interpretation TEXT,
    FOREIGN KEY(clock_record_id) REFERENCES epigenetic_clocks_summary(clock_record_id)
);

CREATE TABLE IF NOT EXISTS immune_deconvolution_profiles (
    decon_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    clock_record_id INTEGER NOT NULL,
    immune_balance_index INTEGER NOT NULL,          -- 免疫平衡综合得分
    b_cell_pct REAL NOT NULL,                       -- B细胞比例 %
    nk_cell_pct REAL NOT NULL,                      -- NK细胞比例 %
    cd4_t_pct REAL NOT NULL,                        -- CD4+ T细胞 %
    cd8_t_pct REAL NOT NULL,                        -- CD8+ T细胞 %
    monocyte_pct REAL NOT NULL,                     -- 单核细胞 %
    neutrophil_pct REAL NOT NULL,                   -- 中性粒细胞 %
    cd4_cd8_ratio REAL NOT NULL,                    -- CD4+/CD8+ 比值
    FOREIGN KEY(clock_record_id) REFERENCES epigenetic_clocks_summary(clock_record_id)
);

CREATE TABLE IF NOT EXISTS lifestyle_environmental_exposures (
    exposure_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    clock_record_id INTEGER NOT NULL,
    exposure_type TEXT NOT NULL,                    -- 'TOBACCO', 'ALCOHOL', 'AIR_POLLUTION' 等
    exposure_score REAL NOT NULL,                   -- 损害得分
    ref_baseline_limit REAL NOT NULL,               -- 正常承受界限
    risk_classification TEXT NOT NULL,              -- 风险等级
    FOREIGN KEY(clock_record_id) REFERENCES epigenetic_clocks_summary(clock_record_id)
);

CREATE TABLE IF NOT EXISTS metabolic_monitoring_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at TIMESTAMP NOT NULL,
    monitoring_type TEXT NOT NULL,                  -- 'GLUCOSE' (血糖), 'KETONE' (血酮)
    measured_value REAL NOT NULL,
    measured_unit TEXT NOT NULL DEFAULT 'mmol/L',
    measurement_method TEXT NOT NULL,               -- 'SMBG', 'CGM'
    cgm_sensor_id TEXT,
    associated_meal_status TEXT,
    source_id TEXT,
    provenance_level INTEGER NOT NULL,
    device_id TEXT,
    FOREIGN KEY(device_id) REFERENCES device_registry(device_id),
    FOREIGN KEY(source_id) REFERENCES data_source_registry(source_id)
);

-- =====================================================================
-- 6. 工程索引优化层 (Indexing Layer - 高频及 Trace 检索加速)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_lab_source ON lab_test_results (source_id);
CREATE INDEX IF NOT EXISTS idx_clinical_source ON clinical_diagnoses (source_id);
CREATE INDEX IF NOT EXISTS idx_med_source ON medication_history (source_id);
CREATE INDEX IF NOT EXISTS idx_clock_source ON epigenetic_clocks_summary (source_id);
CREATE INDEX IF NOT EXISTS idx_genetic_traits_category ON user_genetic_traits (category);
CREATE INDEX IF NOT EXISTS idx_pgx_drug_lookup ON user_pgx_phenotypes (drug_name_target, recommendation_code);
CREATE INDEX IF NOT EXISTS idx_lab_test_code_date ON lab_test_results (test_code, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnoses_icd_active ON clinical_diagnoses (icd10_code, is_active);
CREATE INDEX IF NOT EXISTS idx_med_atc_date ON medication_history (atc_code, start_date);
CREATE INDEX IF NOT EXISTS idx_sleep_date ON wearable_sleep_metrics (recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_cardio_timestamp ON wearable_cardiovascular_metrics (recorded_timestamp DESC);

-- =====================================================================
-- 7. 安全合规决策视图 (v_glp1_nrdl_check_snapshot)
-- =====================================================================
CREATE VIEW IF NOT EXISTS v_glp1_nrdl_check_snapshot AS
SELECT 
    p.user_id,
    p.name,
    -- 1. 2型糖尿病诊断验证 (1=确诊且处于活动期, 0=未确诊)
    (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END 
     FROM clinical_diagnoses 
     WHERE icd10_code = 'E11' AND is_active = 1) AS has_t2dm,
    
    -- 2. 阶梯用药史判定 (0=无, 1=二甲双胍用后血糖不佳, 2=磺脲类用后不佳, 3=两者均控制不佳)
    (SELECT 
        CASE 
            WHEN SUM(CASE WHEN atc_code = 'A10BA02' AND termination_reason = 'INEFFECTIVE' THEN 1 ELSE 0 END) > 0 
                 AND SUM(CASE WHEN atc_code LIKE 'A10BB%' AND termination_reason = 'INEFFECTIVE' THEN 1 ELSE 0 END) > 0 THEN 3
            WHEN SUM(CASE WHEN atc_code = 'A10BA02' AND termination_reason = 'INEFFECTIVE' THEN 1 ELSE 0 END) > 0 THEN 1
            WHEN SUM(CASE WHEN atc_code LIKE 'A10BB%' AND termination_reason = 'INEFFECTIVE' THEN 1 ELSE 0 END) > 0 THEN 2
            ELSE 0
        END
     FROM medication_history) AS prior_oral_therapy_status,
     
    -- 3. 最新一次由临床级（Level 3）渠道出具的糖化血红蛋白测定值
    (SELECT test_value FROM lab_test_results 
     WHERE test_code = 'HbA1c' AND provenance_level = 3 
     ORDER BY recorded_at DESC LIMIT 1) AS latest_hospital_hba1c,
     
    -- 4. 伴随心血管疾病历史判定 (1=有确诊动脉硬化、冠心病或脑卒中, 0=无)
    (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END 
     FROM clinical_diagnoses 
     WHERE icd10_code IN ('I25', 'I21', 'I63') AND is_active = 1) AS has_cardiovascular_comorbidity,
     
    -- 5. 绝对禁忌症拦截 (1=检测到甲状腺髓样癌或重度胰腺炎，必须强制阻断不予报销, 0=安全)
    (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END 
     FROM clinical_diagnoses 
     WHERE icd10_code IN ('C73', 'K85') AND is_active = 1) AS has_absolute_contraindication
FROM user_profile p;

-- =====================================================================
-- 8. 核心种子数据装载 (Seed Data Loading)
-- =====================================================================
-- 8.1 预置数据源
INSERT OR IGNORE INTO data_source_registry (source_id, source_name, source_category, reliability_level) VALUES
('COMPOUND_LAB', 'Compound健康解读中心', 'CONSUMER_LAB', 3),
('YUELING_BIO', '悦龄Bi+o衰老评估中心', 'CONSUMER_LAB', 3),
('TIMERULER_LAB', '时光尺甲龄检测中心', 'CONSUMER_LAB', 3),
('MOFANG_GENETIC', '23魔方基因检测服务', 'GENETIC_SERVICE', 3),
('PEOPLES_HOSPITAL', '第一人民医院临检科', 'HOSPITAL', 3),
('OURA_RING_API', 'Oura Ring 穿戴数据接口', 'WEARABLE', 2),
('WITHINGS_SCALE_API', 'Withings 体脂秤同步接口', 'WEARABLE', 2),
('PATIENT_SELF_REPORT', '用户自测手填记录', 'PATIENT_SELF', 1);

-- 8.2 预置个人药物基因反应数据（决策依赖）
INSERT OR IGNORE INTO user_pgx_phenotypes 
(gene_symbol, diplo_genotype, drug_name_target, phenotype_translation, clinical_guideline_source, recommendation_code, clinical_advice_text, source_id)
VALUES 
('HLA-B', '*58:01', '别嘌醇', '严重皮肤过敏高风险（SJS/TEN）', 'CPIC', 'AVOID', '携带 HLA-B*58:01 阳性，发生致命性剥脱性皮炎风险高。临床禁用别嘌醇，建议更换为非布司他等其他降尿酸药物。', 'MOFANG_GENETIC'),
('CYP2C19', '中间代谢型', '氯吡格雷', '中间代谢型（药效不足）', 'CPIC', 'AVOID', 'CYP2C19 活性降低，氯吡格雷前体药物活化受阻。急性冠脉综合征支架术后患者有极高血栓复发风险。建议更换为替格瑞洛或普拉格雷。', 'MOFANG_GENETIC'),
('CYP3A5', 'CC', '他克莫司', '慢代谢型', 'CPIC', 'ADJUST_DOSAGE', 'CYP3A5 慢代谢，常规剂量下易发生血药浓度过高及肾毒性。建议在医生指导下，降低初始给药剂量。', 'MOFANG_GENETIC'),
('VKORC1/CYP2C9', 'TT/*3 AA', '华法林', '华法林敏感/慢清除', 'CPIC', 'ADJUST_DOSAGE', '东亚人群典型 VKORC1 TT 型导致华法林需求显著降低。常规剂量易引发严重出血风险。建议遵医嘱根据 Gage/IWPC 模型精确调低初始剂量。', 'MOFANG_GENETIC'),
('UGT1A1', '*6 携带', '伊立替康', '慢代谢（中性粒细胞减少高风险）', 'CPIC', 'MONITOR', 'UGT1A1 酶活性降低导致 SN-38 在体内蓄积。建议在化疗期间密切监测血常规中性粒细胞水平，必要时予以升白药支持。', 'MOFANG_GENETIC');