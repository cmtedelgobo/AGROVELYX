CREATE TABLE IF NOT EXISTS agv23_operation_audit (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 farm_id TEXT NOT NULL REFERENCES farms(id),
 actor_id TEXT NOT NULL REFERENCES app_users(id),
 event TEXT NOT NULL,
 entity_id TEXT NOT NULL,
 details TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
