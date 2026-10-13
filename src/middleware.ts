// src/middleware.ts

import { NextResponse, type NextRequest } from "next/server";
import { parsePublicId } from "shared/publicId";
import { parsePortalPath, getServerBandHostingConfig, PORTAL_PATH_HEADER, selectPortalContext } from "src/route/portalRouting";

// must be a simple URL rewriter, based on metadata in backstageRoutes registry.
// this is the 1st stage in cmdb url processing
// can not perform any db queries and therefore auth / locale selection etc can't be done here.

// you cannot run Prisma here;
// Error: PrismaClient is not configured to run in Vercel Edge Functions or Edge Middleware. In order to run Prisma Client on edge runtime, either:
// - Use Prisma Accelerate: https://pris.ly/d/accelerate
// - Use Driver Adapters: https://pris.ly/d/driver-adapters

export function middleware(request: NextRequest) {
    try {
        const originalPath = request.nextUrl.pathname;
        const path = parsePortalPath(originalPath);
        const hosting = getServerBandHostingConfig(process.env.CMDB_HOSTING_MODE, process.env.CMDB_PUBLIC_BAND_PUBLIC_ID);

        // parse band & locale from query params.
        // todo: should not be hard-coded query parameters!
        const query = request.nextUrl.searchParams;
        if (query.getAll("bandPublicId").length > 1 || query.getAll("routeLocale").length > 1) {
            return new NextResponse(null, { status: 404 });
        }
        const requestedBand = query.get("bandPublicId");
        const selection = selectPortalContext(path, {
            bandPublicId: requestedBand === null ? null : parsePublicId<"Band">(requestedBand),
            routeLocale: query.get("routeLocale"),
        }, hosting);

        const headers = new Headers(request.headers);
        headers.delete(PORTAL_PATH_HEADER);
        headers.set(PORTAL_PATH_HEADER, originalPath);

        // now construct the internal dest route, with params as query string params.
        const destination = request.nextUrl.clone();
        destination.pathname = path.pathname;
        if (selection.bandPublicId) {
            destination.searchParams.set("bandPublicId", selection.bandPublicId);
        }
        if (selection.routeLocale) {
            destination.searchParams.set("routeLocale", selection.routeLocale);
        }

        if (destination.href === request.nextUrl.href) {
            return NextResponse.next({ request: { headers } });
        }
        return NextResponse.rewrite(destination, { request: { headers } });
    } catch {
        return new NextResponse(null, { status: 404 });
    }
}

// https://nextjs.org/docs/14/app/building-your-application/routing/middleware
export const config = {
    // it may not be totally necessary but this confines middleware handling to paths we actually treat.
    // though i'm not sure this is entirely accurate or necessary.
    // for example what if favicon.ico is a png?  i feel like it's better to use a blanket handler.
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
