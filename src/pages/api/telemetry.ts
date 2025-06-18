import { NextApiRequest, NextApiResponse } from "next";
import { ClientActivityParams } from "src/core/components/featureReports/activityTracking";
import { createActionRecord } from "src/core/db3/server/recordActionServer";

// This endpoint receives telemetry/analytics events via POST (e.g., from navigator.sendBeacon)

// CTX is not available here for some reason.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).end("Method Not Allowed");
    }

    // requires anti CSRF to use session (e.g. for userId), but beacon-based calls don't support CSRF in headers.
    // and blitz doesn't seem to allow me to disable CSRF, despite https://github.com/blitz-js/blitz/issues/3789

    let data: { event: ClientActivityParams, userId?: number | null | undefined } | null = null;
    if (req.headers["content-type"]?.includes("application/json")) {
        data = req.body;
    } else if (req.headers["content-type"]?.includes("text/plain")) {
        try {
            data = JSON.parse(req.body);
        } catch { }
    } else {
        data = req.body;
    }

    // Optionally validate required fields here
    if (!data || typeof data.event.feature !== "string") {
        return res.status(400).json({ error: "Missing or invalid feature property" });
    }

    // Store the telemetry event in the database using shared logic
    try {
        // Ensure context is never null (DB expects string or undefined)
        const { context, ...rest } = data.event;
        await createActionRecord({
            ...rest,
            context: context ?? undefined,
            isClient: true,
            userId: data.userId || undefined, // No authentication for beacon events
        });
    } catch (e) {
        console.error("[Telemetry] Failed to record action", e);
        return res.status(500).json({ error: "Failed to record telemetry event" });
    }

    // Respond quickly (sendBeacon expects a fast response)
    res.status(204).end();
}
