-- Agrovelyx 2.0 - execute once on agrovelyx-prod (after blocks 1-14).
-- SQLite ADD COLUMN does not support IF NOT EXISTS.
ALTER TABLE app_users ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_username ON app_users(username) WHERE username IS NOT NULL;
CREATE TABLE IF NOT EXISTS auth_sessions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id),
 farm_id TEXT NOT NULL REFERENCES farms(id), token_hash TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS erp_records (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
 farm_id TEXT NOT NULL REFERENCES farms(id), record_type TEXT NOT NULL,
 payload_json TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES app_users(id),
 updated_by TEXT NOT NULL REFERENCES app_users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_erp_records_scope ON erp_records(farm_id,record_type,updated_at);
CREATE TABLE IF NOT EXISTS auth_login_attempts (
 username TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0,
 window_start TEXT NOT NULL, blocked_until TEXT
);
