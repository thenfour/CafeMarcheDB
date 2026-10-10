import { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";
import { AuthenticationError, NotFoundError } from "blitz";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { createAuthorizationTestContext } from "./authorization/support/authorizationFixtures";

// The boundary tests fake its server services; native tests exercise real snapshots and grants.
const services = vi.hoisted(() => ({
    session: vi.fn(), authorize: vi.fn(), presentation: vi.fn(), brand: vi.fn(),
}));
vi.mock("src/blitz-server", () => ({ getSessionForRequest: services.session }));
vi.mock("src/auth/server/pageRequestAuthorization", () => ({ loadPageAuthorization: services.authorize }));
vi.mock("src/locale/server/presentation", () => ({ loadPresentationData: services.presentation }));
vi.mock("src/server/brand", () => ({ loadDbBrandConfig: services.brand }));
import getPageBootstrap from "src/auth/queries/getPageBootstrap";

const context = createAuthorizationTestContext(null);
const bandPublicId = parsePublicId<"Band">("BootstrapBand001");
const input = { pathname: "/backstage/profile", bandPublicId, routeLocale: "fr-BE", browserLanguages: ["nl-BE"] };
const authorization = { band: { id: 17 } };
beforeEach(() => {
    vi.resetAllMocks();
    services.session.mockResolvedValue(context.session);
    services.authorize.mockResolvedValue(authorization);
    services.presentation.mockResolvedValue({ input: { bandPublicId } });
    services.brand.mockResolvedValue({ siteTitle: "Selected band" });
});

describe("page bootstrap server boundary", () => {
    it("authorizes the explicit route and band before loading presentation and branding for RPC navigation", async () => {
        const result = await getPageBootstrap(input, context);
        expect(services.session).not.toHaveBeenCalled();
        expect(services.authorize).toHaveBeenCalledWith(input.pathname, context.session, bandPublicId);
        expect(services.presentation).toHaveBeenCalledWith(authorization, {
            bandPublicId, routeLocale: "fr-BE", browserLanguages: ["nl-BE"],
        });
        expect(services.brand).toHaveBeenCalledWith({ hostHeader: undefined, bandId: 17, freshness: "refresh" });
        expect(services.authorize.mock.invocationCallOrder[0]).toBeLessThan(services.presentation.mock.invocationCallOrder[0]!);
        expect(result).toEqual({ presentation: { input: { bandPublicId } }, brand: { siteTitle: "Selected band" } });
    });

    it("establishes the SSR session from its trusted request and response", async () => {
        const request = new IncomingMessage(new Socket());
        request.headers.host = "band.example.test";
        const response = new ServerResponse(request);
        await getPageBootstrap(input, { req: request, res: response });
        expect(services.session).toHaveBeenCalledWith(request, response);
        expect(services.brand).toHaveBeenCalledWith({ hostHeader: "band.example.test", bandId: 17, freshness: "refresh" });
    });

    it("does not read page data after route authorization rejects the session", async () => {
        services.authorize.mockRejectedValue(new AuthenticationError());
        await expect(getPageBootstrap(input, context)).rejects.toBeInstanceOf(AuthenticationError);
        expect(services.presentation).not.toHaveBeenCalled();
        expect(services.brand).not.toHaveBeenCalled();
    });

    it("does not accept client-supplied host or internal band identity", async () => {
        const forgedHost = { ...input, host: "forged.example.test" };
        const internalIdentity = { ...input, bandId: 17 };
        await expect(getPageBootstrap(forgedHost, context)).rejects.toThrow();
        await expect(getPageBootstrap(internalIdentity, context)).rejects.toThrow();
        expect(services.authorize).not.toHaveBeenCalled();
    });

    it("propagates unavailable custom-link bands without loading unscoped page data", async () => {
        services.authorize.mockRejectedValue(new NotFoundError());
        await expect(getPageBootstrap({ ...input, pathname: "/[...customLinkSlug]" }, context)).rejects.toBeInstanceOf(NotFoundError);
        expect(services.authorize).toHaveBeenCalledOnce();
        expect(services.presentation).not.toHaveBeenCalled();
        expect(services.brand).not.toHaveBeenCalled();
    });
});
