// consider unifying with the normal search api for consistency and simplicity.

import { Ctx } from "@blitzjs/next";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { QuickSearchItemTypeArray, ZQuickSearchItemTypeArray } from "shared/quickFilter";
import { ZodJsonParseAndValidate } from "shared/utils";
import { api } from "src/blitz-server";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";

export default api(async (req, res, origCtx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        origCtx.session.$authorize(Permission.visibility_public);
        const ctx: AuthenticatedCtx = origCtx as any; // authorize ensures this.
        const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;
        if (!currentUser) throw new Error(`not authorized`);

        const { keyword, allowedItemTypes } = req.query;

        if (typeof keyword !== "string") {
            res.status(400).json({ error: "A valid keyword must be provided" });
            return;
        }

        if (typeof allowedItemTypes !== "string") {
            res.status(400).json({ error: "A valid allowedItemTypes must be provided" });
            return;
        }

        // why is the cast necessary? no clue
        const parsedAllowedTypes = ZodJsonParseAndValidate(allowedItemTypes || "", ZQuickSearchItemTypeArray) as QuickSearchItemTypeArray;

        try {
            const slugs = await getQuickSearchResults(keyword, currentUser, parsedAllowedTypes);
            res.status(200).json(slugs);
        } catch (error) {
            console.error("Failed to fetch slugs", error);
            res.status(500).json({ error: "Failed to fetch data" });
        }
    }); // return new promise
});





