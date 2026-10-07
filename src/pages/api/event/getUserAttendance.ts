import { AuthenticationError, AuthorizationError, NotFoundError, type Ctx } from "blitz";
import db from "db";
import { ZodError } from "zod";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { api } from "src/blitz-server";
import { readUserEventAttendance } from "src/core/db3/server/eventAttendanceRead";
import { ZGetUserAttendanceArgs } from "src/core/db3/shared/apiTypes";

export default api(async (req, res, ctx: Ctx) => {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    try {
        const args = ZGetUserAttendanceArgs.parse(req.query);
        const auth = await loadAuthorization(ctx.session, args.bandPublicId);
        res.status(200).json(await readUserEventAttendance(db, auth, args));
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ error: "Invalid attendance request" });
        } else if (error instanceof AuthenticationError) {
            res.status(401).json({ error: "Authentication required" });
        } else if (error instanceof AuthorizationError) {
            res.status(403).json({ error: "Attendance access denied" });
        } else if (error instanceof NotFoundError) {
            res.status(404).json({ error: "Attendance target not found" });
        } else {
            console.error("Failed to fetch attendance", error);
            res.status(500).json({ error: "Failed to fetch attendance" });
        }
    }
});
