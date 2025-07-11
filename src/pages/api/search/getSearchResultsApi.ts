// generalized version of search results.
// hopefully can unify song & event search, and then extend to users & files.

import { Ctx } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { api } from "src/blitz-server";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { ZGetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import superjson from "superjson";


export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            const currentUser = await mutationCore.getCurrentUserCore(ctx);
            const authenticatedCtx = mutationCore.getAuthenticatedCtx(ctx, Permission.visibility_members);
            if (!currentUser || !authenticatedCtx) throw new Error(`unauthorized`);

            const argsStr = req.query.args;
            if (typeof (argsStr) !== 'string') throw new Error(`invalid args`);
            const parsedargs = superjson.parse(argsStr);
            const validatedArgs = ZGetSearchResultsInput.parse(parsedargs);

            const result = await GetSearchResultsCore(validatedArgs, authenticatedCtx);

            // delay 1 second
            // await new Promise(resolve => setTimeout(async () => {
            //     res.status(200).send(superjson.serialize(result));
            //     resolve(result);
            // }, 100));

            res.status(200).send(superjson.serialize(result));
        } catch (error) {
            console.error("Failed to fetch search results", error);
            res.status(500).json({ error: "Failed to fetch data" });
        }
    }); // return new promise
});





