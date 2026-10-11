import { createHmac, randomBytes } from "crypto";
import type { FacetedBreakdownInput } from "../activityReportTypes";

// Tokens stay stable for the same selection in this process, without a public salt or permanent person identifier.
const anonymizationKey = randomBytes(32).toString("hex");

export function activityParticipantToken(userId: number, input: FacetedBreakdownInput): string {
    const scope = [
        input.bandPublicId,
        input.startDate.toISOString(),
        input.endDateExclusive.toISOString(),
        input.selectedBucket,
        input.filterSpec,
        input.facetFilters
    ];
    return createHmac("sha256", anonymizationKey).update(JSON.stringify([scope, userId])).digest("hex");
}
