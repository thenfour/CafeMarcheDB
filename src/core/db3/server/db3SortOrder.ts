
// Keep healthy gaps, but repair duplicate slots before moving rows.
export function createUsableSortOrderSlots(
    items: readonly Record<string, unknown>[],
    sortOrderMember: string,
): number[] {
    const slots = items.map(item => {
        const value = item[sortOrderMember];
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new Error(`Invalid sort order in ${sortOrderMember}.`);
        }
        return value;
    }).sort((a, b) => a - b);
    for (let i = 1; i < slots.length; ++i) {
        if (slots[i]! <= slots[i - 1]!) slots[i] = slots[i - 1]! + 1;
    }
    return slots;
}
