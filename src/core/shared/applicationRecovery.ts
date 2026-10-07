export type DeferredApplicationFeature = "accountRoles" | "accountMerge" | "accountAnalysis" | "activityReports";

const featureNames: { readonly [Feature in DeferredApplicationFeature]: string } = {
    accountRoles: "Platform role administration",
    accountMerge: "Shared-account merging",
    accountAnalysis: "Shared-account dependency analysis",
    activityReports: "Activity reports",
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
