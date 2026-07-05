-- NRDL AI-ready reference dataset sync state (read-only layer; no personal data).
CREATE TABLE IF NOT EXISTS nrdl_reference_sync_state (
    sync_id TEXT PRIMARY KEY DEFAULT 'active',
    version_id TEXT NOT NULL,
    package_hash TEXT NOT NULL,
    source_label TEXT,
    subscription_url TEXT,
    consent_session_id TEXT NOT NULL,
    drug_count INTEGER NOT NULL DEFAULT 0,
    rule_count INTEGER NOT NULL DEFAULT 0,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
