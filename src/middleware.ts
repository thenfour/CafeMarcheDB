// src/middleware.ts
//import db from "@/db";
import { NextResponse, type NextRequest } from "next/server"

// this should be a simple URL rewriter, based on metadata in
// backstageRoutes registry.
// note that you cannot run Prisma here;
// Error: PrismaClient is not configured to run in Vercel Edge Functions or Edge Middleware. In order to run Prisma Client on edge runtime, either:
// - Use Prisma Accelerate: https://pris.ly/d/accelerate
// - Use Driver Adapters: https://pris.ly/d/driver-adapters

// so the concept of a default locale should be set in env, not the database.

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    //console.log(`MW path: ${path}`);

    // if (path === "/settings") {
    //     const destination = request.nextUrl.clone();
    //     // the destination must also be a page (/pages/...) -- cannot just be embedded somewhere in the repo.
    //     destination.pathname = `/backstage/events`;

    //     // Remove any value supplied by the browser.
    //     const headers = new Headers(request.headers);
    //     //headers.delete("x-cmdb-portal-path");

    //     headers.set("x-cmdb-portal-path", path);

    //     return NextResponse.rewrite(destination, { request: { headers } });

    // }


    return NextResponse.next();

    //   const match = /^\/(fr-BE|nl-BE|en-GB)\/b\/([A-Za-z0-9_-]+)(\/.*)?$/.exec(path)

    //   if (!match) {
    //     return NextResponse.next({ request: { headers } })
    //   }

    //   const routeUnderBand = match[3] || ""
    //   const destination = request.nextUrl.clone()
    //   destination.pathname = `/backstage${routeUnderBand}`

    //   // Give server-side page code the original path to resolve and verify.
    //   headers.set("x-cmdb-portal-path", path) // this lets the target page know the lang & band / original request info

    //return NextResponse.rewrite(destination, { request: { headers } })
}