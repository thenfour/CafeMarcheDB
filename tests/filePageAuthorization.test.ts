// @vitest-environment jsdom
import type { AppContext } from "next/app";
import NextApp from "next/app";
import { AuthorizationError } from "blitz";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { CmdbRoutes } from "@/src/route/cmdbRoutes";
import getPageBootstrap from "src/auth/queries/getPageBootstrap";
import { MyApp } from "src/pages/_app";

vi.mock("src/auth/queries/getPageBootstrap", () => ({ default: vi.fn() }));
vi.mock("next/app", () => ({ default: { getInitialProps: vi.fn() } }));
vi.mock("src/blitz-client", () => ({ queryClient: {}, withBlitz: (app: unknown) => app }));

describe("restored File page permissions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(["/backstage/files", "/backstage/file/[...id_slug_tab]", "/backstage/editFiles"])(
        "returns an uncached 403 for denied SSR %s without running its page loader", async pathname => {
            vi.mocked(getPageBootstrap).mockRejectedValue(new AuthorizationError());
            const response = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() };
            // Rejected bootstrap reads only these Next request/response fields, before page rendering.
            const context = { ctx: { pathname, query: {}, req: { headers: {} }, res: response } } as unknown as AppContext;
            expect(await MyApp.getInitialProps(context)).toEqual({ pageProps: {} });
            expect(response.statusCode).toBe(403);
            expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
            expect(response.end).toHaveBeenCalledOnce();
            expect(NextApp.getInitialProps).not.toHaveBeenCalled();
        },
    );
});
