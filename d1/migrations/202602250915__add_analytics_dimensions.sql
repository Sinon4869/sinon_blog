ALTER TABLE page_view_events ADD COLUMN post_id TEXT;
ALTER TABLE page_view_events ADD COLUMN source TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE page_view_events ADD COLUMN device TEXT NOT NULL DEFAULT 'desktop';

CREATE INDEX IF NOT EXISTS idx_page_view_events_post_viewed_on ON page_view_events(post_id, viewed_on);
CREATE INDEX IF NOT EXISTS idx_page_view_events_source_viewed_on ON page_view_events(source, viewed_on);
CREATE INDEX IF NOT EXISTS idx_page_view_events_device_viewed_on ON page_view_events(device, viewed_on);
