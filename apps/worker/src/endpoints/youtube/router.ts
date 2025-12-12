import { fromHono } from "chanfana";
import { Hono } from "hono";
import { YouTubeMetadata } from "./metadata";
import { YouTubeCaptions } from "./captions";
import { YouTubeCacheStats, YouTubeCacheClear } from "./cacheStats";

// Create YouTube sub-router
const youtubeApp = new Hono<{ Bindings: Env }>();

export const youtubeRouter = fromHono(youtubeApp, {
	schema: {
		info: {
			title: "YouTube API",
			version: "1.0.0",
		},
	},
});

// Register YouTube endpoints
youtubeRouter.get("/metadata", YouTubeMetadata);
youtubeRouter.get("/captions", YouTubeCaptions);
youtubeRouter.get("/cache/stats", YouTubeCacheStats);
youtubeRouter.delete("/cache/clear", YouTubeCacheClear);
