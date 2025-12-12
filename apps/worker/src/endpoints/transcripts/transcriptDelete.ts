import { contentJson, OpenAPIRoute } from "chanfana";
import { AppContext } from "../../types";
import { z } from "zod";
import { videoIdSchema, TranscriptSchema, type Transcript } from "./base";

export class TranscriptDelete extends OpenAPIRoute {
	public schema = {
		tags: ["Transcripts"],
		summary: "Delete a stored transcript",
		description:
			"Removes a transcript from D1 storage. Returns the deleted record.",
		operationId: "transcript-delete",
		request: {
			params: z.object({
				videoId: videoIdSchema,
			}),
		},
		responses: {
			"200": {
				description: "Transcript deleted",
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

		// Delete and return the deleted record
		const deleted = await c.env.DB.prepare(
			`DELETE FROM transcripts WHERE video_id = ? RETURNING *`
		)
			.bind(videoId)
			.first<Transcript & { timestamps: string | null }>();

		if (!deleted) {
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
				...deleted,
				timestamps: deleted.timestamps
					? JSON.parse(deleted.timestamps)
					: null,
			},
		};
	}
}
