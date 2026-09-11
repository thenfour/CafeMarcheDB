import { Ctx } from "blitz";
import { ZTRecordActionArgs } from "src/core/components/featureReports/activityTracking";
import { recordAuthenticatedClientAction } from "src/core/db3/server/recordActionServer";
import { api } from "src/blitz-server";

// This endpoint receives telemetry/analytics events via keepalive POST requests.

export default api(async (req, res, ctx: Ctx) => {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).end("Method Not Allowed");
    }

    let data: { event?: unknown } | null = null;
    if (req.headers["content-type"]?.includes("application/json")) {
        data = req.body;
    } else if (req.headers["content-type"]?.includes("text/plain")) {
        try {
            data = JSON.parse(req.body);
        } catch { }
    } else {
        data = req.body;
    }

    const parsedEvent = ZTRecordActionArgs.safeParse(data?.event);
    if (!parsedEvent.success) return res.status(400).json({ error: "Invalid telemetry event" });

    // Store the telemetry event in the database using shared logic
    try {
        await recordAuthenticatedClientAction(parsedEvent.data, ctx);
    } catch (e) {
        console.error("[Telemetry] Failed to record action", e);
        return res.status(500).json({ error: "Failed to record telemetry event" });
    }

    // Respond quickly so unload-time keepalive requests can complete.
    res.status(204).end();
});
