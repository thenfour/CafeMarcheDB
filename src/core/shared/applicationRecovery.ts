export type DeferredApplicationFeature = "accountRoles" | "accountMerge" | "accountAnalysis" | "activityReports" | "auditLog"
    | "legacyEventSongFilters" | "eventSongStatistics" | "eventImport" | "fileCreation" | "quickSearch";

const featureNames: { readonly [Feature in DeferredApplicationFeature]: string } = {
    accountRoles: "Platform role administration",
    accountMerge: "Shared-account merging",
    accountAnalysis: "Shared-account dependency analysis",
    activityReports: "Activity reports",
    auditLog: "Audit log",
    legacyEventSongFilters: "Legacy event and song filters",
    eventSongStatistics: "Event statistics and song history",
    eventImport: "Event import",
    fileCreation: "File creation",
    quickSearch: "Quick search",
};

export class ApplicationFeatureUnavailableError extends Error {
    constructor(feature: DeferredApplicationFeature) {
        super(`${featureNames[feature]} is temporarily unavailable during application recovery.`);
        this.name = "ApplicationFeatureUnavailableError";
    }
}

/** Deferred RPCs reject before loading a target or starting a transaction. */
export function requireRestoredApplicationFeature(feature: DeferredApplicationFeature): never {
    throw new ApplicationFeatureUnavailableError(feature);
}
