import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { queryTable } from "../server/db3QueryCore";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { validateDB3QueryRequest } from "../server/db3RequestValidation";
import { requireRecoveredDB3Domain } from "src/core/shared/applicationRecovery";

export default resolver.pipe(
    async (input: unknown, ctx: AuthenticatedCtx) => {
        const request = validateDB3QueryRequest(input);
        requireRecoveredDB3Domain(request.table.tableID);
        const auth = await loadAuthorization(ctx.session, request.bandPublicId);
        return queryTable(request, auth);
    }
);
