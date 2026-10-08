import { api } from "src/blitz-server";

export const config = { api: { bodyParser: false } };

// Reject before parsing input or reading accounts/content during recovery.
export default api(async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");

    res.status(503).end();
});

// MIGRATION_RESTORE: domain-search
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/api/search/getSearchResultsApi.ts:1-42
// Reason: The raw domain search owner does not establish a selected-band authorization snapshot for its SQL.
// Restore: Restore the domain search HTTP/direct owner with explicit band snapshots, authorized localized predicates/facets, consistent counts/paging/order, public identities and contextual links; account for preserved event/song and directory semantics.
// Verification: Reactivate preserved search authorization/recovery specifications; verify anonymous/member/admin visibility, two bands/locales, hidden assignments, all filter operators, grant revocation, facets and built-browser search.
// SHA256: 7c21c8ca701df07ac8723bf87e5737eb6c631e6c338b7eecdaf4c3f5d7ae5640
// MIGRATION_REFERENCE_BEGIN
// import { Ctx } from "@blitzjs/next";
// import { AuthenticationError, AuthorizationError } from "blitz";
// import { Permission } from "shared/permissions";
// import { api } from "src/blitz-server";
// import { loadAuthorization } from "src/auth/server/serverAuthorization";
// import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
// import { ZGetSearchResultsInput } from "src/core/db3/shared/apiTypes";
// import superjson from "superjson";
//
//
// export default api(async (req, res, ctx: Ctx) => {
//     try {
//         const auth = await loadAuthorization(ctx.session);
//         //auth.requireUser(); // why?
//
//         let args;
//         try {
//             if (typeof req.query.args !== "string") throw new Error("Missing search arguments");
//             args = ZGetSearchResultsInput.parse(superjson.parse(req.query.args));
//         } catch {
//             return res.status(400).json({ error: "Invalid search arguments" });
//         }
//
//         const result = await GetSearchResultsCore(args, auth);
//         const canSeeSql = auth.hasPermission(Permission.sysadmin);
//         const clientResult = canSeeSql ? result : {
//             ...result,
//             filterQueryResult: {
//                 ...result.filterQueryResult,
//                 sqlSelect: "",
//             },
//             queryMetrics: result.queryMetrics.map(metric => ({ ...metric, query: "" })),
//         };
//         return res.status(200).send(superjson.serialize(clientResult));
//     } catch (error) {
//         if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
//             return res.status(error.statusCode).json({ error: error.message });
//         }
//         console.error("Failed to fetch search results", error);
//         return res.status(500).json({ error: "Failed to fetch data" });
//     }
// });
// MIGRATION_REFERENCE_END
