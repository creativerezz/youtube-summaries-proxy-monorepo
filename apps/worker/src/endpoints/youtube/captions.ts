import { contentJson, OpenAPIRoute } from "chanfana";
import { AppContext } from "../../types";
import { z } from "zod";
import {
	UPSTREAM_API,
	CACHE_TTL,
	getCaptionsCacheKey,
	extractVideoId,
} from "./base";

export class YouTubeCaptions extends OpenAPIRoute {
	public schema = {
		tags: ["YouTube"],
		summary: "Get video captions with edge caching",
		description:
			"Fetches YouTube video captions/transcripts with Cloudflare edge caching. Supports multiple languages.",
		operationId: "youtube-captions",
		request: {
			query: z.object({
				video: z
					.string()
					.describe("YouTube video URL or 11-character video ID"),
				languages: z
					.string()
					.optional()
					.default("en")
					.describe("Comma-separated language codes (e.g., 'en,es')"),
			}),
		},
		responses: {
			"200": {
				description: "Video captions retrieved successfully",
				...contentJson(
					z.object({
						success: z.boolean(),
						cached: z.boolean(),
						cache_age: z.number().optional(),
						result: z.object({
							video_id: z.string(),
							languages: z.string(),
							captions: z.string(),
						}),
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
			"502": {
				description: "Upstream API error",
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
		const videoInput = data.query.video;
		const languages = data.query.languages || "en";

		// Extract video ID
		const videoId = extractVideoId(videoInput);
		if (!videoId) {
			return c.json(
				{
					success: false,
					error: "Invalid YouTube video URL or ID",
				},
				400
			);
		}

		const cacheKey = getCaptionsCacheKey(videoId, languages);

		// Try to get from KV cache first
		if (c.env.YOUTUBE_CACHE) {
			const cachedData = await c.env.YOUTUBE_CACHE.get(cacheKey, {
				type: "json",
				cacheTtl: 60,
			});

			if (cachedData) {
				const cacheEntry = cachedData as {
					data: { captions: string };
					timestamp: number;
				};
				const cacheAge = Math.floor(
					(Date.now() - cacheEntry.timestamp) / 1000
				);

				return {
					success: true,
					cached: true,
					cache_age: cacheAge,
					result: {
						video_id: videoId,
						languages,
						captions: cacheEntry.data.captions,
					},
				};
			}
		}

		// Fetch from upstream API
		try {
			const upstreamUrl = `${UPSTREAM_API}/youtube/captions?video=${videoId}&languages=${encodeURIComponent(languages)}`;
			const response = await fetch(upstreamUrl, {
				cf: {
					cacheTtl: CACHE_TTL,
					cacheEverything: true,
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				return c.json(
					{
						success: false,
						error: `Upstream API error: ${response.status} - ${errorText}`,
					},
					502
				);
			}

			// Captions endpoint returns plain text
			const captions = await response.text();

			// Store in KV cache
			if (c.env.YOUTUBE_CACHE) {
				await c.env.YOUTUBE_CACHE.put(
					cacheKey,
					JSON.stringify({
						data: { captions },
						timestamp: Date.now(),
					}),
					{
						expirationTtl: CACHE_TTL,
					}
				);
			}

			return {
				success: true,
				cached: false,
				result: {
					video_id: videoId,
					languages,
					captions,
				},
			};
		} catch (error) {
			return c.json(
				{
					success: false,
					error: `Failed to fetch captions: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
				502
			);
		}
	}
}
