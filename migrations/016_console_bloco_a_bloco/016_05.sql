CREATE TABLE IF NOT EXISTS agv23_stock_ledger (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 farm_id TEXT NOT NULL REFERENCES farms(id),
 ingredient_name TEXT NOT NULL,
 ingredient_lot_id TEXT REFERENCES agv23_ingredient_lots(id),
 source_type TEXT NOT NULL,
 source_id TEXT NOT NULL,
 delta_kg REAL NOT NULL CHECK(delta_kg != 0),
 actor_user_id TEXT NOT NULL REFERENCES app_users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(farm_id,source_type,source_id,ingredient_lot_id)
);
