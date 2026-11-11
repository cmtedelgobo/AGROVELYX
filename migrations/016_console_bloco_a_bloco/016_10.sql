CREATE TABLE IF NOT EXISTS agv23_feed_deliveries (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 farm_id TEXT NOT NULL REFERENCES farms(id),
 order_id TEXT NOT NULL REFERENCES agv23_production_orders(id),
 destination_lot TEXT NOT NULL,
 quantity_kg REAL NOT NULL CHECK(quantity_kg > 0),
 delivered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 delivered_by TEXT NOT NULL REFERENCES app_users(id)
);
