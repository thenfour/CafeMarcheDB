import type { MergeContext } from "./types";

/** Stable decisions, with Main taking precedence even if Retiring's record was created first. */
export function classifyRecords<T extends { id: number }>(records: readonly T[], mainOwnerId: number | null,
    getOwnerId: (record: T) => number | null, getKey: (record: T) => string | number,
) {
    const retainedByKey = new Map(records.filter(record => getOwnerId(record) === mainOwnerId).map(record => [getKey(record), record]));
    const transfer: T[] = [];
    const overlaps: { retained: T; discarded: T }[] = [];
    for (const record of records) {
        if (getOwnerId(record) === mainOwnerId) {
            continue;
        }
        const key = getKey(record);
        const retained = retainedByKey.get(key);
        if (retained) {
            overlaps.push({ retained, discarded: record });
        } else {
            retainedByKey.set(key, record);
            transfer.push(record);
        }
    }
    return { transfer, overlaps, remove: overlaps.map(pair => pair.discarded) };
}
/** Match associations only within their own band. A missing Main membership transfers intact. */
export function classifyMembershipRecords<T extends { id: number; bandUserId: number }>(context: MergeContext,
    records: readonly T[], getKey: (record: T) => string | number,
) {
    return context.memberships.map(membership => ({ membership, ...classifyRecords(
        records.filter(record => record.bandUserId === membership.main?.id || record.bandUserId === membership.retiring.id),
        membership.main?.id ?? null, record => record.bandUserId, getKey,
    ) }));
}
export const recordIds = (records: readonly { id: number }[]) => records.map(record => record.id);
