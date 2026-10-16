import { NotFoundError } from "blitz";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { assertAuthorizationBandScope, withAuthorizationBandScope } from "src/auth/server/requestAuthorizationScope";
import { parsePortalPath, serializePortalPath, type BandHostingConfig } from "src/route/portalRouting";
import { resolvePortalPath, resolvePortalRequestContext, withPortalRequest } from "src/route/server/portalRequest";

const reads = vi.hoisted(() => ({ bands: vi.fn() }));
vi.mock("db", () => ({ default: { band: { findMany: reads.bands } } }));
const first = parsePublicId<"Band">("PortalBand000001");
const second = parsePublicId<"Band">("PortalBand000002");
const multi: BandHostingConfig = { kind: "multiBand" };
const single: BandHostingConfig = { kind: "singleBand", tenant: "generic" };
beforeEach(() => {
    vi.stubEnv("CMDB_BASE_URL", "https://portal.test");
    vi.stubEnv("CMDB_HOSTING_MODE", "Platform");
    reads.bands.mockReset().mockResolvedValue([{ publicId: first }]);
});
afterEach(() => { vi.unstubAllEnvs(); });

function request(externalPathname: string, hosting: BandHostingConfig) {
    const path = parsePortalPath(externalPathname, hosting);
    const query = new URLSearchParams();
    serializePortalPath(query, path);
    return { url: `${path.internalPathname}?${query}`, headers: { host: "internal-proxy" } };
}

describe("server portal request resolution", () => {
    it("deserializes middleware metadata without interpreting the rewritten pathname again", async () => {
        const portal = await resolvePortalRequestContext(request(`/fr-BE/b/${first}/backstage/events`, multi));
        expect(portal.requestPath).toMatchObject({ internalPathname: "/backstage/events", bandPublicId: first, routeLocale: "fr-BE" });
        expect(reads.bands).not.toHaveBeenCalled();
    });
    it("requires serialized metadata at the request boundary", async () => {
        await expect(resolvePortalRequestContext({ url: `/backstage?bandPublicId=${first}`, headers: {} })).rejects.toThrow();
    });
    it("resolves the single database band only for an explicit /b prefix", async () => {
        vi.stubEnv("CMDB_HOSTING_MODE", "GenericSingleTenant");
        expect((await resolvePortalRequestContext(request("/fr/b/backstage", single))).requestPath.bandPublicId).toBe(first);
        expect(reads.bands).toHaveBeenCalledOnce();
        expect((await resolvePortalRequestContext(request("/fr/backstage", single))).requestPath.bandPublicId).toBeNull();
        expect(reads.bands).toHaveBeenCalledOnce();
    });
    it("reuses a request's resolution across server consumers", async () => {
        vi.stubEnv("CMDB_HOSTING_MODE", "GenericSingleTenant");
        const incoming = request("/b/backstage", single);
        const [one, two] = await Promise.all([resolvePortalRequestContext(incoming), resolvePortalRequestContext(incoming)]);
        expect(one).toBe(two);
        expect(reads.bands).toHaveBeenCalledOnce();
    });
    it.each([{ bands: [] }, { bands: [{ publicId: first }, { publicId: second }] }])("rejects a single-band database that does not contain exactly one band", async ({ bands }) => {
        vi.stubEnv("CMDB_HOSTING_MODE", "GenericSingleTenant");
        reads.bands.mockResolvedValue(bands);
        await expect(resolvePortalRequestContext(request("/b/backstage", single))).rejects.toThrow("exactly one Band");
    });
    it("rejects a supplied single-band ID that differs from the database band", async () => {
        const path = { ...parsePortalPath("/b/backstage", single), bandPublicId: second };
        await expect(resolvePortalPath(path, single)).rejects.toBeInstanceOf(NotFoundError);
    });
    it("establishes the resolved band constraint before invoking an operation", async () => {
        vi.stubEnv("CMDB_HOSTING_MODE", "GenericSingleTenant");
        await withPortalRequest(request("/b/api/rpc/query", single), async () => {
            expect(() => assertAuthorizationBandScope(second)).toThrow(NotFoundError);
        });
    });
});

describe("request authorization band scope", () => {
    it("fences explicit domain payloads while preserving explicit account operations", async () => {
        await withAuthorizationBandScope(first, async () => {
            expect(() => assertAuthorizationBandScope(first)).not.toThrow();
            expect(() => assertAuthorizationBandScope(null)).not.toThrow();
            expect(() => assertAuthorizationBandScope(undefined)).not.toThrow();
            expect(() => assertAuthorizationBandScope(second)).toThrow(NotFoundError);
        });
        expect(() => assertAuthorizationBandScope(second)).not.toThrow();
    });
    it("isolates concurrent requests and restores scope after a rejected operation", async () => {
        await Promise.all([first, second].map(band => withAuthorizationBandScope(band, async () => {
            await Promise.resolve();
            expect(() => assertAuthorizationBandScope(band)).not.toThrow();
            expect(() => assertAuthorizationBandScope(band === first ? second : first)).toThrow(NotFoundError);
        })));
        await expect(withAuthorizationBandScope(first, async () => { throw new Error("rejected"); })).rejects.toThrow("rejected");
        expect(() => assertAuthorizationBandScope(second)).not.toThrow();
    });
    it("keeps the transport constraint through nested account and band operations", async () => {
        await withAuthorizationBandScope(first, async () => {
            await withAuthorizationBandScope(null, async () => {
                expect(() => assertAuthorizationBandScope(second)).toThrow(NotFoundError);
            });
            expect(() => withAuthorizationBandScope(second, async () => { })).toThrow(NotFoundError);
        });
    });
});
