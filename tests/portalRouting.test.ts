import { describe, expect, it } from "vitest";
import { HostingMode } from "shared/brandConfigBase";
import { parsePublicId } from "shared/publicId";
import { parsePortalPath, portalHref, getServerBandHostingConfig, retainPortalPageState, selectPortalContext, type BandHostingConfig } from "src/route/portalRouting";
import { customLinkHref } from "src/core/db3/shared/entities/customLink/customLinkUrl";

const first = parsePublicId<"Band">("PortalBand000001");
const second = parsePublicId<"Band">("PortalBand000002");
const platform: BandHostingConfig = { kind: "platform" };
const standalone: BandHostingConfig = { kind: "standalone", bandPublicId: first, tenant: "generic" };

describe("portal route identities and deployment policy", () => {
    it("retains existing filters, repeated query values and hash while canonicalizing a detail tab", () => {
        expect(retainPortalPageState(`/nl-BE/b/${first}/backstage/event/PortalEvent0001/new-name/attendance?tab=active`,
            `/fr-BE/b/${first}/backstage/event/PortalEvent0001/old-name/info?probe=keep&filter=a&filter=b&bandPublicId=${first}&routeLocale=fr-BE#answer`))
            .toBe(`/nl-BE/b/${first}/backstage/event/PortalEvent0001/new-name/attendance?tab=active&probe=keep&filter=a&filter=b#answer`);
        expect(retainPortalPageState(`https://portal.test/b/${first}/backstage/song/PortalSong00001/new-name/files`, "/backstage/song/old?probe=keep#answer"))
            .toBe(`https://portal.test/b/${first}/backstage/song/PortalSong00001/new-name/files?probe=keep#answer`);
    });
    it.each([undefined, "Platform"])("uses platform hosting for %s", mode => {
        expect(getServerBandHostingConfig(mode, undefined)).toEqual(platform);
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
    it("binds familiar standalone paths to their configured band", () => {
        expect(selectPortalContext(parsePortalPath("/backstage/events"), {}, standalone)).toEqual({ bandPublicId: first, routeLocale: null });
        expect(selectPortalContext(parsePortalPath("/fr/backstage"), {}, standalone)).toEqual({ bandPublicId: first, routeLocale: "fr" });
    });
    it("keeps shared account pages explicitly unscoped on a standalone host", () => {
        expect(portalHref("/backstage/platform-user/PortalPerson001", { bandPublicId: null, routeLocale: "fr-BE" }, standalone))
            .toBe("/fr-BE/platform/backstage/platform-user/PortalPerson001");
        expect(selectPortalContext(parsePortalPath("/fr-BE/platform/backstage/platform-adminUsers"), {}, standalone))
            .toEqual({ bandPublicId: null, routeLocale: "fr-BE" });
    });
    it("keeps band and platform page identities distinct through locale and hosting rewrites", () => {
        const bandHref = portalHref("/backstage/settings", { bandPublicId: first, routeLocale: "fr-BE" }, platform);
        expect(parsePortalPath(bandHref)).toMatchObject({ pathname: "/backstage/settings", bandPublicId: first });
        for (const hosting of [platform, standalone]) {
            const platformHref = portalHref("/backstage/platform-settings", { bandPublicId: null, routeLocale: "fr-BE" }, hosting);
            const path = parsePortalPath(platformHref);
            expect(path).toMatchObject({ pathname: "/backstage/platform-settings", bandPublicId: null });
            expect(selectPortalContext(path, {}, hosting).bandPublicId).toBeNull();
        }
    });
    it.each([
        `/b/${first}/backstage?bandPublicId=${second}`,
        `/fr-BE/b/${first}/backstage?routeLocale=nl-BE`,
        `/platform/backstage?bandPublicId=${first}`,
    ])("rejects conflicting selections in %s", href => {
        const url = new URL(href, "https://portal.test");
        const band = url.searchParams.get("bandPublicId");
        expect(() => selectPortalContext(parsePortalPath(url.pathname), {
            bandPublicId: band ? parsePublicId<"Band">(band) : null, routeLocale: url.searchParams.get("routeLocale"),
        }, platform)).toThrow();
    });
    it("rejects foreign-band paths, queries and generated links on standalone hosting", () => {
        expect(() => selectPortalContext(parsePortalPath(`/b/${second}/backstage`), {}, standalone)).toThrow();
        expect(() => selectPortalContext(parsePortalPath("/backstage"), { bandPublicId: second }, standalone)).toThrow();
        expect(() => portalHref("/backstage", { bandPublicId: second }, standalone)).toThrow();
    });
    it.each(["/b", "/b/bad/backstage", "/invalid_locale/b/PortalBand000001/backstage", "//evil.test/backstage", "backstage"])(
        "rejects invalid portal path %s", pathname => {
            expect(() => parsePortalPath(pathname)).toThrow();
        });
});
