
type ClassifiableRecordBase = {
    id: number; // pk of the object
    userId: number | null; // user this record belongs to
};

// walks through records and classifies each by
// - transfer: records that should be transferred to the main user
// - overlaps: records that conflict with existing main user records
// - remove: records that should be removed (i.e., discarded due to overlap)
// Stable/deterministic ordering,
// including duplicate associations which the database does not prohibit.
export function classifyRecords<T extends ClassifiableRecordBase>(
    records: readonly T[],
    mainUserId: number,
    getKey: (record: T) => string | number,
) {
    const main = new Map(records
        .filter(record => record.userId === mainUserId)
        .map(record => [getKey(record), record])
    );
    const transfer: T[] = [];
    const overlaps: { retained: T; discarded: T }[] = [];
    for (const record of records) {
        if (record.userId === mainUserId) {
            continue;
        }
        const key = getKey(record);
        const retained = main.get(key);
        if (retained) {
            overlaps.push({ retained, discarded: record });
        }
        else {
            main.set(key, record);
            transfer.push(record);
        }
    }
    return {
        transfer,
        overlaps,
        remove: overlaps.map(pair => pair.discarded),
    };
}

// used so commonly in merge policy classes this is warranted.
export const recordIds = (records: readonly { id: number }[]) => records.map(record => record.id);
