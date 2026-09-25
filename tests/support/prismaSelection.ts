import type { DB3ReadSelectionArgs } from "src/core/db3/shared/core/db3ReadSelection";

// Test fixtures span multiple models; retain only explicitly selected members,
// including nested relations, so extra fixture data cannot hide missing selects.
export function selectPrismaTestRow(
    row: Readonly<Record<string, unknown>>,
    args: DB3ReadSelectionArgs,
): Record<string, unknown> {
    if (!args.select) throw new Error("This test projector requires an explicit select.");
    const result: Record<string, unknown> = {};
    for (const [member, selection] of Object.entries(args.select)) {
        if (!selection) continue;
        const value = row[member];
        result[member] = selection === true ? value : selectValue(value, selection);
    }
    return result;
}

function selectValue(value: unknown, args: DB3ReadSelectionArgs): unknown {
    if (Array.isArray(value)) return value.map(item => selectValue(item, args));
    if (value === null || value === undefined) return value;
    if (typeof value !== "object") throw new Error("Expected a relation object in the test fixture.");
    // The runtime relation check above establishes a record, not a known model.
    return selectPrismaTestRow(value as Record<string, unknown>, args);
}
