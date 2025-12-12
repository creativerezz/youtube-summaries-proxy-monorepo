import { contentJson, OpenAPIRoute } from "chanfana";
import { AppContext } from "../../types";
import { z } from "zod";
import {
	FetchRequestSchema,
	TranscriptSchema,
	UPSTREAM_API,
	extractVideoId,
	type Transcript,
} from "./base";

export class TranscriptFetch extends OpenAPIRoute {
	public schema = {
		tags: ["Transcripts"],
		summary: "Fetch transcript from upstream and store to D1",
		description: `
Fetches a YouTube transcript and stores it in D1 for persistence.
- If the transcript already exists and force=false, returns existing record (increments fetch_count)
- If force=true or doesn't exist, fetches from upstream API and upserts
        `,
		operationId: "transcript-fetch",
		request: {
			body: {
				content: {
					"application/json": {
						schema: FetchRequestSchema,
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Transcript fetched/retrieved successfully",
				...contentJson(
					z.object({
						success: z.literal(true),
						source: z.enum(["database", "upstream"]),
						result: TranscriptSchema,
					})
				),
			},
			"400": {
				description: "Invalid video ID",
				...contentJson(
					z.object({
						success: z.literal(false),
						error: z.string(),
					})
				),
			},
			"502": {
				description: "Upstream API error",
				...contentJson(
					z.object({
						success: z.literal(false),
						error: z.string(),
					})
				),
			},
		},
	};

	public async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { video, languages = "en", force = false } = data.body;

		// Extract video ID
		const videoId = extractVideoId(video);
		if (!videoId) {
			return c.json(
				{
					success: false as const,
					error: "Invalid YouTube video URL or ID",
				},
				400
			);
		}

		// Check D1 for existing transcript (unless force=true)
		if (!force) {
			const existing = await c.env.DB.prepare(
				`SELECT * FROM transcripts WHERE video_id = ?`
			)
				.bind(videoId)
				.first<Transcript & { timestamps: string | null }>();

			if (existing) {
				// Update fetch_count and last_accessed
				await c.env.DB.prepare(
					`UPDATE transcripts
                     SET fetch_count = fetch_count + 1,
                         last_accessed = CURRENT_TIMESTAMP
                     WHERE video_id = ?`
				)
					.bind(videoId)
					.run();

				return {
					success: true as const,
					source: "database" as const,
					result: {
						...existing,
						timestamps: existing.timestamps
							? JSON.parse(existing.timestamps)
							: null,
						fetch_count: existing.fetch_count + 1,
						last_accessed: new Date().toISOString(),
					},
				};
			}
		}

		// Fetch from upstream: captions + metadata + timestamps in parallel
		try {
			const [captionsResponse, metadataResponse, timestampsResponse] =
				await Promise.all([
					fetch(
						`${UPSTREAM_API}/youtube/captions?video=${videoId}&languages=${encodeURIComponent(languages)}`
					),
					fetch(`${UPSTREAM_API}/youtube/metadata?video=${videoId}`),
					fetch(
						`${UPSTREAM_API}/youtube/timestamps?video=${videoId}&languages=${encodeURIComponent(languages)}`
					),
				]);

			if (!captionsResponse.ok) {
				const errorText = await captionsResponse.text();
				return c.json(
					{
						success: false as const,
						error: `Failed to fetch captions: ${captionsResponse.status} - ${errorText}`,
					},
					502
				);
			}

			if (!metadataResponse.ok) {
				const errorText = await metadataResponse.text();
				return c.json(
					{
						success: false as const,
						error: `Failed to fetch metadata: ${metadataResponse.status} - ${errorText}`,
					},
					502
				);
			}

			// Timestamps are optional - don't fail if they're not available
			let timestamps: Array<{
				text: string;
				start: number;
				duration: number;
			}> | null = null;
			if (timestampsResponse.ok) {
				timestamps = await timestampsResponse.json();
			}

			const captions = await captionsResponse.text();
			const metadata = (await metadataResponse.json()) as {
				title: string;
				author_name: string;
				thumbnail_url?: string;
			};

			// Upsert to D1
			const now = new Date().toISOString();
			const timestampsJson = timestamps ? JSON.stringify(timestamps) : null;

			await c.env.DB.prepare(
				`INSERT INTO transcripts (video_id, captions, language, title, author, thumbnail_url, source_url, timestamps, fetch_count, created_at, last_accessed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT(video_id) DO UPDATE SET
                    captions = excluded.captions,
                    language = excluded.language,
                    title = excluded.title,
                    author = excluded.author,
                    thumbnail_url = excluded.thumbnail_url,
                    timestamps = excluded.timestamps,
                    fetch_count = fetch_count + 1,
                    last_accessed = excluded.last_accessed`
			)
				.bind(
					videoId,
					captions,
					languages.split(",")[0], // Store primary language
					metadata.title,
					metadata.author_name,
					metadata.thumbnail_url || null,
					video, // Original URL/ID provided
					timestampsJson,
					now,
					now
				)
				.run();

			const result: Transcript = {
				video_id: videoId,
				captions,
				language: languages.split(",")[0],
				title: metadata.title,
				author: metadata.author_name,
				thumbnail_url: metadata.thumbnail_url || null,
				source_url: video,
				timestamps,
				fetch_count: 1,
				created_at: now,
				last_accessed: now,
			};

			return {
				success: true as const,
				source: "upstream" as const,
				result,
			};
		} catch (error) {
			return c.json(
				{
					success: false as const,
					error: `Upstream fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
				502
			);
		}
	}
}
