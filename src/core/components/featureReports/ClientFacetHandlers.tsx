import { ActivityDetailSelectionSchema, ActivityFacetFilterSchema, type ActivityDetailSelection, type ActivityFacetFilter, type ActivityFacetKey, type ActivityTimelineFilter } from "./activityReportTypes";

export interface ActivityReportFilters {
    readonly timeline: ActivityTimelineFilter;
    readonly facets: ActivityFacetFilter;
}

/** Empty lists mean unrestricted activity. The report UI owns these initial choices. */
export function emptyActivityFacetFilters(): ActivityFacetFilter {
    return {
        includeOperatingSystems: [], excludeOperatingSystems: [], includePointerTypes: [], excludePointerTypes: [],
        includeBrowserNames: [], excludeBrowserNames: [], includeDeviceClasses: [], excludeDeviceClasses: [],
        includeLanguages: [], excludeLanguages: [], includeLocales: [], excludeLocales: [], includeTimezones: [], excludeTimezones: [],
        includeSongIds: [], excludeSongIds: [], includeEventIds: [], excludeEventIds: [], includeWikiPageIds: [], excludeWikiPageIds: [],
        includeMenuLinkIds: [], excludeMenuLinkIds: [], includeCustomLinkIds: [], excludeCustomLinkIds: [],
    };
}

interface FacetListFields {
    readonly include: keyof ActivityFacetFilter;
    readonly exclude: keyof ActivityFacetFilter;
}
const facetListFields = {
    operatingSystems: { include: "includeOperatingSystems", exclude: "excludeOperatingSystems" },
    pointerTypes: { include: "includePointerTypes", exclude: "excludePointerTypes" },
    browsers: { include: "includeBrowserNames", exclude: "excludeBrowserNames" },
    deviceClasses: { include: "includeDeviceClasses", exclude: "excludeDeviceClasses" },
    languages: { include: "includeLanguages", exclude: "excludeLanguages" },
    locales: { include: "includeLocales", exclude: "excludeLocales" },
    timezones: { include: "includeTimezones", exclude: "excludeTimezones" },
    songs: { include: "includeSongIds", exclude: "excludeSongIds" },
    events: { include: "includeEventIds", exclude: "excludeEventIds" },
    wikiPages: { include: "includeWikiPageIds", exclude: "excludeWikiPageIds" },
    menuLinks: { include: "includeMenuLinkIds", exclude: "excludeMenuLinkIds" },
    customLinks: { include: "includeCustomLinkIds", exclude: "excludeCustomLinkIds" },
    features: null, contexts: null, screenSizes: null, users: null,
} satisfies { [K in ActivityFacetKey]: FacetListFields | null };

export function activityFacetFilterValues(filters: ActivityReportFilters, facet: ActivityFacetKey) {
    if (facet === "features") {
        return { include: filters.timeline.includeFeatures, exclude: filters.timeline.excludeFeatures };
    }
    if (facet === "contexts") {
        return { include: filters.timeline.contextBeginsWith ? [filters.timeline.contextBeginsWith] : [], exclude: [] };
    }
    const fields = facetListFields[facet];
    return fields ? { include: filters.facets[fields.include], exclude: filters.facets[fields.exclude] } : { include: [], exclude: [] };
}

export function activityFacetSupportsFilter(facet: ActivityFacetKey): boolean {
    // The reference has no person-token or screen-size filters.
    return facet !== "screenSizes" && facet !== "users";
}

export function activityFacetDetailSelection(facet: ActivityFacetKey, key: string): ActivityDetailSelection | null {
    if (!activityFacetSupportsFilter(facet)) {
        return null;
    }
    // Validate each reference's branded identity while keeping the original descriptive groups closed.
    return ActivityDetailSelectionSchema.parse({ facet, key });
}

export type ActivityFacetFilterOperation = "isolate" | "hide" | "removeInclude" | "removeExclude" | "clear";
function updatedLists(current: { readonly include: readonly string[]; readonly exclude: readonly string[] }, operation: ActivityFacetFilterOperation, key: string) {
    if (operation === "isolate") {
        return { include: [key], exclude: [] };
    }
    if (operation === "hide") {
        return { include: [...current.include], exclude: [...new Set([...current.exclude, key])] };
    }
    if (operation === "clear") {
        return { include: [], exclude: [] };
    }
    return {
        include: operation === "removeInclude" ? current.include.filter(value => value !== key) : [...current.include],
        exclude: operation === "removeExclude" ? current.exclude.filter(value => value !== key) : [...current.exclude],
    };
}

export function changeActivityFacetFilter(filters: ActivityReportFilters, facet: ActivityFacetKey,
    operation: ActivityFacetFilterOperation, key: string): ActivityReportFilters {
    if (!activityFacetSupportsFilter(facet)) {
        throw new Error("This activity facet does not support filtering.");
    }
    if (facet === "contexts") {
        if (operation !== "isolate" && operation !== "clear" && operation !== "removeInclude") {
            throw new Error("Context filters select a literal prefix.");
        }
        return { ...filters, timeline: { ...filters.timeline, contextBeginsWith: operation === "isolate" ? key : null } };
    }
    const lists = updatedLists(activityFacetFilterValues(filters, facet), operation, key);
    if (facet === "features") {
        return { ...filters, timeline: { ...filters.timeline, includeFeatures: lists.include, excludeFeatures: lists.exclude } };
    }
    const fields = facetListFields[facet];
    if (!fields) {
        throw new Error("Missing activity facet filter fields.");
    }
    // The schema preserves each entity's branded public identities at this shared UI boundary.
    return { ...filters, facets: ActivityFacetFilterSchema.parse({ ...filters.facets, [fields.include]: lists.include, [fields.exclude]: lists.exclude }) };
}
