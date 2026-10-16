import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { CmdbRouter, deserializePortalPath, getServerBandHostingConfig, parsePortalPath, portalHref, PORTAL_PATH_QUERY_PARAM, replacePortalPathname, retainPortalPageState, serializePortalPath, type BandHostingConfig } from "src/route/portalRouting";
import { customLinkDestination, customLinkHref } from "src/core/db3/shared/entities/customLink/customLinkUrl";

const first = parsePublicId<"Band">("PortalBand000001");
const second = parsePublicId<"Band">("PortalBand000002");
const platform: BandHostingConfig = { kind: "multiBand" };
const standalone: BandHostingConfig = { kind: "singleBand", tenant: "generic" };

afterEach(() => { vi.unstubAllEnvs(); });

describe("hosting and route-level parameters", () => {
    it("requires an explicit valid hosting mode", () => {
        expect(getServerBandHostingConfig()).toEqual(platform);
        for (const mode of ["", "platform", "invalid"]) {
            expect(() => getServerBandHostingConfig(mode)).toThrow("Invalid hosting mode");
        }
    });
    it.each([platform, standalone])("keeps unprefixed routes unscoped in $kind", hosting => {
        for (const externalPathname of ["/", "/platform/adminUsers", "/myPage", "/api/rpc/getCurrentUser"]) {
            expect(parsePortalPath(externalPathname, hosting)).toEqual({
                externalPathname, internalPathname: externalPathname, bandPublicId: null, routeLocale: null, hasBandPrefix: false,
            });
        }
    });
    it.each(["", "/events", "/wiki/handbook", "/tickets/summer"])("maps a band path into its internal namespace: %s", remainder => {
        const internalPathname = `/backstage${remainder}`;
        expect(parsePortalPath(`/fr-be/b/${first}${remainder}`, platform)).toMatchObject({
            internalPathname, bandPublicId: first, routeLocale: "fr-BE", hasBandPrefix: true,
        });
        expect(parsePortalPath(`/fr-be/b${remainder}`, standalone)).toMatchObject({
            internalPathname, bandPublicId: null, routeLocale: "fr-BE", hasBandPrefix: true,
        });
        expect(portalHref(internalPathname, { bandPublicId: first, routeLocale: "fr-BE" }, standalone)).toBe(`/fr-BE/b${remainder}`);
    });
    it.each(["/b", "/b/invalid"])("rejects a missing or malformed multi-band identity: %s", href => {
        expect(() => parsePortalPath(href, platform)).toThrow();
    });
    it("leaves the remaining path and custom-link namespace intact", () => {
        expect(parsePortalPath(`/b/${first}/fr/backstage/calendar`, platform).internalPathname).toBe("/backstage/fr/backstage/calendar");
        expect(customLinkHref("fr/backstage/calendar", first, platform)).toBe(`/b/${first}/fr/backstage/calendar`);
        expect(customLinkHref("tickets/summer", first, standalone)).toBe("/b/tickets/summer");
    });
    it.each(["/b", "/b/", "/fr/b", "/fr/b/"])("preserves parsed prefixes when redirecting single-band %s", href => {
        const path = parsePortalPath(href, standalone);
        const prefix = href.replace(/\/$/, "");
        expect(replacePortalPathname(path, "/backstage")).toBe(prefix);
    });
    it.each(["/backstage", "/backstage/events", "/fr/backstage/adminUsers"])("rejects direct access to the internal band namespace: %s", href => {
        expect(() => parsePortalPath(href, platform)).toThrow("/b route prefix");
    });
    it.each([
        { external: "/b/0000000000000000/", internal: "/backstage", hosting: platform },
        { external: "/b/", internal: "/backstage", hosting: standalone },
        { external: "/", internal: "/", hosting: platform },
        { external: "/platform/adminUsers", internal: "/platform/adminUsers", hosting: platform },
        { external: "/b/adminUsers", internal: "/backstage/adminUsers", hosting: standalone },
        { external: "/b/0000000000000000/adminUsers", internal: "/backstage/adminUsers", hosting: platform },
        { external: "/fr/b/0000000000000000/adminUsers", internal: "/backstage/adminUsers", hosting: platform },
        { external: "/fr-BE/b/adminUsers", internal: "/backstage/adminUsers", hosting: standalone },
    ])("round-trips the agreed mapping for $external", ({ external, internal, hosting }) => {
        const parsed = parsePortalPath(external, hosting);
        expect(parsed.internalPathname).toBe(internal);
        const bandPublicId = parsed.hasBandPrefix ? parsed.bandPublicId ?? first : null;
        expect(portalHref(internal, { bandPublicId, routeLocale: parsed.routeLocale }, hosting)).toBe(external.replace(/\/$/, "") || "/");
    });
});

