import type { GetServerSidePropsContext } from "next";
import type { IncomingMessage } from "node:http";
import type * as PortalRequestModule from "src/route/server/portalRequest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ feed: vi.fn(), authorization: vi.fn() }));
vi.mock("db", () => ({ default: {} }));
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorizationForUser: mocked.authorization }));
vi.mock("src/core/db3/server/publicFeed", () => ({ readPublicFeed: mocked.feed }));
vi.mock("src/core/components/frontpage/CMFrontpage", () => ({ CMPublicIndex: () => null }));
vi.mock("src/route/server/portalRequest", async () => {
    const actual = await vi.importActual<typeof PortalRequestModule>("src/route/server/portalRequest");
    return { ...actual, withPortalRequest: async (request: IncomingMessage, work: (portal: PortalRequestModule.PortalRequest) => Promise<unknown>) =>
        work(actual.resolvePortalRequest(request)) };
});
import { getServerSideProps } from "src/pages/index";

const firstBand = "PublicationBand1";
const secondBand = "PublicationBand2";
function page(query: GetServerSidePropsContext["query"] = {}, locale = "en", acceptLanguage = "fr-CA,nl-NL;q=0.8") {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        for (const item of Array.isArray(value) ? value : [value]) {
            if (item !== undefined) {
                search.append(key, item);
            }
        }
    }
    // Next supplies its remaining context fields; this fixture models the actual incoming URL and host.
    const context = { query, req: { url: `${locale === "en" ? "/" : `/${locale}`}?${search}`,
        headers: { host: "publication.invalid", "accept-language": acceptLanguage } },
        res: { setHeader: vi.fn() } } as unknown as GetServerSidePropsContext;
    return getServerSideProps(context);
}
beforeEach(() => {
    vi.stubEnv("CMDB_HOSTING_MODE", "CafeMarche");
    vi.stubEnv("CMDB_PUBLIC_BAND_PUBLIC_ID", firstBand);
    vi.stubEnv("CMDB_BASE_URL", "https://publication.invalid");
    mocked.feed.mockReset().mockResolvedValue({ agenda: [], gallery: [] });
    mocked.authorization.mockReset().mockResolvedValue("public authorization");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("public homepage request selection", () => {
    it("binds the bare Café Marché root to trusted configuration and preserves browser preference order", async () => {
        expect(await page()).toMatchObject({ props: { lang: "fr", selection: {
            bandPublicId: firstBand, routeLocale: null, browserLanguages: ["fr-CA", "nl-NL"],
        } } });
        expect(mocked.authorization).toHaveBeenCalledWith(null, undefined, firstBand);
        expect(mocked.feed.mock.calls[0]?.[1]).toBe("public authorization");
    });
    it("rejects foreign bands and conflicting locale selections on the configured host", async () => {
        expect(await page({ bandPublicId: secondBand, routeLocale: "nl-NL" }, "fr")).toEqual({ notFound: true });
        expect(mocked.feed).not.toHaveBeenCalled();
        expect(mocked.authorization).not.toHaveBeenCalled();
    });
    it("retains /fr and /nl as explicit preferences while the default prefix leaves browser order intact", async () => {
        expect(await page({}, "fr")).toMatchObject({ props: { lang: "fr", selection: { routeLocale: "fr" } } });
        expect(await page({}, "nl")).toMatchObject({ props: { lang: "nl", selection: { routeLocale: "nl" } } });
    });
    it("does not infer a band when Café Marché host configuration is absent", async () => {
        vi.stubEnv("CMDB_PUBLIC_BAND_PUBLIC_ID", "");
        expect(await page()).toEqual({ notFound: true });
        expect(mocked.feed).not.toHaveBeenCalled();
        expect(mocked.authorization).not.toHaveBeenCalled();
    });
    it.each([{ bandPublicId: "bad" }, { bandPublicId: [firstBand, secondBand] }, { routeLocale: "invalid_locale" }])("returns 404 for invalid homepage selection %j", async query => {
        expect(await page(query)).toEqual({ notFound: true });
    });
    it("retains generic hosting's familiar Backstage redirect and no publication read", async () => {
        vi.stubEnv("CMDB_HOSTING_MODE", "GenericSingleTenant");
        expect(await page({ bandPublicId: firstBand, routeLocale: "nl-NL" })).toEqual({ redirect: {
            destination: "/nl-NL/backstage", permanent: false,
        } });
        expect(mocked.feed).not.toHaveBeenCalled();
        expect(mocked.authorization).not.toHaveBeenCalled();
    });
});
