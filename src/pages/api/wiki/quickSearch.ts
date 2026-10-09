import type { NextApiRequest, NextApiResponse } from "next";
import type { Ctx } from "@blitzjs/next";
import { AuthenticationError, AuthorizationError, NotFoundError } from "blitz";
import { z } from "zod";
import { QuickSearchItemType } from "shared/quickFilter";
import { api } from "src/blitz-server";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { ApplicationFeatureUnavailableError } from "src/core/shared/applicationRecovery";
import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";
import { QuickSearchInputSchema, type QuickSearchInput } from "src/core/db3/shared/quickSearchTypes";
import { collectLocalePreferences, parseAcceptLanguage } from "src/locale/shared/localePreferences";

export const config = { api: { bodyParser: false } };

export async function quickSearchRoute(req: NextApiRequest, res: NextApiResponse, ctx: Ctx): Promise<void> {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        res.status(405).end();
        return;
    }
    let input: QuickSearchInput;
    try {
        const types = z.array(z.nativeEnum(QuickSearchItemType)).parse(JSON.parse(String(req.query.allowedItemTypes)));
        if (types.length === 0 || types.some(type => type !== QuickSearchItemType.song)) {
            res.status(503).json({ error: new ApplicationFeatureUnavailableError("quickSearch").message });
            return;
        }
        input = QuickSearchInputSchema.parse({
            keyword: req.query.keyword, allowedItemTypes: types, bandPublicId: req.query.bandPublicId,
            routeLocale: req.query.routeLocale, browserLanguages: req.query.browserLanguages === undefined
                ? parseAcceptLanguage(req.headers["accept-language"]) : JSON.parse(String(req.query.browserLanguages)),
        });
        collectLocalePreferences(input);
    } catch {
        res.status(400).json({ error: "Invalid search arguments" });
        return;
    }
    try {
        const auth = await loadAuthorization(ctx.session, input.bandPublicId);
        res.status(200).json(await getQuickSearchResults(input, auth));
    } catch (error) {
        if (error instanceof AuthenticationError || error instanceof AuthorizationError || error instanceof NotFoundError) {
            res.status(error.statusCode).json({ error: error.message });
            return;
        }
        console.error("Failed to fetch song suggestions", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }
}

export default api(quickSearchRoute);

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/pages/api/wiki/quickSearch.ts:1-37
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: fa93c8e9a8b17bfe8145e17b10fc55a15bebf39d451ee82d1ef801b7ece43b27
// MIGRATION_REFERENCE_BEGIN
// // consider unifying with the normal search api for consistency and simplicity.
//
// import { Ctx } from "@blitzjs/next";
// import { Permission } from "shared/permissions";
// import { QuickSearchItemTypeArray, ZQuickSearchItemTypeArray } from "shared/quickFilter";
// import { ZodJsonParseAndValidate } from "shared/utils";
// import { api } from "src/blitz-server";
// import { loadAuthorization } from "src/auth/server/serverAuthorization";
// import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";
//
// export default api(async (req, res, ctx: Ctx) => {
//     const auth = await loadAuthorization(ctx.session);
//     auth.requirePermission(Permission.visibility_public);
//     //const currentUser = auth.requireUser().user; // TODO: why is this necessary? public should have fundamental rights to quick search
//
//     const { keyword, allowedItemTypes } = req.query;
//
//     if (typeof keyword !== "string") {
//         return res.status(400).json({ error: "A valid keyword must be provided" });
//     }
//
//     if (typeof allowedItemTypes !== "string") {
//         return res.status(400).json({ error: "A valid allowedItemTypes must be provided" });
//     }
//
//     // The validator returns the runtime shape but does not preserve the array's union type.
//     const parsedAllowedTypes =
//         ZodJsonParseAndValidate(allowedItemTypes, ZQuickSearchItemTypeArray) as QuickSearchItemTypeArray;
//
//     try {
//         const slugs = await getQuickSearchResults(keyword, auth, parsedAllowedTypes);
//         return res.status(200).json(slugs);
//     } catch (error) {
//         console.error("Failed to fetch slugs", error);
//         return res.status(500).json({ error: "Failed to fetch data" });
//     }
// });
// MIGRATION_REFERENCE_END
