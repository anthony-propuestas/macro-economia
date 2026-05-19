CREATE TABLE IF NOT EXISTS macro_data (
  country_code  TEXT    NOT NULL,
  country_name  TEXT    NOT NULL,
  indicator     TEXT    NOT NULL,
  year          INTEGER NOT NULL,
  value         REAL,
  source        TEXT,
  updated_at    TEXT    NOT NULL,
  PRIMARY KEY (country_code, indicator, year)
);

CREATE INDEX IF NOT EXISTS idx_country ON macro_data (country_code, indicator);

CREATE TABLE IF NOT EXISTS fetch_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  indicator     TEXT,
  status        TEXT,
  records       INTEGER,
  filtered_out  INTEGER DEFAULT 0,
  error_message TEXT,
  fetched_at    TEXT
);
