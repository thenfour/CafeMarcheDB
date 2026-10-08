import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { DB3PaginatedQueryCore } from "../server/db3QueryCore";
import { validateDB3PaginatedQueryRequest } from "../server/db3RequestValidation";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { requireRecoveredDB3Domain } from "src/core/shared/applicationRecovery";

export default resolver.pipe(
    async (input: unknown, ctx) => {
        const request = validateDB3PaginatedQueryRequest(input);
        requireRecoveredDB3Domain(request.table.tableID);
        const auth = await loadAuthorization(ctx.session, request.bandPublicId);
        auth.requirePermission(Permission.login);
        try {
            return await DB3PaginatedQueryCore(request, auth);
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);
