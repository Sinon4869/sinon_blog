CREATE TABLE IF NOT EXISTS page_view_events (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  viewed_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_page_view_events_viewed_on ON page_view_events(viewed_on);
CREATE INDEX IF NOT EXISTS idx_page_view_events_path_viewed_on ON page_view_events(path, viewed_on);
CREATE INDEX IF NOT EXISTS idx_page_view_events_visitor_viewed_on ON page_view_events(visitor_id, viewed_on);
