import { contentJson, OpenAPIRoute } from "chanfana";
import { AppContext } from "../../types";
import { z } from "zod";
import { ListQuerySchema, TranscriptSchema, type Transcript } from "./base";

export class TranscriptList extends OpenAPIRoute {
	public schema = {
		tags: ["Transcripts"],
		summary: "List all stored transcripts with pagination",
		description:
			"Returns a paginated list of stored transcripts ordered by last_accessed. Does NOT update fetch_count or last_accessed.",
		operationId: "transcript-list",
		request: {
			query: ListQuerySchema,
		},
		responses: {
			"200": {
				description: "List of transcripts",
				...contentJson(
					z.object({
						success: z.literal(true),
						result: z.array(TranscriptSchema),
						pagination: z.object({
							limit: z.number(),
							offset: z.number(),
							total: z.number(),
						}),
					})
				),
			},
		},
	};

	public async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { limit, offset } = data.query;

		// Get total count
		const countResult = await c.env.DB.prepare(
			`SELECT COUNT(*) as total FROM transcripts`
		).first<{ total: number }>();
		const total = countResult?.total || 0;

		// Get paginated results ordered by last_accessed DESC
		const results = await c.env.DB.prepare(
			`SELECT * FROM transcripts
             ORDER BY last_accessed DESC
             LIMIT ? OFFSET ?`
		)
			.bind(limit, offset)
			.all<Transcript & { timestamps: string | null }>();

		// Parse timestamps JSON for each result
		const parsedResults = (results.results || []).map((r) => ({
			...r,
			timestamps: r.timestamps ? JSON.parse(r.timestamps) : null,
		}));

		return {
			success: true as const,
			result: parsedResults,
			pagination: {
				limit,
				offset,
				total,
			},
		};
	}
}
