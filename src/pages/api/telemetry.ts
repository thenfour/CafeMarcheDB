import { Ctx, NotFoundError } from "blitz";
import { ClientActionRequestSchema } from "src/core/components/featureReports/activityTracking";
import { recordAuthenticatedClientAction } from "src/core/db3/server/recordActionServer";
import { api } from "src/blitz-server";
import { loadAuthorization } from "src/auth/server/serverAuthorization";

// This endpoint receives telemetry/analytics events via keepalive POST requests.

export default api(async (req, res, ctx: Ctx) => {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).end("Method Not Allowed");
    }

    let data: unknown = null;
    if (req.headers["content-type"]?.includes("application/json")) {
        data = req.body;
    } else if (req.headers["content-type"]?.includes("text/plain")) {
        try {
            data = JSON.parse(req.body);
        } catch { }
    } else {
        data = req.body;
    }

    const parsedRequest = ClientActionRequestSchema.safeParse(data);
    if (!parsedRequest.success) {
        return res.status(400).json({ error: "Invalid telemetry event" });
    }

    // Store the telemetry event in the database using shared logic
    try {
        const authorization = await loadAuthorization(ctx.session, parsedRequest.data.presentation.bandPublicId);
        await recordAuthenticatedClientAction(parsedRequest.data, authorization);
    } catch (e) {
        if (e instanceof NotFoundError) {
            return res.status(404).json({ error: "The selected band is unavailable" });
        }
        console.error("[Telemetry] Failed to record action", e);
        return res.status(500).json({ error: "Failed to record telemetry event" });
    }

    // Respond quickly so unload-time keepalive requests can complete.
    res.status(204).end();
});
