// @vitest-environment jsdom
import { parsePortalPath, PORTAL_PATH_QUERY_PARAM } from "src/route/portalRouting";

import type { AppContext } from "next/app";
import NextApp from "next/app";
import { AuthorizationError } from "blitz";
import { beforeEach, describe, expect, it, vi } from "vitest";
import getPageBootstrap from "src/auth/queries/getPageBootstrap";
import { MyApp } from "src/pages/_app";

vi.mock("src/auth/queries/getPageBootstrap", () => ({ default: vi.fn() }));
vi.mock("next/app", () => ({ default: { getInitialProps: vi.fn() } }));
vi.mock("src/blitz-client", () => ({ queryClient: {}, withBlitz: (app: unknown) => app }));

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
            const context = { ctx: { pathname, query: { [PORTAL_PATH_QUERY_PARAM]: JSON.stringify(parsePortalPath("/b/FileAuthBand0001/backstage/files", { kind: "multiBand" })) }, req: { headers: {} }, res: response } } as unknown as AppContext;
            expect(await MyApp.getInitialProps(context)).toMatchObject({ pageProps: { appBootstrap: { status: "error", statusCode: 403 } } });
            expect(response.statusCode).toBe(403);
            expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
            expect(response.end).not.toHaveBeenCalled();
            expect(NextApp.getInitialProps).not.toHaveBeenCalled();
        },
    );
});
