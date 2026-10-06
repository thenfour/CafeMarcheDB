import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { DB3PaginatedQueryCore } from "../server/db3QueryCore";
import { validateDB3PaginatedQueryRequest } from "../server/db3RequestValidation";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import db, { Prisma } from "db";
import { isBandInstrumentTable } from "../server/bandInstrumentRead";

export default resolver.pipe(
    async (input: unknown, ctx) => {
        const request = validateDB3PaginatedQueryRequest(input);
        const auth = await loadAuthorization(ctx.session, request.bandPublicId);
        auth.requirePermission(Permission.login);
        try {
            // LSMB todo: table-specific logic does not belong here; acceptance of the full effort depends on this going away.
            return isBandInstrumentTable(request.table.tableID)
                ? await db.$transaction(async tx => DB3PaginatedQueryCore(request, await auth.refresh(tx), tx),
                    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
                : await DB3PaginatedQueryCore(request, auth);
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);





