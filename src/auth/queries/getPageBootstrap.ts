import type { Ctx } from "blitz";
import { NotFoundError } from "blitz";
import type { NextPageContext } from "next";
import { z } from "zod";
import db from "db";
import { getSessionForRequest } from "src/blitz-server";
import { assertAuthorizationBandScope, withAuthorizationBandScope } from "src/auth/server/requestAuthorizationScope";
import { loadPresentationData } from "src/locale/server/presentation";
import { PresentationInputSchema } from "src/locale/shared/presentationInput";
import { parsePortalPath, selectPortalContext, type RouteBandAndLocale } from "src/route/portalRouting";
import { resolvePortalRequest, requirePortalAvailability } from "src/route/server/portalRequest";
import { serverPortalHosting } from "src/route/server/portalConfig";
import { loadDbBrandConfig } from "src/server/brand";
import { loadPageAuthorization } from "../server/pageRequestAuthorization";

const PageBootstrapInputSchema = PresentationInputSchema.extend({
    pathname: z.string().max(512),
    requestPath: z.string().startsWith("/").max(16384),
});
type PageBootstrapInput = z.infer<typeof PageBootstrapInputSchema>;
type PageBootstrapContext = Ctx | Pick<NextPageContext, "req" | "res">;

async function pageSession(context: PageBootstrapContext) {
    if ("session" in context) {
        return context.session;
    }
    if (!context.req || !context.res) {
        throw new Error("Server page request is missing its request or response.");
    }
    return getSessionForRequest(context.req, context.res);
}

// only for pages. called by getInitialProps
export default async function getPageBootstrap(input: PageBootstrapInput, context: PageBootstrapContext) {
    // lsmb todo: use better routing system.
    const { pathname, requestPath, ...requested } = PageBootstrapInputSchema.parse(input);
    const hosting = serverPortalHosting();
    //console.log(`[getPageBootstrap] path ${pathname}`, input, hosting);
    const request = "req" in context ? context.req : undefined;
    if (request) {
        resolvePortalRequest(request);
    }
    let selection: RouteBandAndLocale;
    try {
        if (requestPath.startsWith("//")) {
            throw new RangeError("Expected a local page path.");
        }
        const requestedURL = new URL(requestPath, "https://cmdb.invalid");
        if (requestedURL.origin !== "https://cmdb.invalid") {
            throw new RangeError("Expected a local page path.");
        }
        selection = selectPortalContext(parsePortalPath(requestedURL.pathname), requested, hosting);
    } catch (error) {
        console.log("[getPageBootstrap] Failed to select portal context for requestPath:", requestPath, error);
        throw new NotFoundError();
    }
    const presentationInput = { ...requested, ...selection };

    assertAuthorizationBandScope(selection.bandPublicId);

    const boundBand = hosting.kind === "standalone" ? hosting.bandPublicId : selection.bandPublicId ?? null;
    return withAuthorizationBandScope(boundBand, async () => {
        await requirePortalAvailability({ hosting, selection, pathname }, db);
        const session = await pageSession(context);
        const auth = await loadPageAuthorization(pathname, session, selection.bandPublicId ?? undefined);
        const presentation = await loadPresentationData(auth, presentationInput);
        const host = request?.headers.host;
        const brand = await loadDbBrandConfig({ hostHeader: host, bandId: auth.band?.id ?? null, freshness: "refresh" });
        return {
            presentation,
            brand,
            portalHosting: hosting
        };
    });
}
