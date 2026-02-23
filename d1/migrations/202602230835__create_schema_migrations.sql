CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL UNIQUE,
  checksum TEXT,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
