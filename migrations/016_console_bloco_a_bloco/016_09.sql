CREATE TABLE IF NOT EXISTS agv23_production_ingredients (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES agv23_production_orders(id),
 ingredient_lot_id TEXT NOT NULL REFERENCES agv23_ingredient_lots(id),
 ingredient_name TEXT NOT NULL,
 supplier_id TEXT,
 purchase_id TEXT NOT NULL,
 quantity_kg REAL NOT NULL CHECK(quantity_kg > 0),
 unit_cost REAL NOT NULL DEFAULT 0
);
