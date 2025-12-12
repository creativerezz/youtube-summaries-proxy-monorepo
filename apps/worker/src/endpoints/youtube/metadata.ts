import { contentJson, OpenAPIRoute } from "chanfana";
import { AppContext } from "../../types";
import { z } from "zod";
import {
	UPSTREAM_API,
	CACHE_TTL,
	VideoMetadataSchema,
	getMetadataCacheKey,
	extractVideoId,
} from "./base";

export class YouTubeMetadata extends OpenAPIRoute {
	public schema = {
		tags: ["YouTube"],
		summary: "Get video metadata with edge caching",
		description:
			"Fetches YouTube video metadata (title, author, thumbnail) with Cloudflare edge caching for fast global delivery.",
		operationId: "youtube-metadata",
		request: {
			query: z.object({
				video: z
					.string()
					.describe("YouTube video URL or 11-character video ID"),
			}),
		},
		responses: {
			"200": {
				description: "Video metadata retrieved successfully",
				...contentJson(
					z.object({
						success: z.boolean(),
						cached: z.boolean(),
						cache_age: z.number().optional(),
						result: VideoMetadataSchema,
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

		const cacheKey = getMetadataCacheKey(videoId);

		// Try to get from KV cache first (if available)
		let cached = false;
		let cacheAge: number | undefined;

		if (c.env.YOUTUBE_CACHE) {
			const cachedData = await c.env.YOUTUBE_CACHE.get(cacheKey, {
				type: "json",
				cacheTtl: 60, // Local cache for 60 seconds
			});

			if (cachedData) {
				const cacheEntry = cachedData as {
					data: z.infer<typeof VideoMetadataSchema>;
					timestamp: number;
				};
				cacheAge = Math.floor((Date.now() - cacheEntry.timestamp) / 1000);

				return {
					success: true,
					cached: true,
					cache_age: cacheAge,
					result: cacheEntry.data,
				};
			}
		}

		// Fetch from upstream API
		try {
			const upstreamUrl = `${UPSTREAM_API}/youtube/metadata?video=${videoId}`;
			const response = await fetch(upstreamUrl, {
				cf: {
					// Use Cloudflare cache for the fetch
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

			const metadata = (await response.json()) as z.infer<
				typeof VideoMetadataSchema
			>;

			// Store in KV cache
			if (c.env.YOUTUBE_CACHE) {
				await c.env.YOUTUBE_CACHE.put(
					cacheKey,
					JSON.stringify({
						data: metadata,
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
				result: metadata,
			};
		} catch (error) {
			return c.json(
				{
					success: false,
					error: `Failed to fetch metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
				502
			);
		}
	}
}
