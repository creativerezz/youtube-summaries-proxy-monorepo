import { z } from "zod";

// Re-export from youtube base for shared utilities
export { UPSTREAM_API, extractVideoId, videoIdSchema } from "../youtube/base";

// Timestamp entry schema (matches upstream API format)
export const TimestampSchema = z.object({
	text: z.string(),
	start: z.number(),
	duration: z.number(),
});

// Transcript database record schema
export const TranscriptSchema = z.object({
	video_id: z.string(),
	captions: z.string(),
	language: z.string(),
	title: z.string(),
	author: z.string(),
	thumbnail_url: z.string().nullable(),
	source_url: z.string(),
	timestamps: z.array(TimestampSchema).nullable(),
	fetch_count: z.number().int(),
	created_at: z.string(),
	last_accessed: z.string(),
});

export type Transcript = z.infer<typeof TranscriptSchema>;

// Request schema for POST /fetch
export const FetchRequestSchema = z.object({
	video: z.string().describe("YouTube video URL or 11-character video ID"),
	languages: z
		.string()
		.optional()
		.default("en")
		.describe("Comma-separated language codes"),
	force: z
		.boolean()
		.optional()
		.default(false)
		.describe("Force re-fetch even if transcript exists in database"),
});

// List query parameters
export const ListQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional().default(50),
	offset: z.coerce.number().int().min(0).optional().default(0),
});
