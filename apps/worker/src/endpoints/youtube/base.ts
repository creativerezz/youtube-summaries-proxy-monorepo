import { z } from "zod";

// Upstream API configuration
export const UPSTREAM_API = "https://fetch.youtubesummaries.cc";

// Cache TTL in seconds (1 hour)
export const CACHE_TTL = 3600;

// YouTube video ID validation (11 characters)
export const videoIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{11}$/, {
	message: "Invalid YouTube video ID format",
});

// Video metadata response schema
export const VideoMetadataSchema = z.object({
	video_id: z.string(),
	title: z.string(),
	author: z.string(),
	author_url: z.string().optional(),
	thumbnail_url: z.string().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
});

// Captions response schema
export const CaptionsResponseSchema = z.object({
	video_id: z.string(),
	captions: z.string(),
	cached: z.boolean(),
	cache_age: z.number().optional(),
});

// Cache key generators
export function getMetadataCacheKey(videoId: string): string {
	return `youtube:metadata:${videoId}`;
}

export function getCaptionsCacheKey(videoId: string, languages: string): string {
	return `youtube:captions:${videoId}:${languages}`;
}

// Helper to extract video ID from URL or return as-is if already an ID
export function extractVideoId(input: string): string | null {
	// Already a video ID
	if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
		return input;
	}

	// Try to extract from URL
	const patterns = [
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
	];

	for (const pattern of patterns) {
		const match = input.match(pattern);
		if (match) {
			return match[1];
		}
	}

	return null;
}
