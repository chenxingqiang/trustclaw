-- Medication compliance judgment standards (external NRDL AST handshake packages).
-- Imported only after explicit user consent; replaces active AST ruleset for evaluation.

CREATE TABLE IF NOT EXISTS medication_compliance_standards (
    standard_id TEXT PRIMARY KEY,
    schema_uri TEXT,
    release_date TEXT,
    publisher TEXT NOT NULL,
    publisher_signature TEXT,
    ruleset_hash TEXT NOT NULL,
    source_file_hash TEXT NOT NULL,
    source_label TEXT,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    consent_session_id TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS medication_compliance_ast_rules (
    rule_id TEXT NOT NULL,
    standard_id TEXT NOT NULL,
    drug_id TEXT NOT NULL,
    drug_name TEXT NOT NULL,
    ast_root_json TEXT NOT NULL,
    PRIMARY KEY (rule_id, standard_id),
    FOREIGN KEY(standard_id) REFERENCES medication_compliance_standards(standard_id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_ast_drug
    ON medication_compliance_ast_rules (standard_id, drug_id);

INSERT OR IGNORE INTO data_source_registry (source_id, source_name, source_category, reliability_level) VALUES
('NRDL_EXTERNAL', '国家医保谈判目录外部标准包', 'REGULATORY_REFERENCE', 1);
