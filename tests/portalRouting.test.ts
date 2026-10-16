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
        for (const externalPathname of ["/", "/backstage", "/myPage", "/api/rpc/getCurrentUser"]) {
            expect(parsePortalPath(externalPathname, hosting)).toEqual({
                externalPathname, internalPathname: externalPathname, bandPublicId: null, routeLocale: null, hasBandPrefix: false,
            });
        }
    });
    it.each(["/backstage/events", "/backstage/wiki/handbook", "/api/files/download/photo.png", "/tickets/summer"])("rewrites only prefixes on %s", internalPathname => {
        expect(parsePortalPath(`/fr-be/b/${first}${internalPathname}`, platform)).toMatchObject({
            internalPathname, bandPublicId: first, routeLocale: "fr-BE", hasBandPrefix: true,
        });
        expect(parsePortalPath(`/fr-be/b${internalPathname}`, standalone)).toMatchObject({
            internalPathname, bandPublicId: null, routeLocale: "fr-BE", hasBandPrefix: true,
        });
        expect(portalHref(internalPathname, { bandPublicId: first, routeLocale: "fr-BE" }, standalone)).toBe(`/fr-BE/b${internalPathname}`);
    });
    it.each(["/b", "/b/invalid/backstage"])("rejects a missing or malformed multi-band identity: %s", href => {
        expect(() => parsePortalPath(href, platform)).toThrow();
    });
    it("leaves the remaining path and custom-link namespace intact", () => {
        expect(parsePortalPath(`/b/${first}/fr/backstage/calendar`, platform).internalPathname).toBe("/fr/backstage/calendar");
        expect(customLinkHref("fr/backstage/calendar", first, platform)).toBe(`/b/${first}/fr/backstage/calendar`);
        expect(customLinkHref("tickets/summer", first, standalone)).toBe("/b/tickets/summer");
    });
    it.each(["/", "/b", "/b/", "/fr/b", "/fr/b/"])("preserves parsed prefixes when redirecting single-band %s", href => {
        const path = parsePortalPath(href, standalone);
        const prefix = href.replace(/\/$/, "");
        expect(replacePortalPathname(path, "/backstage")).toBe(`${prefix}/backstage`);
    });
});

describe("serialized request context", () => {
    it("overwrites forged metadata and round-trips the parsed path", () => {
        const path = parsePortalPath(`/fr/b/${first}/backstage/events`, platform);
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
    const router = new CmdbRouter({ baseUri: "https://portal.test", hosting: platform, requestPath: parsePortalPath(`/fr/b/${first}/backstage`, platform) });
    it("inherits context, supports explicit overrides, and clears it with null", () => {
        expect(router.href("/backstage")).toBe(`/fr/b/${first}/backstage`);
        expect(router.href("/backstage", { bandPublicId: second, routeLocale: "nl-BE" })).toBe(`/nl-BE/b/${second}/backstage`);
        expect(router.href("/backstage", { bandPublicId: null, routeLocale: null })).toBe("/backstage");
    });
    it("preserves application query parameters and fragments", () => {
        expect(router.href("/backstage?q=a&q=b&bandPublicId=filter#results")).toBe(`/fr/b/${first}/backstage?q=a&q=b&bandPublicId=filter#results`);
    });
    it("retains current page state while allowing the destination to replace a query key", () => {
        expect(retainPortalPageState("/backstage/new?tab=active", "/backstage/old?tab=old&q=a&q=b#answer"))
            .toBe("/backstage/new?tab=active&q=a&q=b#answer");
    });
    it("classifies URLs on the server using the configured origin", () => {
        expect(router.getURLClass("/backstage")).toBe("internalPage");
        expect(router.getURLClass(`/fr/b/${first}/api/files/download/image.png`)).toBe("internalAPI");
        expect(router.getURLClass("https://portal.test:444/backstage")).toBe("external");
        expect(router.getURLClass("mailto:someone@example.test")).toBe("external");
    });
});
