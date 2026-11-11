CREATE TABLE IF NOT EXISTS agv23_purchase_states (
 farm_id TEXT NOT NULL REFERENCES farms(id),
 record_id TEXT NOT NULL REFERENCES erp_records(id),
 status TEXT NOT NULL CHECK(status IN ('PENDENTE','RECEBIDO','CANCELADA')),
 changed_by TEXT NOT NULL REFERENCES app_users(id),
 changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(farm_id,record_id)
);
