import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import type { DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { PresentationInputSchema } from "src/locale/shared/presentationInput";
import { loadAvailableBands } from "../server/availableBands";
import { loadAuthorization } from "../server/serverAuthorization";

// Blitz's client exposes the standard interactive transaction API used by this reader.
const database = db as unknown as DB3ReadRootDatabase;

export default resolver.pipe(
    resolver.zod(PresentationInputSchema.omit({ bandPublicId: true })),
    async (input, { session }: Ctx) => loadAvailableBands(database, await loadAuthorization(session), input),
);
