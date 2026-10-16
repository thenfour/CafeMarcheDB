// shared platform-wide routing behavior stuff.
// major concerns are request path parsing:
// - locale
// - band
// - mapping to registry

import { normalizeHostingMode } from "@/shared/brandConfigBase";
import { isPublicId, parsePublicId, type BandPublicId } from "shared/publicId";
import { normalizeLocaleTag } from "src/locale/shared/localePreferences";

// band hosting config + which band is the singleton in singleton instances
export type BandHostingConfig =
    | { readonly kind: "platform" }
    | {
        readonly kind: "standalone";
        readonly tenant: "generic" | "CafeMarche";
        readonly bandPublicId: BandPublicId;
    };

export function isTenant(config: BandHostingConfig, tenant: "generic" | "CafeMarche"): boolean {
    return config.kind === "standalone" && config.tenant === tenant;
}

// to be more generic this could also be called "CommonRouteParams"
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

// args are overrides.  normally use from env.
export function getServerBandHostingConfig(mode?: string | undefined, configuredBand?: string | undefined): BandHostingConfig {
    const resolvedMode = normalizeHostingMode(mode || process.env.CMDB_HOSTING_MODE);
    if (resolvedMode === "Platform") {
        return {
            kind: "platform",
        };
    }
    return {
        kind: "standalone",
        tenant: resolvedMode === "GenericSingleTenant" ? "generic" : "CafeMarche",
        bandPublicId: parsePublicId<"Band">(configuredBand || process.env.CMDB_PUBLIC_BAND_PUBLIC_ID),
    };
}

function isLocalePrefix(segment: string, next: string | undefined): boolean {
    if (next === "b") {
        return true;
    }
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(segment)) {
        return false;
    }
    // you have to check whether the locale is actually a real locale, in order to avoid
    // treating `/api/...` as a locale prefix by mistake.
    // TODO: this is fragile  and awful. don't rely on route names not being locale tags.
    try {
        return Intl.DateTimeFormat.supportedLocalesOf([normalizeLocaleTag(segment)]).length > 0;
    } catch {
        return false;
    }
}


// // accept a raw request path and return the matching route registry def.
// // this is quite a different lookup. Next route patterns are a direct hit, stable.
// // but incoming requests take many different forms.
// export function findRouteByRawPath(path: string): BackstageRouteDefinition | undefined {
//     //
// }



// expects a local relative path.
// this must accept ALL valid paths on the platform.
// some examples:
//
//     /api/rpc/getCurrentUser  <-- natural RPC route; no rewrite.
//     /
//     /backstage
//     /
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
        // also unnecessary... sheesh.
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


// TODO: remove.
// this function accepts multiple band/locale selections and resolves to one, throwing on conflict.
// this was used in order to support both path-based and query-based band/locale selections. unnecessary to support that scenario.
// - validates inputs
// - selects the appropriate band and locale based on the path, query, and hosting context
export function selectPortalContext(path: PortalPath, query: RouteBandAndLocale, hosting: BandHostingConfig): RouteBandAndLocale {

    if (path.bandPublicId && query.bandPublicId && path.bandPublicId !== query.bandPublicId) {
        throw new RangeError("Conflicting band selections.");
    }

    const queryLocale = query.routeLocale ? normalizeLocaleTag(query.routeLocale) : null;
    if (path.routeLocale && queryLocale && path.routeLocale !== queryLocale) {
        throw new RangeError("Conflicting language selections.");
    }
    const selectedBand = path.bandPublicId ?? query.bandPublicId ?? null;
    if (path.hasPlatformPrefix && selectedBand) {
        throw new RangeError("Platform pages cannot select a band.");
    }

    // todo: unnecessary diligence; this is enforced all over the place, not to mention
    // it will just be a missing band like any other, no need to give psecial attention.
    if (hosting.kind === "standalone" && selectedBand && selectedBand !== hosting.bandPublicId) {
        throw new RangeError("The requested band does not belong to this host.");
    }
    return {
        bandPublicId: path.hasPlatformPrefix ? null : hosting.kind === "standalone" ? hosting.bandPublicId : selectedBand,
        routeLocale: path.routeLocale ?? queryLocale,
    };
}

// return the relative URL of a band's root.
// TODO: the band portal root is just another route. use a common route construction.
function getBandPortalRoot(bandPublicId: BandPublicId, hosting: BandHostingConfig): string {
    if (hosting.kind === "standalone") {
        if (hosting.bandPublicId !== bandPublicId) {
            throw new RangeError("The requested band does not belong to this host.");
        }
        return "";
    }
    return `/b/${bandPublicId}`;
}

export const cmdbRouting = {
    getBandPortalRoot,
};

// generates a relative URL given the path, selection, and hosting context.
// transforms existing 
// TODO: we should construct routes based on the registry, not hard-coded path manipulations.
// almost every CALL to this function also needs to be treated because they mostly do ad-hoc path construction
export function portalHref(path: string, selection: RouteBandAndLocale, hosting: BandHostingConfig): string {
    if (!path.startsWith("/") || path.startsWith("//")) {
        // If the path is not a valid relative path, return it as-is.
        return path;
    }
    const url = new URL(path, "https://cmdb.invalid");
    const parsed = parsePortalPath(url.pathname);
    // Standalone hosts need an explicit namespace for account/platform pages without band context.
    const bandRoot = selection.bandPublicId ? getBandPortalRoot(selection.bandPublicId, hosting)
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
