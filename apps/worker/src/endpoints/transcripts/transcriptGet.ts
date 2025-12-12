import { contentJson, OpenAPIRoute } from "chanfana";
import { AppContext } from "../../types";
import { z } from "zod";
import { videoIdSchema, TranscriptSchema, type Transcript } from "./base";

export class TranscriptGet extends OpenAPIRoute {
	public schema = {
		tags: ["Transcripts"],
		summary: "Get a stored transcript by video ID",
		description:
			"Retrieves a transcript from D1 storage. Updates last_accessed and increments fetch_count.",
		operationId: "transcript-get",
		request: {
			params: z.object({
				videoId: videoIdSchema,
			}),
		},
		responses: {
			"200": {
				description: "Transcript found",
				...contentJson(
					z.object({
						success: z.literal(true),
						result: TranscriptSchema,
					})
				),
			},
			"404": {
				description: "Transcript not found",
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
		const { videoId } = data.params;

		// Fetch and update in one query using RETURNING
		const transcript = await c.env.DB.prepare(
			`UPDATE transcripts
             SET fetch_count = fetch_count + 1,
                 last_accessed = CURRENT_TIMESTAMP
             WHERE video_id = ?
             RETURNING *`
		)
			.bind(videoId)
			.first<Transcript & { timestamps: string | null }>();

		if (!transcript) {
			return c.json(
				{
					success: false as const,
					error: `Transcript not found for video ID: ${videoId}`,
				},
				404
			);
		}

		return {
			success: true as const,
			result: {
				...transcript,
				timestamps: transcript.timestamps
					? JSON.parse(transcript.timestamps)
					: null,
			},
		};
	}
}
