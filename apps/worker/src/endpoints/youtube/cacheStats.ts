import { contentJson, OpenAPIRoute } from "chanfana";
import { AppContext } from "../../types";
import { z } from "zod";
import { CACHE_TTL } from "./base";

export class YouTubeCacheStats extends OpenAPIRoute {
	public schema = {
		tags: ["YouTube", "Cache"],
		summary: "Get cache statistics",
		description: "Returns information about the YouTube cache configuration and status.",
		operationId: "youtube-cache-stats",
		responses: {
			"200": {
				description: "Cache statistics",
				...contentJson(
					z.object({
						success: z.boolean(),
						result: z.object({
							enabled: z.boolean(),
							backend: z.string(),
							ttl_seconds: z.number(),
							kv_namespace: z.string(),
						}),
					})
				),
			},
		},
	};

	public async handle(c: AppContext) {
		const kvEnabled = !!c.env.YOUTUBE_CACHE;

		return {
			success: true,
			result: {
				enabled: kvEnabled,
				backend: kvEnabled ? "cloudflare-kv" : "cloudflare-cache-api-only",
				ttl_seconds: CACHE_TTL,
				kv_namespace: kvEnabled ? "YOUTUBE_CACHE" : "not-configured",
			},
		};
	}
}

export class YouTubeCacheClear extends OpenAPIRoute {
	public schema = {
		tags: ["YouTube", "Cache"],
		summary: "Clear cache for a video",
		description: "Clears the cached metadata and captions for a specific video ID.",
		operationId: "youtube-cache-clear",
		request: {
			query: z.object({
				video: z.string().describe("YouTube video ID to clear from cache"),
			}),
		},
		responses: {
			"200": {
				description: "Cache cleared successfully",
				...contentJson(
					z.object({
						success: z.boolean(),
						message: z.string(),
						cleared_keys: z.array(z.string()),
					})
				),
			},
			"400": {
				description: "Invalid video ID",
				...contentJson(
					z.object({
						success: z.boolean(),
						error: z.string(),
					})
				),
			},
		},
	};

	public async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const videoId = data.query.video;

		// Validate video ID format
		if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
			return c.json(
				{
					success: false,
					error: "Invalid YouTube video ID format (must be 11 characters)",
				},
				400
			);
		}

		const clearedKeys: string[] = [];

		if (c.env.YOUTUBE_CACHE) {
			// Clear metadata cache
			const metadataKey = `youtube:metadata:${videoId}`;
			await c.env.YOUTUBE_CACHE.delete(metadataKey);
			clearedKeys.push(metadataKey);

			// Clear captions cache (common languages)
			const languages = ["en", "es", "fr", "de", "pt", "ja", "ko", "zh"];
			for (const lang of languages) {
				const captionsKey = `youtube:captions:${videoId}:${lang}`;
				await c.env.YOUTUBE_CACHE.delete(captionsKey);
				clearedKeys.push(captionsKey);
			}
		}

		return {
			success: true,
			message: c.env.YOUTUBE_CACHE
				? `Cache cleared for video ${videoId}`
				: "KV cache not configured - only Cloudflare edge cache is used",
			cleared_keys: clearedKeys,
		};
	}
}
