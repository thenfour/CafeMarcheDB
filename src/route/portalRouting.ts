// shared platform-wide routing logic.
// stuff like custom URLs

import { HostingMode } from "shared/brandConfigBase";
import { isPublicId, parsePublicId, type BandPublicId } from "shared/publicId";
import { normalizeLocaleTag } from "src/locale/shared/localePreferences";

// band hosting config + which band is the singleton in singleton instances
export type BandHostingConfig =
    | { readonly kind: "platform" }
    | {
        readonly kind: "standalone";
        readonly bandPublicId: BandPublicId;
    };

export interface RouteBandAndLocale {
    readonly bandPublicId?: BandPublicId | null;
    readonly routeLocale?: string | null;
}

export interface PortalPath extends RouteBandAndLocale {
    readonly pathname: string;
    readonly hasBandPrefix: boolean;
    readonly hasLocalePrefix: boolean;
    readonly hasPlatformPrefix: boolean;
}

// Middleware replaces this hint. Servers still validate configuration, identities and grants.
export const PORTAL_PATH_HEADER = "x-cmdb-portal-path";

export function getServerBandHostingConfig(mode: string | undefined, configuredBand: string | undefined): BandHostingConfig {
    // todo: use zod schema; simplify this to parse -> switch
    if (mode === undefined || mode === HostingMode.Platform) {
        return {
            kind: "platform",
        };
    }

    if (mode !== HostingMode.CafeMarche && mode !== HostingMode.GenericSingleTenant) {
        throw new RangeError("Unknown hosting mode.");
    }
    if (!isPublicId(configuredBand)) {
        throw new RangeError("Standalone hosting requires CMDB_PUBLIC_BAND_PUBLIC_ID.");
    }

    return {
        kind: "standalone",
        bandPublicId: parsePublicId<"Band">(configuredBand),
    };
}

function isLocalePrefix(segment: string, next: string | undefined): boolean {
    if (next === "b") {
        return true;
    }
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(segment)) {
        return false;
    }
    return true;
    // not necessary to check further.
    // try {
    //     return Intl.DateTimeFormat.supportedLocalesOf([normalizeLocaleTag(segment)]).length > 0;
    // } catch {
    //     return false;
    // }
}

// expects a local relative path.
// - /
// - /backstage
// - /auth/logout?xyz#123
// - /b/bandidhere
// note that this does NOT parse querystring for bandPublicId or routeLocale.
export function parsePortalPath(pathname: string): PortalPath {
    if (!pathname.startsWith("/") || pathname.startsWith("//")) {
        throw new RangeError("Expected a local portal path.");
    }

    // paths are in a few different forms:
    // /fr-BE/b/<bandid>/etc/etc?etc#etc
    // /b/<bandid>/etc/etc?etc#etc
    // /platform/etc/etc?etc#etc
    const parts = pathname.slice(1).split("/");
    let offset = 0; // which segment does the non-locale part of the path start
    let routeLocale: string | null = null;
    // detect locale - must be 1st path part if present.
    if (parts[0] && parts[0] !== "b" && isLocalePrefix(parts[0], parts[1])) {
        routeLocale = normalizeLocaleTag(parts[0]);
        offset++;
    }

    // platform prefix
    const hasPlatformPrefix = parts[offset] === "platform";
    if (hasPlatformPrefix) {
        offset++;
    }

    // band prefix / id
    const hasBandPrefix = !hasPlatformPrefix && parts[offset] === "b";
    let bandPublicId: BandPublicId | null = null;
    if (hasBandPrefix) {
        const identity = parts[offset + 1];
        if (!isPublicId(identity)) {
            throw new RangeError("Invalid band portal identity.");
        }
        bandPublicId = parsePublicId<"Band">(identity);
        offset += 2;
    }

    return {
        pathname: `/${parts.slice(offset).join("/")}`,
        bandPublicId,
        routeLocale,
        hasBandPrefix,
        hasPlatformPrefix,
        hasLocalePrefix: routeLocale !== null,
    };
}

/** Query selections remain readable for existing bookmarks; conflicting path selections fail. */
export function selectPortalContext(path: PortalPath, query: RouteBandAndLocale, hosting: BandHostingConfig): RouteBandAndLocale {
    const queryLocale = query.routeLocale ? normalizeLocaleTag(query.routeLocale) : null;
    if (path.bandPublicId && query.bandPublicId && path.bandPublicId !== query.bandPublicId) {
        throw new RangeError("Conflicting band selections.");
    }
    if (path.routeLocale && queryLocale && path.routeLocale !== queryLocale) {
        throw new RangeError("Conflicting language selections.");
    }
    const selectedBand = path.bandPublicId ?? query.bandPublicId ?? null;
    if (path.hasPlatformPrefix && selectedBand) {
        throw new RangeError("Platform pages cannot select a band.");
    }
    if (hosting.kind === "standalone" && selectedBand && selectedBand !== hosting.bandPublicId) {
        throw new RangeError("The requested band does not belong to this host.");
    }
    return {
        bandPublicId: path.hasPlatformPrefix ? null : hosting.kind === "standalone" ? hosting.bandPublicId : selectedBand,
        routeLocale: path.routeLocale ?? queryLocale,
    };
}

// return the relative URL of a band's root.
export function portalRoot(bandPublicId: BandPublicId, hosting: BandHostingConfig): string {
    if (hosting.kind === "standalone") {
        if (hosting.bandPublicId !== bandPublicId) {
            throw new RangeError("The requested band does not belong to this host.");
        }
        return "";
    }
    return `/b/${bandPublicId}`;
}

/** Explicit hosting and selection keep URL policy out of domains and presentation payloads. */
// generates a relative URL given the path, selection, and hosting context.
// TODO: we should construct routes based on the registry, not hard-coded path manipulations.
export function portalHref(path: string, selection: RouteBandAndLocale, hosting: BandHostingConfig): string {
    if (!path.startsWith("/") || path.startsWith("//")) {
        return path;
    }
    const url = new URL(path, "https://cmdb.invalid");
    const parsed = parsePortalPath(url.pathname);
    // Standalone hosts need an explicit namespace for account/platform pages without band context.
    const bandRoot = selection.bandPublicId ? portalRoot(selection.bandPublicId, hosting)
        : hosting.kind === "standalone" ? "/platform" : "";
    const localeRoot = selection.routeLocale ? `/${normalizeLocaleTag(selection.routeLocale)}` : "";
    const remainder = parsed.pathname === "/" ? "" : parsed.pathname;
    url.searchParams.delete("bandPublicId");
    url.searchParams.delete("routeLocale");
    return `${localeRoot}${bandRoot}${remainder || (!localeRoot && !bandRoot ? "/" : "")}${url.search}${url.hash}`;
}

/** Canonicalizing a name/tab on the same page retains its filters and fragment. */
// used for event / song pages when they  replace the current URL with one with a correct slug
export function retainPortalPageState(destination: string, currentPage: string): string {
    const parsingOrigin = "https://cmdb.invalid";
    const next = new URL(destination, parsingOrigin);
    const current = new URL(currentPage, parsingOrigin);
    const destinationKeys = new Set(next.searchParams.keys());
    for (const [key, value] of current.searchParams) {
        if (key !== "bandPublicId" && key !== "routeLocale" && !destinationKeys.has(key)) {
            next.searchParams.append(key, value);
        }
    }
    next.hash ||= current.hash;
    return next.origin === parsingOrigin ? `${next.pathname}${next.search}${next.hash}` : next.href;
}
