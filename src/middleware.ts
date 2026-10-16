import { NextResponse, type NextRequest } from "next/server";
import { getServerBandHostingConfig, parsePortalPath, serializePortalPath } from "src/route/portalRouting";

// Middleware parses route parameters; database resolution belongs to the server adapter.
export function middleware(request: NextRequest) {
    try {
        const path = parsePortalPath(request.nextUrl.pathname, getServerBandHostingConfig());
        const destination = request.nextUrl.clone();
        destination.pathname = path.internalPathname;
        // Next exposes rewrite queries to getInitialProps on both server and client navigation.
        serializePortalPath(destination.searchParams, path);
        return NextResponse.rewrite(destination);
    } catch (error) {
        console.log("[middleware] Error occurred, returning 404.", error);
        return new NextResponse(null, { status: 404 });
    }
}

export const config = {
    // Static assets do not carry route parameters.
    matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png).*)"]
};
