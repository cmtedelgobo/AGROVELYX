CREATE TABLE IF NOT EXISTS agv23_feed_consumptions (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 farm_id TEXT NOT NULL REFERENCES farms(id),
 order_id TEXT NOT NULL REFERENCES agv23_production_orders(id),
 destination_lot TEXT NOT NULL,
 period_start TEXT NOT NULL,
 period_end TEXT NOT NULL,
 quantity_kg REAL NOT NULL CHECK(quantity_kg > 0),
 recorded_by TEXT NOT NULL REFERENCES app_users(id),
 recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(period_end >= period_start)
);
