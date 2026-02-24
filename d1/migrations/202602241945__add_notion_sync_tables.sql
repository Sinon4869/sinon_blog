CREATE TABLE IF NOT EXISTS sync_map (
  post_id TEXT PRIMARY KEY,
  notion_page_id TEXT NOT NULL,
  sync_hash TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  last_sync_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_map_notion_page ON sync_map(notion_page_id);

CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL,
  post_id TEXT,
  notion_page_id TEXT,
  status TEXT NOT NULL,
  payload_json TEXT,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_events_created_at ON sync_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_events_status ON sync_events(status);
