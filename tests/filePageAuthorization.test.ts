// @vitest-environment jsdom
import { parsePortalPath, PORTAL_PATH_QUERY_PARAM } from "src/route/portalRouting";

import type { AppContext } from "next/app";
import NextApp from "next/app";
import { AuthenticationError, AuthorizationError } from "blitz";
import { beforeEach, describe, expect, it, vi } from "vitest";
import getPageBootstrap from "src/auth/queries/getPageBootstrap";
import { MyApp } from "src/pages/_app";
import { defineCmdbPage } from "src/route/cmdbPage";
import { CmdbRouteRegistry } from "src/route/cmdbRoutes";
import { invoke } from "@blitzjs/rpc";
import type * as BlitzRpcModule from "@blitzjs/rpc";

vi.mock("src/auth/queries/getPageBootstrap", () => ({ default: vi.fn() }));
vi.mock("next/app", () => ({ default: { getInitialProps: vi.fn() } }));
vi.mock("src/blitz-client", () => ({ queryClient: {}, withBlitz: (app: unknown) => app }));
vi.mock("@blitzjs/rpc", async () => {
    const actual = await vi.importActual<typeof BlitzRpcModule>("@blitzjs/rpc");
    return { ...actual, invoke: vi.fn() };
});

describe("restored File page permissions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { pathname: "/_error", error: new Error("Server failed"), statusCode: 500, title: "Server failed" },
        { pathname: "/404", error: undefined, statusCode: 404, title: "This page could not be found" },
        { pathname: "/_error", error: undefined, statusCode: 500, title: "An unexpected error occurred" },
        { pathname: "/_error", error: new TypeError("Failed to fetch"), statusCode: null, title: "The server cannot be reached" },
    ])("renders framework $pathname without retrying unavailable bootstrap data", async ({ pathname, error, statusCode, title }) => {
        // Framework failures provide an error and page identity, without normal rewrite metadata.
        const context = { ctx: { pathname, err: error, query: {} } } as AppContext;
        expect(await MyApp.getInitialProps(context)).toMatchObject({ pageProps: { appBootstrap: { status: "error", statusCode, title } } });
        expect(getPageBootstrap).not.toHaveBeenCalled();
        expect(NextApp.getInitialProps).not.toHaveBeenCalled();
    });

    it.each(["/backstage/files", "/backstage/file/[...id_slug_tab]", "/backstage/editFiles"])(
        "returns an uncached 403 for denied SSR %s without running its page loader", async pathname => {
            vi.mocked(getPageBootstrap).mockRejectedValue(new AuthorizationError());
            const response = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() };
            // Rejected bootstrap reads only these Next request/response fields, before page rendering.
            const Component = defineCmdbPage(CmdbRouteRegistry.requireRouteByPattern(pathname).key, () => null);
            const context = { Component, ctx: { pathname, query: { [PORTAL_PATH_QUERY_PARAM]: JSON.stringify(parsePortalPath("/b/FileAuthBand0001/files", { kind: "multiBand" })) }, req: { headers: {} }, res: response } } as unknown as AppContext;
            expect(await MyApp.getInitialProps(context)).toMatchObject({ pageProps: { appBootstrap: { status: "error", statusCode: 403 } } });
            expect(response.statusCode).toBe(403);
            expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
            expect(response.end).not.toHaveBeenCalled();
            expect(NextApp.getInitialProps).not.toHaveBeenCalled();
        },
    );

    it.each(["server", "client"])("uses the selected page key during %s navigation with an external pathname", async navigation => {
        const requestPath = parsePortalPath("/b/LRnHh3DGxoKiKKI7/event/VgZu46IcAJqE1Gci/rehearsal/info", { kind: "multiBand" });
        const Component = defineCmdbPage("bandEvent", () => null);
        vi.mocked(getPageBootstrap).mockRejectedValue(new AuthorizationError());
        vi.mocked(invoke).mockRejectedValue(new AuthorizationError());
        // Only the fields consumed before a rejected bootstrap are needed for this Next boundary.
        const context = {
            Component,
            ctx: {
                pathname: requestPath.externalPathname,
                query: { [PORTAL_PATH_QUERY_PARAM]: JSON.stringify(requestPath) },
                ...(navigation === "server" ? { req: { headers: { "accept-language": "nl-BE" } }, res: { setHeader: vi.fn() } } : {}),
            },
        } as unknown as AppContext;
        expect(await MyApp.getInitialProps(context)).toMatchObject({ pageProps: { appBootstrap: { status: "error", statusCode: 403 } } });
        const expectedInput = { routeKey: "bandEvent", requestPath, browserLanguages: navigation === "server" ? ["nl-BE"] : [...navigator.languages] };
        if (navigation === "server") {
            expect(getPageBootstrap).toHaveBeenCalledWith(expectedInput, context.ctx);
            expect(invoke).not.toHaveBeenCalled();
        } else {
            expect(invoke).toHaveBeenCalledWith(getPageBootstrap, expectedInput);
            expect(getPageBootstrap).not.toHaveBeenCalled();
        }
        expect(NextApp.getInitialProps).not.toHaveBeenCalled();
    });

    it("recognizes a band login page by its key and avoids redirecting it to itself", async () => {
        vi.mocked(getPageBootstrap).mockRejectedValue(new AuthenticationError());
        const requestPath = parsePortalPath("/b/LRnHh3DGxoKiKKI7", { kind: "multiBand" });
        const response = { setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn() };
        // The external pathname deliberately differs from the internal band-root pattern.
        const context = {
            Component: defineCmdbPage("bandRoot", () => null),
            ctx: { pathname: requestPath.externalPathname, query: { [PORTAL_PATH_QUERY_PARAM]: JSON.stringify(requestPath) }, req: { headers: {} }, res: response },
        } as unknown as AppContext;
        expect(await MyApp.getInitialProps(context)).toMatchObject({ pageProps: { appBootstrap: { status: "error", statusCode: 401 } } });
        expect(response.writeHead).not.toHaveBeenCalled();
        expect(response.end).not.toHaveBeenCalled();
    });
});
