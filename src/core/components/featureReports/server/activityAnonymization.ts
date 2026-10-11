import { createHmac, randomBytes } from "crypto";
import type { FacetedBreakdownInput } from "../activityReportTypes";

function processAnonymizationKey(): string {
    // Next bundles each RPC separately. Share one private process key across those module instances.
    const slot = Symbol.for("cmdb.activity-report.anonymization-key");
    const existing: unknown = Reflect.get(globalThis, slot);
    if (existing !== undefined) {
        if (typeof existing !== "string") {
            throw new Error("Invalid activity anonymization key.");
        }
        return existing;
    }
    const key = randomBytes(32).toString("hex");
    Reflect.set(globalThis, slot, key);
    return key;
}

// Tokens stay stable for the same selection in this process, without a public salt or permanent person identifier.
const anonymizationKey = processAnonymizationKey();

export function activityParticipantToken(userId: number, input: FacetedBreakdownInput): string {
    return activityToken("person", userId, input);
}

export function activityRowToken(actionId: number, input: FacetedBreakdownInput): string {
    return activityToken("action", actionId, input);
}

function activityToken(purpose: "person" | "action", id: number, input: FacetedBreakdownInput): string {
    const scope = [
        input.bandPublicId,
        input.startDate.toISOString(),
        input.endDateExclusive.toISOString(),
        input.selectedBucket,
        input.filterSpec,
        input.facetFilters
    ];
    return createHmac("sha256", anonymizationKey).update(JSON.stringify([purpose, scope, id])).digest("hex");
}
