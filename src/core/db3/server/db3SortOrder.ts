
/**
 * Collect a reorder scope's existing positions from its numeric sort-order field.
 * Return one strictly increasing slot per item, in ascending order, for assignment
 * to the reordered rows. Existing gaps remain; duplicates advance by one.
 * For example, positions [8, 2, 2] produce [2, 3, 8]. Input rows are unchanged.
 */
export function createUsableSortOrderSlots<
    TItem extends Record<TMember, number>,
    TMember extends keyof TItem,
>(
    items: readonly TItem[],
    sortOrderMember: TMember,
): number[] {
    const slots: number[] = items.map(item => item[sortOrderMember]).sort((a, b) => a - b);
    for (let i = 1; i < slots.length; ++i) {
        if (slots[i]! <= slots[i - 1]!) slots[i] = slots[i - 1]! + 1;
    }
    return slots;
}
