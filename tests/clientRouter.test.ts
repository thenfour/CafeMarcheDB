import { describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { parsePortalPath, PORTAL_PATH_QUERY_PARAM } from "src/route/portalRouting";
import { createTestRouter } from "./support/routing";

const band = parsePublicId<"Band">("PortalBand000001");
const nextBand = parsePublicId<"Band">("PortalBand000002");
const hosting = { kind: "multiBand" } as const;

describe("client routing adapter", () => {
    it("exposes page parameters without internal rewrite metadata", () => {
        const router = createTestRouter({ baseUri: "https://portal.test", hosting, requestPath: parsePortalPath("/backstage", hosting) },
            { query: { filter: ["a", "b"], id_slug_tab: ["PERSON", "name"], [PORTAL_PATH_QUERY_PARAM]: "internal" } });
        expect(router.query).toEqual({ filter: ["a", "b"], id_slug_tab: ["PERSON", "name"] });
    });
    it("keeps same-page filters and fragments while recording a tab change in browser history", async () => {
        const push = vi.fn(async () => true);
        const router = createTestRouter({ baseUri: "https://portal.test", hosting, requestPath: parsePortalPath(`/fr/b/${band}/backstage/user/PERSON/name/credits`, hosting) },
            { push, asPath: `/fr/b/${band}/backstage/user/PERSON/name/credits?q=a&q=b#answer` });
        await router.pushCurrentPage(router.href("/backstage/user/PERSON/name/wiki"));
        expect(push).toHaveBeenCalledWith(`/fr/b/${band}/backstage/user/PERSON/name/wiki?q=a&q=b#answer`, undefined, { shallow: true });
    });
    it("navigates a destination-band href without applying the current band again", async () => {
        const push = vi.fn(async () => true);
        const router = createTestRouter({ baseUri: "https://portal.test", hosting, requestPath: parsePortalPath(`/fr/b/${band}/backstage`, hosting) }, { push });
        const href = router.href("/backstage", { bandPublicId: nextBand, routeLocale: null });
        await router.push(href);
        expect(push).toHaveBeenCalledWith(`/b/${nextBand}/backstage`, undefined, undefined);
    });
    it("keeps the current shallow slug/tab, repeated query values and fragment when changing language", async () => {
        const push = vi.fn(async () => true);
        const router = createTestRouter({ baseUri: "https://portal.test", hosting, requestPath: parsePortalPath(`/fr/b/${band}/backstage/song/SONG/old-name/info`, hosting) },
            { push, asPath: `/fr/b/${band}/backstage/song/SONG/name/files?q=a&q=b#answer` });
        await router.switchLanguage("nl-BE");
        expect(push).toHaveBeenCalledWith(`/nl-BE/b/${band}/backstage/song/SONG/name/files?q=a&q=b#answer`, undefined, undefined);
        await router.switchLanguage(null);
        expect(push).toHaveBeenLastCalledWith(`/b/${band}/backstage/song/SONG/name/files?q=a&q=b#answer`, undefined, undefined);
    });
});
