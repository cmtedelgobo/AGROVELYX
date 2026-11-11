CREATE TABLE IF NOT EXISTS agv23_production_orders (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 farm_id TEXT NOT NULL REFERENCES farms(id),
 number TEXT NOT NULL,
 formula_record_id TEXT NOT NULL REFERENCES erp_records(id),
 formula_snapshot TEXT NOT NULL CHECK(json_valid(formula_snapshot)),
 destination_lot TEXT NOT NULL,
 phase TEXT,
 planned_kg REAL NOT NULL CHECK(planned_kg > 0),
 status TEXT NOT NULL DEFAULT 'PLANEJADA' CHECK(status IN('PLANEJADA','CONCLUIDA','CANCELADA')),
 created_by TEXT NOT NULL REFERENCES app_users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_by TEXT REFERENCES app_users(id),
 completed_at TEXT,
 UNIQUE(farm_id,number)
);
