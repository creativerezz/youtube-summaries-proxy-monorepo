import { Hono } from "hono";
import { fromHono } from "chanfana";
import { TranscriptList } from "./transcriptList";
import { TranscriptGet } from "./transcriptGet";
import { TranscriptDelete } from "./transcriptDelete";
import { TranscriptFetch } from "./transcriptFetch";
import { rapidApiAuth } from "../../middleware/rapidApiAuth";

const app = new Hono<{ Bindings: Env }>();

// Apply RapidAPI auth middleware to all transcript endpoints
app.use("*", rapidApiAuth);

export const transcriptsRouter = fromHono(app);

// Endpoints per API spec
transcriptsRouter.post("/fetch", TranscriptFetch); // Fetch from upstream and store
transcriptsRouter.get("/", TranscriptList); // List all (paginated)
transcriptsRouter.get("/:videoId", TranscriptGet); // Get single transcript
transcriptsRouter.delete("/:videoId", TranscriptDelete); // Delete transcript
