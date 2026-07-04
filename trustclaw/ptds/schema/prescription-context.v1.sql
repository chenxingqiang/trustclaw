-- Prescription context for AST rule evaluation (demo / init-captured fields).
CREATE TABLE IF NOT EXISTS prescription_context (
    user_id TEXT PRIMARY KEY,
    is_first_prescription INTEGER NOT NULL,
    institution_level INTEGER NOT NULL,
    is_specialist_physician INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES user_profile(user_id)
);
