CREATE TABLE IF NOT EXISTS post_drafts (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  background_image TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_drafts_user_post ON post_drafts(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_post_drafts_updated_at ON post_drafts(updated_at DESC);

CREATE TABLE IF NOT EXISTS post_draft_versions (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (draft_id) REFERENCES post_drafts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_draft_versions_draft_created ON post_draft_versions(draft_id, created_at DESC);
