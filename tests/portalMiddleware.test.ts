import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "src/middleware";
import { deserializePortalPath, PORTAL_PATH_QUERY_PARAM } from "src/route/portalRouting";

afterEach(() => { vi.unstubAllEnvs(); });

describe("portal middleware transport", () => {
    it.each(["/", "/platform/adminUsers", "/api/files/download/stored.pdf"])("preserves unscoped %s and its query", pathname => {
        const response = middleware(new NextRequest(`https://portal.test${pathname}?bandPublicId=explicit`));
        const destination = new URL(response.headers.get("x-middleware-rewrite")!);
        expect(destination.pathname).toBe(pathname);
        expect(destination.searchParams.get("bandPublicId")).toBe("explicit");
        expect(deserializePortalPath(Object.fromEntries(destination.searchParams))).toMatchObject({ hasBandPrefix: false, bandPublicId: null });
    });
    it("rewrites a band page while preserving application queries and replacing forged metadata", () => {
        const request = new NextRequest(`https://portal.test/fr/b/PortalBand000001/song/SONG/name?filter=a&filter=b&${PORTAL_PATH_QUERY_PARAM}=forged`);
        const response = middleware(request);
        const destination = new URL(response.headers.get("x-middleware-rewrite")!);
        expect(destination.pathname).toBe("/backstage/song/SONG/name");
        expect(destination.searchParams.getAll("filter")).toEqual(["a", "b"]);
        expect(destination.searchParams.getAll(PORTAL_PATH_QUERY_PARAM)).toHaveLength(1);
        expect(deserializePortalPath(Object.fromEntries(destination.searchParams))).toEqual({
            externalPathname: "/fr/b/PortalBand000001/song/SONG/name",
            internalPathname: "/backstage/song/SONG/name",
            bandPublicId: "PortalBand000001", routeLocale: "fr", hasBandPrefix: true,
        });
    });
    it("forwards the single-band marker without querying the database or injecting an ID", () => {
        vi.stubEnv("CMDB_HOSTING_MODE", "GenericSingleTenant");
        const response = middleware(new NextRequest("https://portal.test/nl/b"));
        const destination = new URL(response.headers.get("x-middleware-rewrite")!);
        expect(destination.pathname).toBe("/backstage");
        expect(deserializePortalPath(Object.fromEntries(destination.searchParams))).toMatchObject({
            bandPublicId: null, hasBandPrefix: true, routeLocale: "nl",
        });
    });
});
