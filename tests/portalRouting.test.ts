import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { parsePortalPath, portalHref, getServerBandHostingConfig, retainPortalPageState, type BandHostingConfig } from "src/route/portalRouting";
import { customLinkHref } from "src/core/db3/shared/entities/customLink/customLinkUrl";

const first = parsePublicId<"Band">("PortalBand000001");
const second = parsePublicId<"Band">("PortalBand000002");
const platform: BandHostingConfig = { kind: "platform" };
const standalone: BandHostingConfig = { kind: "standalone", tenant: "generic" };

describe("server hosting configuration", () => {
    afterEach(() => { vi.unstubAllEnvs(); });

    it("uses the test environment's explicit platform configuration", () => {
        expect(getServerBandHostingConfig()).toEqual(platform);
    });

    it.each([undefined, "", "platform", "invalid"])("rejects missing or invalid hosting mode %s", mode => {
        vi.stubEnv("CMDB_HOSTING_MODE", mode ?? "");
        if (mode === undefined) {
            delete process.env.CMDB_HOSTING_MODE;
        }
        expect(() => getServerBandHostingConfig()).toThrow(`Invalid hosting mode: ${mode}`);
    });

});

describe("portal route identities and deployment policy", () => {
    it("retains existing filters, repeated query values and hash while canonicalizing a detail tab", () => {
        expect(retainPortalPageState(`/nl-BE/b/${first}/backstage/event/PortalEvent0001/new-name/attendance?tab=active`,
            `/fr-BE/b/${first}/backstage/event/PortalEvent0001/old-name/info?probe=keep&filter=a&filter=b&bandPublicId=${first}&routeLocale=fr-BE#answer`))
            .toBe(`/nl-BE/b/${first}/backstage/event/PortalEvent0001/new-name/attendance?tab=active&probe=keep&filter=a&filter=b#answer`);
        expect(retainPortalPageState(`https://portal.test/b/${first}/backstage/song/PortalSong00001/new-name/files`, "/backstage/song/old?probe=keep#answer"))
            .toBe(`https://portal.test/b/${first}/backstage/song/PortalSong00001/new-name/files?probe=keep#answer`);
    });
    it.each(["/backstage/events", "/backstage/wiki/handbook", "/api/files/download/photo.png", "/tickets/summer"])(
        "mounts the existing path %s without changing its page identity", pathname => {
            expect(parsePortalPath(`/fr-be/b/${first}${pathname}`)).toMatchObject({ pathname, bandPublicId: first, routeLocale: "fr-BE" });
            expect(portalHref(pathname, { bandPublicId: first, routeLocale: "fr-BE" }, platform)).toBe(`/fr-BE/b/${first}${pathname}`);
            expect(portalHref(pathname, { bandPublicId: first, routeLocale: "fr-BE" }, standalone)).toBe(`/fr-BE${pathname}`);
        });
    it("retains browser preference order by omitting a locale from a shareable URL", () => {
        const href = portalHref("/backstage/events?q=brass#summer", { bandPublicId: first }, platform);
        expect(href).toBe(`/b/${first}/backstage/events?q=brass#summer`);
        expect(parsePortalPath(new URL(href, "https://portal.test").pathname).routeLocale).toBeNull();
    });
    it("switches equivalent pages while retaining query, hash and public identity", () => {
        const previous = `/fr-BE/b/${first}/backstage/event/PortalEvent0001/rehearsal/attendance?page=2&bandPublicId=${first}&routeLocale=fr-BE#answer`;
        expect(portalHref(previous, { bandPublicId: first, routeLocale: "nl-BE" }, platform))
            .toBe(`/nl-BE/b/${first}/backstage/event/PortalEvent0001/rehearsal/attendance?page=2#answer`);
        expect(portalHref(previous, { bandPublicId: first, routeLocale: null }, platform))
            .toBe(`/b/${first}/backstage/event/PortalEvent0001/rehearsal/attendance?page=2#answer`);
    });
    it("keeps custom-link namespaces independent of page and locale names", () => {
        expect(customLinkHref("fr/backstage/calendar", first, platform)).toBe(`/b/${first}/fr/backstage/calendar`);
        expect(parsePortalPath(`/b/${first}/fr/backstage/calendar`).pathname).toBe("/fr/backstage/calendar");
        expect(customLinkHref("tickets/summer", first, standalone)).toBe("/tickets/summer");
    });
    it("keeps mutable band names out of URLs", () => {
        expect(portalHref("/backstage", { bandPublicId: first }, platform)).toBe(`/b/${first}/backstage`);
    });
    it("parses paths correctly without locale or band", () => {
        const r = {
            "bandPublicId": null,
            "hasBandPrefix": false,
            "hasLocalePrefix": false,
            "hasPlatformPrefix": false,
            "pathname": "/backstage/events",
            "routeLocale": null,
        }
        expect(parsePortalPath("/backstage/events")).toEqual(r);
        expect(parsePortalPath("/fr/backstage")).toEqual({ ...r, routeLocale: "fr", pathname: "/backstage", hasLocalePrefix: true });
    });

    it("keeps band and platform page identities distinct through locale and hosting rewrites", () => {
        const bandHref = portalHref("/backstage/settings", { bandPublicId: first, routeLocale: "fr-BE" }, platform);
        expect(parsePortalPath(bandHref)).toMatchObject({ pathname: "/backstage/settings", bandPublicId: first });
        for (const hosting of [platform, standalone]) {
            const platformHref = portalHref("/backstage/platform-settings", { bandPublicId: null, routeLocale: "fr-BE" }, hosting);
            const path = parsePortalPath(platformHref);
            expect(path).toMatchObject({ pathname: "/backstage/platform-settings", bandPublicId: null });
        }
    });
});
