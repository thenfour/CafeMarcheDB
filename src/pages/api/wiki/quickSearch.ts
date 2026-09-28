// consider unifying with the normal search api for consistency and simplicity.

import { Ctx } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { QuickSearchItemTypeArray, ZQuickSearchItemTypeArray } from "shared/quickFilter";
import { ZodJsonParseAndValidate } from "shared/utils";
import { api } from "src/blitz-server";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";

export default api(async (req, res, ctx: Ctx) => {
    const auth = await loadAuthorization(ctx.session);
    auth.requirePermission(Permission.visibility_public);
    const currentUser = auth.requireUser().user; // TODO: why is this necessary? public should have fundamental rights to quick search

    const { keyword, allowedItemTypes } = req.query;

    if (typeof keyword !== "string") {
        return res.status(400).json({ error: "A valid keyword must be provided" });
    }

    if (typeof allowedItemTypes !== "string") {
        return res.status(400).json({ error: "A valid allowedItemTypes must be provided" });
    }

    // The validator returns the runtime shape but does not preserve the array's union type.
    const parsedAllowedTypes = ZodJsonParseAndValidate(allowedItemTypes, ZQuickSearchItemTypeArray) as QuickSearchItemTypeArray;

    try {
        const slugs = await getQuickSearchResults(keyword, currentUser, parsedAllowedTypes);
        return res.status(200).json(slugs);
    } catch (error) {
        console.error("Failed to fetch slugs", error);
        return res.status(500).json({ error: "Failed to fetch data" });
    }
});





