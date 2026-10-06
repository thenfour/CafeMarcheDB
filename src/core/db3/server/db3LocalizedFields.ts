import type { xTable } from "../shared/db3core";
import { LocalizedStringField } from "../shared/columnTypes/localizedString";
import type { StringResolution } from "src/locale/shared/stringResolution";

function readIdentity(row: object | null, member: string): number | null {
    // DB3 discovers fields at runtime across different model shapes. Check the value before using it.
    const value: unknown = row === null ? null : Reflect.get(row, member);
    if (value == null) return null;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid localized field identity '${member}'.`);
    return value;
}

/** A null local identity inherits; an untranslated local identity never does. */
export function getDB3LocalizedIdentities(table: xTable, local: object, inherited: object | null): ReadonlyMap<string, number | null> {
    return new Map(table.columns.filter(field => field instanceof LocalizedStringField).map(field => [
        field.member, readIdentity(local, field.stringIdentityMember) ?? readIdentity(inherited, field.stringIdentityMember),
    ]));
}
export function resolveDB3LocalizedFields(table: xTable, local: object, inherited: object | null,
    strings: ReadonlyMap<number, StringResolution>, missing: StringResolution,
): ReadonlyMap<string, StringResolution> {
    return new Map([...getDB3LocalizedIdentities(table, local, inherited)].map(([member, id]) => [
        member, id === null ? missing : strings.get(id) ?? missing,
    ]));
}
