import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { resolveAuthorizedDynamicStrings, type LocalizationDatabase } from "src/locale/server/localization";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import type { StringResolution } from "src/locale/shared/stringResolution";
import { LocalizedStringField } from "../shared/columnTypes/localizedString";
import { CatalogSourceField, InheritedField } from "../shared/columnTypes/inherited";
import type { xTable } from "../shared/db3core";
import { getDB3LocalizedIdentities, resolveDB3LocalizedFields } from "./db3LocalizedFields";

// Runtime field discovery spans different Prisma models; every read member is checked before use.
// normal view "hydration" is not sufficient because this is earlier in the pipeline
// for performing a query.

// *COULD* it be a server-based view? probably, but would require inventing new mechanisms.
// this is basically that mechanism.


type ReadRow = Readonly<Record<string, unknown>>;
function sourceOf(table: xTable, row: ReadRow): ReadRow | null {
    const value = table.bandScope?.inheritedFrom ? row[table.bandScope.inheritedFrom] : null;
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as ReadRow : null; // Prisma source selections are records.
}
const missing: StringResolution = { value: null, localeTag: null, scope: "band", source: "missing", reason: "missing", requestedTag: null };

/** Resolve field-owned values before the ordinary authorization/projection and DTO pipeline. */
export async function resolveDB3ReadRows(table: xTable, rows: readonly ReadRow[], database: LocalizationDatabase,
    auth: CMServerAuthorization, preferences: LocalePreferenceInput,
): Promise<ReadRow[]> {
    const fields = table.columns.filter(field => table.authorizeColumnForView({ model: null, auth, columnName: field.member }));
    for (const row of rows) {
        if (table.bandScope) auth.requireBandResource(Number(table.getBandId(row)));
    }
    const identities = rows.flatMap(row => [...getDB3LocalizedIdentities(table, row, sourceOf(table, row)).entries()]
        .filter(([member, identity]) => fields.some(field => field.member === member) && identity !== null)
        .map(([, identity]) => identity!));
    const strings = await resolveAuthorizedDynamicStrings(database, auth, [...new Set(identities)], preferences);
    return rows.map(row => {
        const source = sourceOf(table, row);
        const resolutions = resolveDB3LocalizedFields(table, row, source, strings, missing);
        const result = { ...row };
        for (const field of fields) {
            if (!Object.prototype.hasOwnProperty.call(row, field.member)) {
                continue;
            }
            if (field instanceof LocalizedStringField) {
                const resolution = resolutions.get(field.member) ?? missing;
                const localString = row[field.member];
                result[field.member] = resolution.value;
                result[`${field.member}Resolution`] = resolution;
                result[`${field.member}StringPublicId`] = localString && typeof localString === "object"
                    ? Reflect.get(localString, "publicId") : null;
            } else if (field instanceof InheritedField) {
                result[`${field.member}Override`] = row[field.member];
                const inherited = source?.[field.member] ?? field.defaultTransportValue;
                result[`${field.member}InheritedValue`] = inherited;
                result[field.member] = row[field.member] ?? inherited;
            } else if (field instanceof CatalogSourceField) {
                result[field.member] = source?.publicId ?? null;
                result.globalPublicId = source?.publicId ?? null;
            }
        }
        return result;
    });
}
