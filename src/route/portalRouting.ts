import type { ParsedUrlQuery } from "querystring";
import { z } from "zod";
import { normalizeHostingMode } from "shared/brandConfigBase";
import { isPublicId, parsePublicId, type BandPublicId, type EventPublicId, type FilePublicId, type SongPublicId, type UserPublicId } from "shared/publicId";
import { concatenateUrlParts, isAbsoluteUri, slugify } from "shared/rootroot";
import { normalizeLocaleTag } from "src/locale/shared/localePreferences";
import { CmdbRouteRegistry, type CmdbRouteKey } from "./cmdbRoutes";
import { fileDownloadHref } from "src/core/db3/shared/fileDownloadUrl";

export type BandHostingConfig =
    | { readonly kind: "multiBand" }
    | { readonly kind: "singleBand"; readonly tenant: "generic" | "CafeMarche" };

export function isTenant(config: BandHostingConfig, tenant: "generic" | "CafeMarche"): boolean {
    return config.kind === "singleBand" && config.tenant === tenant;
}

export interface RouteBandAndLocale {
    readonly bandPublicId?: BandPublicId | null;
    readonly routeLocale?: string | null;
}

const ZBandPublicId = z.string().refine(isPublicId).transform(value => parsePublicId<"Band">(value));
const ZLocalPathname = z.string().max(16384).startsWith("/").refine(value => !/[?#\\\u0000-\u0020]/.test(value) && !value.startsWith("//"), "Expected a local pathname.");

// A single-band prefix has no public ID until the server resolves the database band.
export const ZPortalPath = z.object({
    externalPathname: ZLocalPathname,
    internalPathname: ZLocalPathname,
    bandPublicId: ZBandPublicId.nullable(),
    routeLocale: z.string().max(128).nullable(),
    hasBandPrefix: z.boolean(),
}).strict();
export type PortalPath = Readonly<z.infer<typeof ZPortalPath>>;

export const PORTAL_PATH_QUERY_PARAM = "x-cmdb-portal-path";

// this strips internal rewrite metadata from the query parameters,
// so creating a new URL based on the current one doesn't include the internal rewrite metadata.
export function applicationQuery(query: ParsedUrlQuery): ParsedUrlQuery {
    const { [PORTAL_PATH_QUERY_PARAM]: _metadata, ...parameters } = query;
    return parameters;
}

export function serializePortalPath(searchParams: URLSearchParams, portalPath: PortalPath): void {
    searchParams.set(PORTAL_PATH_QUERY_PARAM, JSON.stringify(portalPath));
}

export function deserializePortalPath(query: ParsedUrlQuery): PortalPath {
    const serialized = query[PORTAL_PATH_QUERY_PARAM];
    if (typeof serialized !== "string") {
        throw new RangeError("Missing or ambiguous portal path metadata.");
    }
    try {
        return ZPortalPath.parse(JSON.parse(serialized));
    } catch {
        throw new RangeError("Invalid portal path metadata.");
    }
}

// Only server and middleware callers read deployment configuration.
export function getServerBandHostingConfig(mode = process.env.CMDB_HOSTING_MODE): BandHostingConfig {
    const resolved = normalizeHostingMode(mode);
    return resolved === "Platform" ? { kind: "multiBand" } : {
        kind: "singleBand", tenant: resolved === "CafeMarche" ? "CafeMarche" : "generic",
    };
}

function isLocalePrefix(segment: string): boolean {
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(segment)) {
        return false;
    }
    // Supported language tags distinguish the optional locale from names such as /api.
    try {
        return Intl.DateTimeFormat.supportedLocalesOf([normalizeLocaleTag(segment)]).length > 0;
    } catch {
        return false;
    }
}

export function isBandPagePathname(pathname: string): boolean {
    return pathname === "/backstage" || pathname.startsWith("/backstage/");
}

/** Parse the external pathname once, before Next resolves the remaining route. */
export function parsePortalPath(externalPathname: string, hosting: BandHostingConfig): PortalPath {
    ZLocalPathname.parse(externalPathname);
    const parts = externalPathname.slice(1).split("/");
    let offset = 0;
    const routeLocale = parts[0] && isLocalePrefix(parts[0]) ? normalizeLocaleTag(parts[offset++]!) : null;
    const hasBandPrefix = parts[offset] === "b";
    let bandPublicId: BandPublicId | null = null;
    if (hasBandPrefix) {
        offset++;
        if (hosting.kind === "multiBand") {
            const identity = parts[offset++];
            if (!isPublicId(identity)) {
                throw new RangeError("Invalid band portal identity.");
            }
            bandPublicId = parsePublicId<"Band">(identity);
        }
    }
    const remainingPathname = `/${parts.slice(offset).join("/")}`;
    if (!hasBandPrefix && isBandPagePathname(remainingPathname)) {
        throw new RangeError("Band pages require a /b route prefix.");
    }
    const internalPathname = hasBandPrefix
        ? `/backstage${remainingPathname === "/" ? "" : remainingPathname}`
        : remainingPathname;
    return { externalPathname, internalPathname, bandPublicId, routeLocale, hasBandPrefix };
}

export function getBandPortalRoot(bandPublicId: BandPublicId, hosting: BandHostingConfig): string {
    return hosting.kind === "singleBand" ? "/b" : `/b/${bandPublicId}`;
}

/** Construct an external href from an internal href and explicit route parameters. */
export function portalHref(internalHref: string, selection: RouteBandAndLocale, hosting: BandHostingConfig): string {
    if (!internalHref.startsWith("/") || internalHref.startsWith("//")) {
        return internalHref;
    }
    const url = new URL(internalHref, "https://cmdb.invalid");
    let pathname = url.pathname;
    if (isBandPagePathname(pathname)) {
        const bandPublicId = selection.bandPublicId;
        if (!bandPublicId) {
            throw new RangeError("A band page URL requires a resolved band.");
        }
        pathname = `${getBandPortalRoot(bandPublicId, hosting)}${pathname.slice("/backstage".length)}`;
    }
    const localeRoot = selection.routeLocale ? `/${normalizeLocaleTag(selection.routeLocale)}` : "";
    url.searchParams.delete(PORTAL_PATH_QUERY_PARAM);
    return `${localeRoot}${pathname === "/" && localeRoot ? "" : pathname}${url.search}${url.hash}`;
}

/** Updating this page retains filters and fragments unless the destination replaces them. */
export function retainPortalPageState(destination: string, currentHref: string): string {
    const origin = "https://cmdb.invalid";
    const next = new URL(destination, origin);
    const current = new URL(currentHref, origin);
    const destinationKeys = new Set(next.searchParams.keys());
    for (const [key, value] of current.searchParams) {
        if (key !== PORTAL_PATH_QUERY_PARAM && !destinationKeys.has(key)) {
            next.searchParams.append(key, value);
        }
    }
    next.hash ||= current.hash;
    return next.origin === origin ? `${next.pathname}${next.search}${next.hash}` : next.href;
}

/** Replace the remaining pathname while preserving the already parsed external prefixes. */
export function replacePortalPathname(path: PortalPath, internalPathname: string): string {
    const remainder = path.hasBandPrefix ? path.internalPathname.slice("/backstage".length) : path.internalPathname;
    const prefix = remainder && remainder !== "/"
        ? path.externalPathname.slice(0, -remainder.length)
        : path.externalPathname.replace(/\/$/, "");
    if (internalPathname === "") {
        return prefix;
    }
    const destination = path.hasBandPrefix ? internalPathname.slice("/backstage".length) : internalPathname;
    return `${prefix}${destination}` || "/";
}

export interface CmdbRouterRequestArgs {
    readonly baseUri: string;
    readonly hosting: BandHostingConfig;
    readonly requestPath: PortalPath;
}

export class CmdbRouter {
    public readonly hosting: BandHostingConfig;
    public readonly requestPath: PortalPath;
    private readonly baseUri: string;

    constructor(args: CmdbRouterRequestArgs) {
        this.baseUri = args.baseUri;
        this.hosting = args.hosting;
        this.requestPath = args.requestPath;
    }

    href(internalHref: string, overrides: RouteBandAndLocale = {}): string {
        return portalHref(internalHref, {
            bandPublicId: overrides.bandPublicId === undefined ? this.requestPath.bandPublicId : overrides.bandPublicId,
            routeLocale: overrides.routeLocale === undefined ? this.requestPath.routeLocale : overrides.routeLocale,
        }, this.hosting);
    }

    homeHref(): string {
        const route = CmdbRouteRegistry.routeByKey(this.requestPath.hasBandPrefix ? "bandRoot" : "platformRoot");
        return this.href(route.nextPattern);
    }

    getAbsoluteUri = (href: string): string => {
        return isAbsoluteUri(href) ? href : concatenateUrlParts(this.baseUri, href);
    };

    private detailUri(routeKey: CmdbRouteKey, parts: readonly string[]): string {
        const pattern = CmdbRouteRegistry.routeByKey(routeKey).nextPattern;
        const internalHref = pattern.replace(/\[\.\.\.[^\]]+\]/, parts.map(encodeURIComponent).join("/"));
        return this.getAbsoluteUri(this.href(internalHref));
    }

    getURIForEvent = (event: { publicId: EventPublicId; name?: string }, tabSlug?: string): string => {
        return this.detailUri("bandEvent", detailParts(event, tabSlug));
    };

    getURIForSong = (song: { publicId: SongPublicId; name?: string }, tabSlug?: string): string => {
        return this.detailUri("bandSong", detailParts(song, tabSlug));
    };

    getURIForUser = (user: { publicId: UserPublicId; name?: string }): string => {
        return this.detailUri(this.requestPath.bandPublicId ? "bandUser" : "platformUser", detailParts(user));
    };

    getURIForFile = (file: { storedLeafName: string; fileLeafName: string; externalURI: string | null }): string => {
        if (file.externalURI) {
            return file.externalURI;
        }
        const leaf = file.fileLeafName ? `/${slugify(file.fileLeafName)}` : "";
        const bandPublicId = this.requestPath.bandPublicId;
        if (!bandPublicId) {
            throw new RangeError("A band file URL requires a resolved band.");
        }
        const downloadHref = fileDownloadHref(`/api/files/download/${encodeURIComponent(file.storedLeafName)}${leaf}`, bandPublicId);
        return this.getAbsoluteUri(this.href(downloadHref));
    };

    getURIForFileLandingPage = (file: { publicId: FilePublicId; slug?: string | null }): string => {
        return this.detailUri("bandFile", [file.publicId, ...(file.slug?.trim() ? [slugify(file.slug)] : [])]);
    };

    getURLClass = (href: string): "internalPage" | "internalAPI" | "external" => {
        try {
            const url = new URL(href, this.baseUri);
            if (url.origin !== new URL(this.baseUri).origin) {
                return "external";
            }
            const path = parsePortalPath(url.pathname, this.hosting);
            return path.internalPathname.startsWith("/api/") ? "internalAPI" : "internalPage";
        } catch {
            return "external";
        }
    };

}

// lsmb todo: use proper routing
// this general file should not be concerned with route specifics like this.
export function getICalRelativeURIForUserUpcomingEvents(args: { calendarFeedToken: string; bandPublicId: BandPublicId }) {
    const query = new URLSearchParams({ bandPublicId: args.bandPublicId });
    return `/api/ical/user/${encodeURIComponent(args.calendarFeedToken)}/upcoming?${query}`;
}

function detailParts(value: { publicId: string; name?: string }, tabSlug?: string): string[] {
    // Catch-all details keep the slug position when a tab is requested without a name.
    return [value.publicId, ...(value.name || tabSlug ? [slugify(value.name || "details")] : []), ...(tabSlug?.trim() ? [tabSlug] : [])];
}
