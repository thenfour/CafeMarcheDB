import { Permission } from "shared/permissions";
import { getServerStartState } from "shared/serverStateBase";
import type { Ctx } from "blitz";
import type { NextPageContext } from "next";
import { z } from "zod";
import { withAuthorizationBandScope } from "src/auth/server/requestAuthorizationScope";
import { getSessionForRequest } from "src/blitz-server";
import { loadPresentationData } from "src/locale/server/presentation";
import { ZPortalPath, getServerBandHostingConfig } from "src/route/portalRouting";
import { resolvePortalPath, resolvePortalRequestContext } from "src/route/server/portalRequest";
import { serverGetBaseUrl } from "src/route/server/portalConfig";
import { loadDbBrandConfig } from "src/server/brand";
import { loadPageAuthorization } from "../server/pageRequestAuthorization";
import { CmdbRouteRegistry, type CmdbRouteKey } from "src/route/cmdbRoutes";

const PageBootstrapInputSchema = z.object({
    routeKey: z.custom<CmdbRouteKey>(CmdbRouteRegistry.isRouteKey, "Invalid route key."),
    requestPath: ZPortalPath,
    browserLanguages: z.array(z.string().max(128)).max(32),
}).strict();
export type PageBootstrapInput = z.infer<typeof PageBootstrapInputSchema>;
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

/** Authorize before page loaders run, on direct requests and client navigation. */
export default async function getPageBootstrap(input: PageBootstrapInput, context: PageBootstrapContext) {
    const requested = PageBootstrapInputSchema.parse(input);
    const route = CmdbRouteRegistry.routeByKey(requested.routeKey);
    const request = "req" in context ? context.req : undefined;
    const hosting = getServerBandHostingConfig();
    const requestPath = request
        ? (await resolvePortalRequestContext(request, requested.requestPath)).requestPath
        : await resolvePortalPath(requested.requestPath, hosting);
    const presentationInput = {
        bandPublicId: requestPath.bandPublicId,
        routeLocale: requestPath.routeLocale,
        browserLanguages: requested.browserLanguages,
    };
    return withAuthorizationBandScope(requestPath.bandPublicId, async () => {
        const session = await pageSession(context);
        const auth = await loadPageAuthorization(route, session, requestPath.bandPublicId ?? undefined);
        const presentation = await loadPresentationData(auth, presentationInput);
        const brand = await loadDbBrandConfig({ hostHeader: request?.headers.host, bandId: (auth.band?.id ?? null), freshness: "refresh", pageTheming: route.theming });
        return {
            presentation,
            routeKey: route.key,
            brand,
            routing: { baseUri: serverGetBaseUrl(), hosting, requestPath },
            serverStartupState: auth.hasPermission(Permission.sysadmin) ? getServerStartState() : null,
        };
    });
}
