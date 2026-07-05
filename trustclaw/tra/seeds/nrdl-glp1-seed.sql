-- GLP-1 (semaglutide) NRDL reference rules for TrustClaw TRA v1.1.
-- Loaded after schema v1.1 when nrdl tables are empty.

INSERT OR IGNORE INTO nrdl_drug_registry (
  drug_id,
  generic_name,
  active_ingredient,
  atc_code,
  is_negotiated_drug,
  agreement_expiry_date
) VALUES (
  'GLP1_SEMA',
  '司美格鲁肽',
  'semaglutide',
  'A10BJ06',
  1,
  '2026-12-31'
);

INSERT OR IGNORE INTO nrdl_payment_rules (
  rule_id,
  drug_id,
  rule_category,
  target_key,
  comparison_operator,
  comparison_value,
  alert_message
) VALUES
  ('GLP1_R01', 'GLP1_SEMA', 'DIAGNOSIS', 'has_t2dm', '==', '1', '需确诊且处于活动期的2型糖尿病（ICD-10 E11）'),
  ('GLP1_R02', 'GLP1_SEMA', 'LAB_LIMIT', 'latest_hospital_hba1c', '>=', '6.5', '临床级HbA1c需≥6.5%'),
  ('GLP1_R03', 'GLP1_SEMA', 'SAFETY_LIMIT', 'has_absolute_contraindication', '==', '0', '存在甲状腺髓样癌或重度胰腺炎禁忌'),
  ('GLP1_R04', 'GLP1_SEMA', 'PRIOR_MED', 'prior_oral_therapy_status', '>=', '1', '需有口服降糖药阶梯治疗史且控制不佳');
