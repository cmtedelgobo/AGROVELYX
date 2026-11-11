-- AGROVELYX 2.3 - MIGRACAO ADITIVA, IDEMPOTENTE
-- Execute apenas em banco com blocos 1-15 e erp_records presentes.
-- NAO apaga nem altera os dados anteriores.
CREATE TABLE IF NOT EXISTS agv23_daily_sequences (
 farm_id TEXT NOT NULL REFERENCES farms(id),
 kind TEXT NOT NULL,
 date_key TEXT NOT NULL,
 last_number INTEGER NOT NULL DEFAULT 0 CHECK(last_number >= 0),
 PRIMARY KEY(farm_id,kind,date_key)
);
CREATE TABLE IF NOT EXISTS agv23_purchase_states (
 farm_id TEXT NOT NULL REFERENCES farms(id),
 record_id TEXT NOT NULL REFERENCES erp_records(id),
 status TEXT NOT NULL CHECK(status IN ('PENDENTE','RECEBIDO','CANCELADA')),
 changed_by TEXT NOT NULL REFERENCES app_users(id),
 changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(farm_id,record_id)
);
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
CREATE INDEX IF NOT EXISTS agv23_lots_search ON agv23_ingredient_lots(farm_id,ingredient_name,received_at);
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
CREATE INDEX IF NOT EXISTS agv23_ledger_scope ON agv23_stock_ledger(farm_id,ingredient_name,created_at);
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
CREATE INDEX IF NOT EXISTS agv23_order_scope ON agv23_production_orders(farm_id,created_at);
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
CREATE INDEX IF NOT EXISTS agv23_feed_delivery_lot ON agv23_feed_deliveries(farm_id,destination_lot,delivered_at);
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
CREATE INDEX IF NOT EXISTS agv23_consumptions_by_lot ON agv23_feed_consumptions(farm_id,destination_lot,period_start);
CREATE TRIGGER IF NOT EXISTS agv23_consumption_limit BEFORE INSERT ON agv23_feed_consumptions BEGIN
 SELECT CASE WHEN (SELECT COALESCE(SUM(quantity_kg),0) FROM agv23_feed_consumptions WHERE order_id=NEW.order_id) + NEW.quantity_kg > (SELECT planned_kg FROM agv23_production_orders WHERE id=NEW.order_id) + 0.000001
 THEN RAISE(ABORT,'Consumo maior que a quantidade produzida') END;
END;
CREATE TRIGGER IF NOT EXISTS agv23_order_guard BEFORE INSERT ON agv23_stock_ledger
WHEN NEW.source_type='PRODUCAO'
BEGIN
 SELECT CASE WHEN (SELECT status FROM agv23_production_orders WHERE id=NEW.source_id AND farm_id=NEW.farm_id) <> 'PLANEJADA'
 THEN RAISE(ABORT,'Ordem ja confirmada ou cancelada') END;
END;
CREATE TABLE IF NOT EXISTS agv23_document_attachments (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 farm_id TEXT NOT NULL REFERENCES farms(id),
 entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL REFERENCES erp_records(id),
 doc_type TEXT NOT NULL CHECK(doc_type IN ('NFE','CTE','GTA','OUTRO')),
 file_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 250000),
 content_base64 TEXT NOT NULL,
 uploaded_by TEXT NOT NULL REFERENCES app_users(id),
 uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS agv23_docs_scope ON agv23_document_attachments(farm_id,entity_type,entity_id);
