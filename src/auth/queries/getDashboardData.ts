import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadDashboardData } from "src/core/db3/server/db3DashboardData";
import type { DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { PresentationInputSchema } from "src/locale/shared/presentationInput";
import { loadAuthorization } from "../server/serverAuthorization";

// Blitz enhances Prisma's generic types; the read owner uses the standard transaction API.
const database = db as unknown as DB3ReadRootDatabase;

export default resolver.pipe(
    resolver.zod(PresentationInputSchema),
    async (input, { session }: Ctx) => loadDashboardData(
        database, await loadAuthorization(session, input.bandPublicId), input,
    ),
);