describe("serialized request context", () => {
    it("overwrites forged metadata and round-trips the parsed path", () => {
        const path = parsePortalPath(`/fr/b/${first}/events`, platform);
        const query = new URLSearchParams([[PORTAL_PATH_QUERY_PARAM, "forged"], [PORTAL_PATH_QUERY_PARAM, "duplicate"], ["q", "brass"]]);
        serializePortalPath(query, path);
        expect(query.getAll(PORTAL_PATH_QUERY_PARAM)).toHaveLength(1);
        expect(query.get("q")).toBe("brass");
        expect(deserializePortalPath(Object.fromEntries(query))).toEqual(path);
    });
    it.each([{}, { [PORTAL_PATH_QUERY_PARAM]: ["a", "b"] }, { [PORTAL_PATH_QUERY_PARAM]: "{}" }])("rejects absent, ambiguous, or malformed metadata", query => {
        expect(() => deserializePortalPath(query)).toThrow();
    });
    it("does not forward internal metadata to a custom-link destination", () => {
        expect(customLinkDestination("https://external.test", { customLinkSlug: "go", [PORTAL_PATH_QUERY_PARAM]: "private", q: ["a", "b"] }, true))
            .toBe("https://external.test/?q=a&q=b");
    });
});

describe("shared routing service", () => {
    const router = new CmdbRouter({ baseUri: "https://portal.test", hosting: platform, requestPath: parsePortalPath(`/fr/b/${first}`, platform) });
    it("inherits context, supports explicit overrides, and clears it with null", () => {
        expect(router.href("/backstage")).toBe(`/fr/b/${first}`);
        expect(router.href("/backstage", { bandPublicId: second, routeLocale: "nl-BE" })).toBe(`/nl-BE/b/${second}`);
        expect(router.href("/platform", { bandPublicId: null, routeLocale: null })).toBe("/platform");
        expect(() => router.href("/backstage", { bandPublicId: null })).toThrow("resolved band");
        expect(router.href("/platform/adminUsers")).toBe("/fr/platform/adminUsers");
        expect(router.href("/")).toBe("/fr");
    });
    it("preserves application query parameters and fragments", () => {
        expect(router.href("/backstage?q=a&q=b&bandPublicId=filter#results")).toBe(`/fr/b/${first}?q=a&q=b&bandPublicId=filter#results`);
    });
    it("retains current page state while allowing the destination to replace a query key", () => {
        expect(retainPortalPageState("/backstage/new?tab=active", "/backstage/old?tab=old&q=a&q=b#answer"))
            .toBe("/backstage/new?tab=active&q=a&q=b#answer");
    });
    it("classifies URLs on the server using the configured origin", () => {
        expect(router.getURLClass(`/b/${first}`)).toBe("internalPage");
        expect(router.getURLClass(`/api/files/download/image.png?bandPublicId=${first}`)).toBe("internalAPI");
        expect(router.getURLClass("https://portal.test:444/backstage")).toBe("external");
        expect(router.getURLClass("mailto:someone@example.test")).toBe("external");
    });
    it("gives API downloads explicit domain context without a band route prefix", () => {
        expect(router.getURIForFile({ storedLeafName: "stored.pdf", fileLeafName: "Score.pdf", externalURI: null }))
            .toBe(`https://portal.test/fr/api/files/download/stored.pdf/scorepdf?bandPublicId=${first}`);
    });
});
