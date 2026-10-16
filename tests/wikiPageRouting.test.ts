import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { parsePortalPath, PORTAL_PATH_QUERY_PARAM, type BandHostingConfig } from "src/route/portalRouting";

const services = vi.hoisted(() => ({ authorize: vi.fn(), readWiki: vi.fn(), bands: vi.fn() }));
vi.mock("src/blitz-server", () => ({ gSSP: (handler: unknown) => handler }));
vi.mock("db", async () => ({
    ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
    default: { band: { findMany: services.bands } },
}));
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: services.authorize }));
vi.mock("src/core/wiki/server/getWikiPageCore", () => ({ GetWikiPageCore: services.readWiki }));

import { getServerSideProps } from "src/pages/backstage/wiki/[...slug]";

const bandPublicId = parsePublicId<"Band">("WikiRouteBand001");
const session = {};
const authorization = { user: { id: 1 }, hasPermission: () => true };
const multi: BandHostingConfig = { kind: "multiBand" };

async function loadPage(externalPathname: string, hosting: BandHostingConfig) {
    const path = parsePortalPath(externalPathname, hosting);
    // The mocked gSSP wrapper uses only these request context members.
    return getServerSideProps({
        params: { slug: ["handbook"] },
        query: { [PORTAL_PATH_QUERY_PARAM]: JSON.stringify(path), bandPublicId: "ForgedBand00001" },
        req: { headers: {} }, res: {}, ctx: { session },
    } as unknown as Parameters<typeof getServerSideProps>[0]);
}

beforeEach(() => {
    vi.resetAllMocks();
    services.authorize.mockResolvedValue(authorization);
    services.bands.mockResolvedValue([{ publicId: bandPublicId }]);
    services.readWiki.mockResolvedValue({ wikiPage: null });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("wiki page route context", () => {
    it("uses the parsed band route instead of an application query parameter", async () => {
        await loadPage(`/fr/b/${bandPublicId}/wiki/handbook`, multi);
        expect(services.authorize).toHaveBeenCalledWith(session, bandPublicId);
        expect(services.readWiki).toHaveBeenCalledWith(expect.objectContaining({ authorization, canonicalWikiSlug: "handbook" }));
    });
    it("resolves a single-band installation before loading the page", async () => {
        vi.stubEnv("CMDB_HOSTING_MODE", "GenericSingleTenant");
        await loadPage("/b/wiki/handbook", { kind: "singleBand", tenant: "generic" });
        expect(services.authorize).toHaveBeenCalledWith(session, bandPublicId);
        expect(services.bands).toHaveBeenCalledOnce();
    });
    it("keeps platform wiki routes unscoped", async () => {
        await loadPage("/platform/wiki/handbook", multi);
        expect(services.authorize).toHaveBeenCalledWith(session, undefined);
        expect(services.readWiki).not.toHaveBeenCalled();
    });
});
