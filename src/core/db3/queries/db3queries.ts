import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { queryTable } from "../server/db3QueryCore";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { validateDB3QueryRequest } from "../server/db3RequestValidation";
import db, { Prisma } from "db";
import { isBandInstrumentTable } from "../server/bandInstrumentRead";

export default resolver.pipe(
    async (input: unknown, ctx: AuthenticatedCtx) => {
        const request = validateDB3QueryRequest(input);
        const auth = await loadAuthorization(ctx.session, request.bandPublicId);
        // LSMB todo: table-specific logic does not belong here; acceptance of the full effort depends on this going away.
        return isBandInstrumentTable(request.table.tableID)
            ? db.$transaction(async tx => queryTable(request, await auth.refresh(tx), tx),
                { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
            : queryTable(request, auth);
    }
);



