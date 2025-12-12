import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Helper to seed a transcript directly into D1
async function seedTranscript(data: Partial<{
	video_id: string;
	captions: string;
	language: string;
	title: string;
	author: string;
	thumbnail_url: string | null;
	source_url: string;
	fetch_count: number;
}>) {
	const defaults = {
		video_id: "dQw4w9WgXcQ",
		captions: "Test captions content for testing purposes",
		language: "en",
		title: "Test Video Title",
		author: "Test Author",
		thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
		source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		fetch_count: 1,
	};
	const record = { ...defaults, ...data };

	await env.DB.prepare(
		`INSERT INTO transcripts (video_id, captions, language, title, author, thumbnail_url, source_url, fetch_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			record.video_id,
			record.captions,
			record.language,
			record.title,
			record.author,
			record.thumbnail_url,
			record.source_url,
			record.fetch_count
		)
		.run();

	return record;
}

describe("Transcripts API Integration Tests", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		// Clear transcripts table before each test
		await env.DB.prepare("DELETE FROM transcripts").run();
	});

	describe("GET /transcripts", () => {
		it("should return empty list when no transcripts exist", async () => {
			const response = await SELF.fetch("http://local.test/transcripts");
			const body = await response.json<{
				success: boolean;
				result: any[];
				pagination: { limit: number; offset: number; total: number };
			}>();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.result).toEqual([]);
			expect(body.pagination.total).toBe(0);
		});

		it("should return paginated list of transcripts", async () => {
			await seedTranscript({ video_id: "video111111" });
			await seedTranscript({ video_id: "video222222" });
			await seedTranscript({ video_id: "video333333" });

			const response = await SELF.fetch(
				"http://local.test/transcripts?limit=2&offset=0"
			);
			const body = await response.json<{
				success: boolean;
				result: any[];
				pagination: { limit: number; offset: number; total: number };
			}>();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.result.length).toBe(2);
			expect(body.pagination.total).toBe(3);
			expect(body.pagination.limit).toBe(2);
			expect(body.pagination.offset).toBe(0);
		});

		it("should support offset pagination", async () => {
			await seedTranscript({ video_id: "video111111" });
			await seedTranscript({ video_id: "video222222" });
			await seedTranscript({ video_id: "video333333" });

			const response = await SELF.fetch(
				"http://local.test/transcripts?limit=10&offset=2"
			);
			const body = await response.json<{
				success: boolean;
				result: any[];
				pagination: { limit: number; offset: number; total: number };
			}>();

			expect(response.status).toBe(200);
			expect(body.result.length).toBe(1);
			expect(body.pagination.offset).toBe(2);
		});
	});

	describe("GET /transcripts/:videoId", () => {
		it("should return transcript and increment fetch_count", async () => {
			await seedTranscript({ video_id: "dQw4w9WgXcQ", fetch_count: 5 });

			const response = await SELF.fetch(
				"http://local.test/transcripts/dQw4w9WgXcQ"
			);
			const body = await response.json<{
				success: boolean;
				result: any;
			}>();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.result.video_id).toBe("dQw4w9WgXcQ");
			expect(body.result.fetch_count).toBe(6); // Incremented from 5 to 6
		});

		it("should return 404 for non-existent video ID", async () => {
			const response = await SELF.fetch(
				"http://local.test/transcripts/nonexistent"
			);
			const body = await response.json<{
				success: boolean;
				error: string;
			}>();

			expect(response.status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.error).toContain("not found");
		});
	});

	describe("DELETE /transcripts/:videoId", () => {
		it("should delete transcript and return deleted record", async () => {
			await seedTranscript({ video_id: "dQw4w9WgXcQ" });

			const response = await SELF.fetch(
				"http://local.test/transcripts/dQw4w9WgXcQ",
				{
					method: "DELETE",
				}
			);
			const body = await response.json<{
				success: boolean;
				result: any;
			}>();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.result.video_id).toBe("dQw4w9WgXcQ");

			// Verify deletion
			const getResponse = await SELF.fetch(
				"http://local.test/transcripts/dQw4w9WgXcQ"
			);
			expect(getResponse.status).toBe(404);
		});

		it("should return 404 when deleting non-existent transcript", async () => {
			const response = await SELF.fetch(
				"http://local.test/transcripts/nonexistent",
				{
					method: "DELETE",
				}
			);
			const body = await response.json<{
				success: boolean;
				error: string;
			}>();

			expect(response.status).toBe(404);
			expect(body.success).toBe(false);
		});
	});

	describe("POST /transcripts/fetch", () => {
		it("should return existing transcript without upstream call when exists and force=false", async () => {
			await seedTranscript({ video_id: "dQw4w9WgXcQ", fetch_count: 3 });

			const response = await SELF.fetch(
				"http://local.test/transcripts/fetch",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ video: "dQw4w9WgXcQ", force: false }),
				}
			);
			const body = await response.json<{
				success: boolean;
				source: string;
				result: any;
			}>();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.source).toBe("database");
			expect(body.result.fetch_count).toBe(4); // Incremented from 3 to 4
		});

		it("should return 400 for invalid video URL/ID", async () => {
			const response = await SELF.fetch(
				"http://local.test/transcripts/fetch",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ video: "invalid" }),
				}
			);
			const body = await response.json<{
				success: boolean;
				error: string;
			}>();

			expect(response.status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.error).toContain("Invalid");
		});

		it("should accept YouTube URL format", async () => {
			await seedTranscript({ video_id: "dQw4w9WgXcQ" });

			const response = await SELF.fetch(
				"http://local.test/transcripts/fetch",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
					}),
				}
			);
			const body = await response.json<{
				success: boolean;
				source: string;
				result: any;
			}>();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.result.video_id).toBe("dQw4w9WgXcQ");
		});

		it("should accept youtu.be short URL format", async () => {
			await seedTranscript({ video_id: "dQw4w9WgXcQ" });

			const response = await SELF.fetch(
				"http://local.test/transcripts/fetch",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						video: "https://youtu.be/dQw4w9WgXcQ",
					}),
				}
			);
			const body = await response.json<{
				success: boolean;
				result: any;
			}>();

			expect(response.status).toBe(200);
			expect(body.result.video_id).toBe("dQw4w9WgXcQ");
		});
	});
});
