export type DeferredApplicationFeature = "accountRoles" | "accountMerge" | "accountAnalysis" | "activityReports" | "auditLog"
    | "legacyEventSongFilters" | "eventSongStatistics" | "eventImport" | "fileCreation" | "quickSearch"
    | "eventWorkflows" | "songWorkflows" | "fileWorkflows" | "publicPublication" | "domainSearch" | "developerExamples";

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
    eventWorkflows: "Event screens and editing",
    songWorkflows: "Song screens and editing",
    fileWorkflows: "File screens and editing",
    publicPublication: "Public homepage and galleries",
    domainSearch: "Domain search",
    developerExamples: "Developer examples",
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

// Temporary root-domain gates. Narrow migrated readers have separate registered table identities.
const deferredDB3Domains = new Map<string, DeferredApplicationFeature>([
    ["songcredit", "songWorkflows"],
    ["file", "fileWorkflows"], ["bandfiletagassignment", "fileWorkflows"],
    ["fileusertag", "fileWorkflows"], ["filesongtag", "fileWorkflows"], ["fileeventtag", "fileWorkflows"],
    ["fileinstrumenttag", "fileWorkflows"], ["filewikipagetag", "fileWorkflows"],
    ["frontpagegalleryitem", "publicPublication"],
]);

export function requireRecoveredDB3Domain(tableID: string): void {
    const feature = deferredDB3Domains.get(tableID.toLowerCase());
    if (feature) {
        requireRestoredApplicationFeature(feature);
    }
}
