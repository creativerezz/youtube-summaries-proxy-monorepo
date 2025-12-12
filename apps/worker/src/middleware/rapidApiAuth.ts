import { createMiddleware } from "hono/factory";

/**
 * Middleware to validate RapidAPI proxy secret header
 * If RAPIDAPI_PROXY_SECRET is not configured, all requests are allowed (for local dev)
 */
export const rapidApiAuth = createMiddleware<{ Bindings: Env }>(
	async (c, next) => {
		const secret = c.env.RAPIDAPI_PROXY_SECRET;

		// If no secret configured, allow all requests (local dev)
		if (!secret) {
			await next();
			return;
		}

		const proxySecret = c.req.header("X-RapidAPI-Proxy-Secret");

		if (proxySecret !== secret) {
			return c.json(
				{
					success: false,
					error: "Unauthorized: Invalid or missing X-RapidAPI-Proxy-Secret header",
				},
				403
			);
		}

		await next();
	}
);
