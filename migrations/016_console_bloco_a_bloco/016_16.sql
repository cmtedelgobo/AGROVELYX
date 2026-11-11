CREATE TRIGGER IF NOT EXISTS agv23_order_guard BEFORE INSERT ON agv23_stock_ledger
WHEN NEW.source_type='PRODUCAO'
BEGIN
 SELECT CASE WHEN (SELECT status FROM agv23_production_orders WHERE id=NEW.source_id AND farm_id=NEW.farm_id) <> 'PLANEJADA'
 THEN RAISE(ABORT,'Ordem ja confirmada ou cancelada') END;
END;
