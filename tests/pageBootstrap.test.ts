import { parsePortalPath } from "src/route/portalRouting";
import { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";
import { AuthenticationError, NotFoundError } from "blitz";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { createAuthorizationTestContext } from "./authorization/support/authorizationFixtures";
import type * as PortalRequestModule from "src/route/server/portalRequest";
import { CmdbRouteRegistry } from "src/route/cmdbRoutes";
import type { PageBootstrapInput } from "src/auth/queries/getPageBootstrap";

// The boundary tests fake its server services; native tests exercise real snapshots and grants.
const services = vi.hoisted(() => ({
    session: vi.fn(), authorize: vi.fn(), presentation: vi.fn(), brand: vi.fn(), availability: vi.fn(),
}));
vi.mock("src/blitz-server", () => ({ getSessionForRequest: services.session }));
vi.mock("src/auth/server/pageRequestAuthorization", () => ({ loadPageAuthorization: services.authorize }));
vi.mock("src/locale/server/presentation", () => ({ loadPresentationData: services.presentation }));
vi.mock("src/server/brand", () => ({ loadDbBrandConfig: services.brand }));
vi.mock("src/route/server/portalRequest", async () => {
    const actual = await vi.importActual<typeof PortalRequestModule>("src/route/server/portalRequest");
    return { ...actual };
});
import getPageBootstrap from "src/auth/queries/getPageBootstrap";

const context = createAuthorizationTestContext(null);
const bandPublicId = parsePublicId<"Band">("BootstrapBand001");
const input: PageBootstrapInput = { routeKey: "bandProfile", requestPath: parsePortalPath(`/fr-BE/b/${bandPublicId}/profile`, { kind: "multiBand" }), browserLanguages: ["nl-BE"] };
const authorization = { band: { id: 17 }, hasPermission: vi.fn(() => false) };
beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CMDB_BASE_URL", "https://band.example.test");
    vi.stubEnv("CMDB_HOSTING_MODE", "Platform");
    vi.stubEnv("CMDB_START_TIME", String(Date.parse("2026-10-18T10:00:00.000Z")));
    vi.stubEnv("CMDB_GIT_COMMIT_DATE", "2026-10-17T12:30:00.000Z");
    services.availability.mockResolvedValue(undefined);
    services.session.mockResolvedValue(context.session);
    services.authorize.mockResolvedValue(authorization);
    authorization.hasPermission.mockReturnValue(false);
    services.presentation.mockResolvedValue({ input: { bandPublicId } });
    services.brand.mockResolvedValue({ siteTitle: "Selected band" });
});

afterEach(() => { vi.unstubAllEnvs(); });

describe("page bootstrap server boundary", () => {
    it("provides public routing configuration without sending diagnostics to non-Sysadmins", async () => {
        const result = await getPageBootstrap(input, context);
        expect(result.routing).toEqual({ baseUri: "https://band.example.test", hosting: { kind: "multiBand" }, requestPath: input.requestPath });
        expect(result.serverStartupState).toBeNull();
        expect(services.presentation).toHaveBeenCalledWith(authorization, {
            bandPublicId, routeLocale: "fr-BE", browserLanguages: ["nl-BE"],
        });
    });
    it("provides diagnostics only when the current authorization grants Sysadmin", async () => {
        authorization.hasPermission.mockReturnValue(true);
        vi.stubEnv("CMDB_GIT_REVISION", "test-revision");
        const result = await getPageBootstrap(input, context);
        expect(result.serverStartupState?.gitRevision).toBe("test-revision");
        expect(result.serverStartupState?.startedAt).toBe("2026-10-18T10:00:00.000Z");
        expect(result.serverStartupState?.gitCommitDate).toBe("2026-10-17T12:30:00.000Z");
        expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    });
    it("loads platform branding without band context on ordinary platform pages", async () => {
        services.authorize.mockResolvedValue({ ...authorization, band: null });
        const requestPath = parsePortalPath("/fr-BE/platform/adminUsers", { kind: "multiBand" });
        const result = await getPageBootstrap({ ...input, routeKey: "platformAdminUsers", requestPath }, context);
        expect(result.routing.requestPath.bandPublicId).toBeNull();
        expect(services.brand).toHaveBeenCalledWith({ hostHeader: undefined, bandId: null, freshness: "refresh", pageTheming: "platform" });
        expect(services.presentation).toHaveBeenCalledWith(expect.objectContaining({ band: null }), {
            bandPublicId: null, routeLocale: "fr-BE", browserLanguages: ["nl-BE"],
        });
    });
    it("establishes the SSR session from its trusted request and response", async () => {
        const request = new IncomingMessage(new Socket());
        request.headers.host = "band.example.test";
        const response = new ServerResponse(request);
        await getPageBootstrap(input, { req: request, res: response });
        expect(services.session).toHaveBeenCalledWith(request, response);
        expect(services.brand).toHaveBeenCalledWith({ hostHeader: "band.example.test", bandId: 17, freshness: "refresh", pageTheming: "band" });
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
        await expect(getPageBootstrap({ ...input, routeKey: "customLink" }, context)).rejects.toBeInstanceOf(NotFoundError);
        expect(services.authorize).toHaveBeenCalledOnce();
        expect(services.presentation).not.toHaveBeenCalled();
        expect(services.brand).not.toHaveBeenCalled();
    });

    it("uses the event registry identity with a concrete external URL", async () => {
        const requestPath = parsePortalPath("/b/LRnHh3DGxoKiKKI7/event/VgZu46IcAJqE1Gci/rehearsal/info", { kind: "multiBand" });
        const result = await getPageBootstrap({ ...input, routeKey: "bandEvent", requestPath }, context);
        expect(services.authorize).toHaveBeenCalledWith(CmdbRouteRegistry.routeByKey("bandEvent"), context.session, requestPath.bandPublicId);
        expect(result.routeKey).toBe("bandEvent");
        expect(services.brand).toHaveBeenCalledWith({ hostHeader: undefined, bandId: 17, freshness: "refresh", pageTheming: "band" });
    });

    it("uses platform theming for a platform-themed page inside a band portal", async () => {
        const requestPath = parsePortalPath(`/b/${bandPublicId}/adminLogs`, { kind: "multiBand" });
        const result = await getPageBootstrap({ ...input, routeKey: "adminLogs", requestPath }, context);
        expect(services.authorize).toHaveBeenCalledWith(CmdbRouteRegistry.routeByKey("adminLogs"), context.session, bandPublicId);
        expect(result.routeKey).toBe("adminLogs");
        expect(services.brand).toHaveBeenCalledWith({ hostHeader: undefined, bandId: 17, freshness: "refresh", pageTheming: "platform" });
    });

    it.each(["unknown", "constructor", "__proto__", "toString", "/backstage/profile", undefined, null])(
        "rejects invalid RPC route identities before calling server services: %s", async routeKey => {
            // Simulate an untyped RPC payload; runtime validation must reject it.
            const forgedInput = { ...input, routeKey } as PageBootstrapInput;
            await expect(getPageBootstrap(forgedInput, context)).rejects.toThrow("Invalid route key");
            expect(services.session).not.toHaveBeenCalled();
            expect(services.authorize).not.toHaveBeenCalled();
            expect(services.presentation).not.toHaveBeenCalled();
            expect(services.brand).not.toHaveBeenCalled();
        },
    );
});
