import { Ctx } from "@blitzjs/next";
import { AuthenticationError, AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import { api } from "src/blitz-server";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { loadAuthorization } from "src/auth/server/requestAuthorization";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { ZGetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import superjson from "superjson";


export default api(async (req, res, ctx: Ctx) => {
    try {
        const { user, effectivePermissions } = await loadAuthorization(ctx.session);
        if (!user) throw new AuthenticationError();
        if (!effectivePermissions.includesName(Permission.visibility_members)) throw new AuthorizationError();
        const authenticatedCtx = mutationCore.getAuthenticatedCtx(ctx, Permission.visibility_members);
        if (!authenticatedCtx) throw new AuthorizationError();

        let args;
        try {
            if (typeof req.query.args !== "string") throw new Error("Missing search arguments");
            args = ZGetSearchResultsInput.parse(superjson.parse(req.query.args));
        } catch {
            return res.status(400).json({ error: "Invalid search arguments" });
        }

        const result = await GetSearchResultsCore(args, authenticatedCtx);
        // SQL diagnostics contain trusted natural IDs after public-ID
        // resolution. Keep those server-side for non-sysadmins even though the timing/error
        // metadata is useful to the search client.
        const canSeeSql = effectivePermissions.includesName(Permission.sysadmin);
        const clientResult = canSeeSql ? result : {
            ...result,
            filterQueryResult: {
                ...result.filterQueryResult,
                sqlSelect: "",
            },
            queryMetrics: result.queryMetrics.map(metric => ({ ...metric, query: "" })),
        };
        return res.status(200).send(superjson.serialize(clientResult));
    } catch (error) {
        if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        console.error("Failed to fetch search results", error);
        return res.status(500).json({ error: "Failed to fetch data" });
    }
});





