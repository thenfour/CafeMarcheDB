import { parsePortalPath, portalHref, type BandHostingConfig } from "src/route/portalRouting";
import type { ActivityDetailRow, FacetedBreakdownInput } from "../activityReportTypes";
import { anonymousActivityContext } from "../activityContext";
import { ActivityFeature } from "../activityTracking";

interface SavedActivityMetadata {
    readonly uri: string | null; readonly queryText: string | null;
    readonly feature: string; readonly context: string | null;
    readonly songId: number | null; readonly eventId: number | null; readonly fileId: number | null;
}
type AuthorizedActivityRow = Omit<ActivityDetailRow, "uri" | "queryText">;
export interface ActivityMetadataPolicy {
    // The deployment owns this origin; a saved URL cannot declare its own authority.
    readonly applicationOrigin: string | null;
    readonly hosting: BandHostingConfig;
}

/** Saved metadata must not add identities or text beyond the authorized reference projection. */
export function projectActivitySavedMetadata(source: SavedActivityMetadata, row: AuthorizedActivityRow,
    input: FacetedBreakdownInput, policy: ActivityMetadataPolicy): Pick<ActivityDetailRow, "uri" | "queryText"> {
    return { uri: disclosedActivityUri(source, row, input, policy), queryText: disclosedActivityQuery(source, row) };
}

function savedApplicationPath(value: string | null, policy: ActivityMetadataPolicy): string | null {
    if (!value || /[\\\u0000-\u0020\u007f]/.test(value) || value.startsWith("//")) {
        return null;
    }
    try {
        const relative = value.startsWith("/");
        // Relative URLs need only a parsing origin. Absolute URLs require the configured deployment origin.
        const url = new URL(value, relative ? "https://cmdb.invalid" : undefined);
        if (url.username || url.password || !["http:", "https:"].includes(url.protocol)) {
            return null;
        }
        if (!relative && (!policy.applicationOrigin || url.origin !== new URL(policy.applicationOrigin).origin)) {
            return null;
        }
        return parsePortalPath(url.pathname, policy.hosting).internalPathname;
    } catch {
        return null;
    }
}

function matchesReference(value: string | undefined, publicId: string, naturalId: number | null): boolean {
    return value === publicId || (naturalId !== null && value === String(naturalId));
}

function authorizedActivityPath(path: string, source: SavedActivityMetadata, row: AuthorizedActivityRow): string | null {
    // Static pages carry no saved filters, person slugs, fragments or credentials.
    const pages = ["/", "/backstage", "/backstage/events", "/backstage/songs", "/backstage/files", "/backstage/wikiPages",
        "/backstage/calendar", "/backstage/setlistPlanner", "/backstage/featureReports"];
    if (pages.includes(path)) {
        return path;
    }
    const parts = path.split("/").slice(1).map(decodeURIComponent);
    if (parts[0] !== "backstage") {
        return null;
    }
    if (parts[1] === "song" && row.song && matchesReference(parts[2], row.song.publicId, source.songId)) {
        return `/backstage/song/${row.song.publicId}`;
    }
    if (parts[1] === "event" && row.event && matchesReference(parts[2], row.event.publicId, source.eventId)) {
        return `/backstage/event/${row.event.publicId}`;
    }
    if (parts[1] === "file" && row.file && matchesReference(parts[2], row.file.publicId, source.fileId)) {
        return `/backstage/file/${row.file.publicId}`;
    }
    if (parts[1] === "wiki" && row.wikiPage && parts.slice(2).join("/") === row.wikiPage.slug) {
        return `/backstage/wiki/${row.wikiPage.slug.split("/").map(encodeURIComponent).join("/")}`;
    }
    // Person, authentication, API/download, external and unrecognized routes have no report disclosure contract.
    return null;
}

function disclosedActivityUri(source: SavedActivityMetadata, row: AuthorizedActivityRow, input: FacetedBreakdownInput,
    policy: ActivityMetadataPolicy): string | null {
    const path = savedApplicationPath(source.uri, policy);
    if (path === null) {
        return null;
    }
    try {
        const authorized = authorizedActivityPath(path, source, row);
        return authorized === null ? null : portalHref(authorized, input, policy.hosting);
    } catch {
        // Malformed percent escapes cannot become a report link.
        return null;
    }
}

// lsmb todo: this needs cleaning up. putting hard-coded strings in a regex.... smh
function disclosedActivityQuery(source: SavedActivityMetadata, row: AuthorizedActivityRow): string | null {
    // Association selection is the query-text producer. Person searches have no authorized content reference.
    if (source.feature !== ActivityFeature.link_follow_internal || source.queryText === null
        || /[\u0000-\u001f\u007f]/.test(source.queryText) || anonymousActivityContext(source.context) !== source.context
        || /(^|\/)(profile|users?|account|login|signup|forgot_password)(\/|$)/i.test(source.context ?? "")) {
        return null;
    }
    const query = source.queryText.normalize("NFC").toLowerCase().trim();
    const labels = [row.song?.name, row.event?.name, row.wikiPage?.slug];
    // A confirmed label fragment adds no arbitrary search text, names, contact details or credentials.
    return query && labels.some(label => label?.normalize("NFC").toLowerCase().includes(query)) ? source.queryText : null;
}
