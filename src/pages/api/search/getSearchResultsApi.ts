import { api } from "src/blitz-server";
import type { Ctx } from "@blitzjs/next";
import { AuthenticationError, AuthorizationError, NotFoundError } from "blitz";
import type { NextApiRequest, NextApiResponse } from "next";
import superjson from "superjson";
import { Permission } from "shared/permissions";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { GetSearchResultsCore, SearchInputError, isRestoredSearchDomain } from "src/core/db3/server/searchServerCore";
import { ZGetSearchResultsInput, type GetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import { ApplicationFeatureUnavailableError } from "src/core/shared/applicationRecovery";
import { collectLocalePreferences, parseAcceptLanguage } from "src/locale/shared/localePreferences";

export const config = { api: { bodyParser: false } };

export async function searchResultsRoute(req: NextApiRequest, res: NextApiResponse, ctx: Ctx): Promise<void> {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        res.status(405).end();
        return;
    }
    let args: GetSearchResultsInput;
    try {
        if (typeof req.query.args !== "string") {
            throw new Error("Missing search arguments.");
        }
        const parsed = ZGetSearchResultsInput.parse(superjson.parse(req.query.args));
        args = { ...parsed, browserLanguages: parsed.browserLanguages ?? parseAcceptLanguage(req.headers["accept-language"]) };
        collectLocalePreferences(args);
    } catch {
        res.status(400).json({ error: "Invalid search arguments" });
        return;
    }
    // The search owner declares restored domains; HTTP does not maintain a second list.
    if (!isRestoredSearchDomain(args.tableID)) {
        res.status(503).json({ error: new ApplicationFeatureUnavailableError("domainSearch").message });
        return;
    }
    try {
        const auth = await loadAuthorization(ctx.session, args.bandPublicId);
        const result = await GetSearchResultsCore(args, auth);
        const clientResult = auth.hasPermission(Permission.sysadmin) ? result : {
            ...result, filterQueryResult: { ...result.filterQueryResult, sqlSelect: "" },
            queryMetrics: result.queryMetrics.map(metric => ({ ...metric, query: "" })),
        };
        res.status(200).send(superjson.serialize(clientResult));
    } catch (error) {
        if (error instanceof SearchInputError) {
            res.status(400).json({ error: error.message });
            return;
        }
        if (error instanceof AuthenticationError || error instanceof AuthorizationError || error instanceof NotFoundError) {
            res.status(error.statusCode).json({ error: error.message });
            return;
        }
        console.error("Failed to fetch search results", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }
}

export default api(searchResultsRoute);
