CREATE TABLE IF NOT EXISTS agv23_ingredient_lots (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 farm_id TEXT NOT NULL REFERENCES farms(id),
 purchase_id TEXT NOT NULL REFERENCES erp_records(id),
 ingredient_name TEXT NOT NULL,
 supplier_id TEXT,
 received_kg REAL NOT NULL CHECK(received_kg > 0),
 remaining_kg REAL NOT NULL CHECK(remaining_kg >= 0),
 unit_cost REAL NOT NULL DEFAULT 0 CHECK(unit_cost >= 0),
 received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(farm_id,purchase_id)
);
