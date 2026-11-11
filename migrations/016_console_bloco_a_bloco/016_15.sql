CREATE TRIGGER IF NOT EXISTS agv23_consumption_limit BEFORE INSERT ON agv23_feed_consumptions BEGIN
 SELECT CASE WHEN (SELECT COALESCE(SUM(quantity_kg),0) FROM agv23_feed_consumptions WHERE order_id=NEW.order_id) + NEW.quantity_kg > (SELECT planned_kg FROM agv23_production_orders WHERE id=NEW.order_id) + 0.000001
 THEN RAISE(ABORT,'Consumo maior que a quantidade produzida') END;
END;
