-- Migration number: 0003    2025-12-10
-- Add timestamps column to transcripts table (JSON array of timestamp objects)

ALTER TABLE transcripts ADD COLUMN timestamps TEXT;
