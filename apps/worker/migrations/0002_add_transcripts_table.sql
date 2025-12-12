-- Migration number: 0002    2025-12-09
-- Add transcripts table for persistent YouTube transcript storage

CREATE TABLE IF NOT EXISTS transcripts (
    video_id TEXT PRIMARY KEY NOT NULL CHECK(length(video_id) = 11),
    captions TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    thumbnail_url TEXT,
    source_url TEXT NOT NULL,
    fetch_count INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for listing/ordering by last_accessed
CREATE INDEX idx_transcripts_last_accessed ON transcripts(last_accessed DESC);

-- Index for listing/ordering by created_at
CREATE INDEX idx_transcripts_created_at ON transcripts(created_at DESC);
