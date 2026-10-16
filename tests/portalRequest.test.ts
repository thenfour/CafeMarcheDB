import { NotFoundError } from "blitz";
import db from "db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { assertAuthorizationBandScope, withAuthorizationBandScope } from "src/auth/server/requestAuthorizationScope";
import { PORTAL_PATH_HEADER } from "src/route/portalRouting";
import { resolvePortalRequest } from "src/route/server/portalRequest";

const reads = vi.hoisted(() => ({ band: vi.fn(), locale: vi.fn() }));
vi.mock("db", () => ({ default: { band: { findFirst: reads.band }, locale: { findFirst: reads.locale } } }));
const first = parsePublicId<"Band">("PortalBand000001");
const second = parsePublicId<"Band">("PortalBand000002");
beforeEach(() => {
    vi.stubEnv("CMDB_BASE_URL", "https://portal.test");
    vi.stubEnv("CMDB_HOSTING_MODE", "Platform");
    reads.band.mockReset().mockResolvedValue({ id: 7 });
    reads.locale.mockReset().mockResolvedValue({ id: 3 });
});
afterEach(() => { vi.unstubAllEnvs(); });
const request = (url: string, host = "portal.test") => ({ url, headers: { host } });

describe("server portal request validation", () => {
    it("validates rewritten metadata against deployment and original path context", () => {
        expect(resolvePortalRequest({
            url: `/backstage/events?bandPublicId=${first}&routeLocale=fr-BE`,
            headers: { host: "portal.test", [PORTAL_PATH_HEADER]: `/fr-BE/b/${first}/backstage/events` }
        }))
            .toMatchObject({ pathname: "/backstage/events", selection: { bandPublicId: first, routeLocale: "fr-BE" } });
    });
    it.each(["evil.test", "portal.test:8080", "portal.test@evil.test", "portal.test,evil.test", "[", ""])("rejects unconfigured host %s", host => {
        expect(() => resolvePortalRequest(request(`/b/${first}/backstage`, host))).toThrow(NotFoundError);
    });
    it("does not accept forwarded-host hints in place of the configured host", () => {
        expect(() => resolvePortalRequest({ url: "/backstage", headers: { host: "evil.test", "x-forwarded-host": "portal.test" } })).toThrow(NotFoundError);
    });
    it.each([`/b/${first}/backstage?bandPublicId=${second}`, `/backstage?bandPublicId=${first}&bandPublicId=${second}`,
        "/fr/backstage?routeLocale=nl", "/backstage?routeLocale=fr&routeLocale=nl"])("rejects ambiguous request %s", url => {
            expect(() => resolvePortalRequest(request(url))).toThrow(NotFoundError);
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
