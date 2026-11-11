CREATE TABLE IF NOT EXISTS agv23_daily_sequences (
 farm_id TEXT NOT NULL REFERENCES farms(id),
 kind TEXT NOT NULL,
 date_key TEXT NOT NULL,
 last_number INTEGER NOT NULL DEFAULT 0 CHECK(last_number >= 0),
 PRIMARY KEY(farm_id,kind,date_key)
);
