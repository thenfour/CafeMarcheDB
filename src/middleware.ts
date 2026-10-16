// src/middleware.ts

import { NextResponse, type NextRequest } from "next/server";
import { parsePortalPath, PORTAL_PATH_HEADER } from "src/route/portalRouting";

// must be a simple URL rewriter, for band and locale prefixes.
// this is the 1st stage in cmdb url processing
// can not perform any db queries and therefore auth / locale selection etc can't be done here.

// you cannot run Prisma here;
// Error: PrismaClient is not configured to run in Vercel Edge Functions or Edge Middleware. In order to run Prisma Client on edge runtime, either:
// - Use Prisma Accelerate: https://pris.ly/d/accelerate
// - Use Driver Adapters: https://pris.ly/d/driver-adapters

export function middleware(request: NextRequest) {
    // nop:
    //return NextResponse.next();
    try {
        const originalPath = request.nextUrl.pathname;

        // console.log(`[middleware] ${originalPath}`);

        const path = parsePortalPath(originalPath);

        const headers = new Headers(request.headers);
        headers.delete(PORTAL_PATH_HEADER);
        headers.set(PORTAL_PATH_HEADER, originalPath);

        // construct the internal dest route, with params as query string params.
        // this might be better done in a header?
        const destination = request.nextUrl.clone();
        destination.pathname = path.pathname;
        if (path.bandPublicId) {
            destination.searchParams.set("bandPublicId", path.bandPublicId);
        }
        if (path.routeLocale) {
            destination.searchParams.set("routeLocale", path.routeLocale);
        }

        if (destination.href === request.nextUrl.href) {
            //console.log("[middleware] Not rewriting :", destination.href);
            return NextResponse.next({ request: { headers } });
        }
        console.log("[middleware] Rewriting to :", destination.href);
        return NextResponse.rewrite(destination, { request: { headers } });
    } catch (error) {
        console.log("[middleware] Error occurred, returning 404.", error);
        return new NextResponse(null, { status: 404 });
    }
}

// https://nextjs.org/docs/14/app/building-your-application/routing/middleware
export const config = {
    // kinda messy to do this... here we exclude stuff we know doesn't need to go through middleware parsing
    matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png).*)"]
};
