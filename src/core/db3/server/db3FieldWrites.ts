import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { writeBandDynamicString, type DynamicStringWriterDatabase } from "src/locale/server/dynamicStringWriter";
import { LocalizedStringField } from "../shared/columnTypes/localizedString";
import type { xTable } from "../shared/db3core";

// Field discovery spans registered Prisma models; this boundary validates each heterogeneous field value.
type MutationValues = Record<string, unknown>;

/** Convert authorized field edits to persisted values inside the existing DB3 mutation transaction. */
export async function prepareDB3FieldWrites(table: xTable, values: MutationValues, existing: Readonly<MutationValues> | null,
    auth: CMServerAuthorization, database: DynamicStringWriterDatabase,
): Promise<MutationValues> {
    const result = { ...values };
    for (const field of table.columns) {
        if (!(field instanceof LocalizedStringField) || !Object.prototype.hasOwnProperty.call(values, field.member)) {
            continue;
        }
        const edit = field.writeTransportSchema.parse(values[field.member]);
        if (edit.kind === "inherit" && (!table.bandScope?.inheritedSourceMember || !existing?.[table.bandScope.inheritedSourceMember])) {
            throw new Error("Custom entries have no global value to inherit.");
        }
        const currentId = existing?.[field.stringIdentityMember] ?? null;
        if (currentId !== null && (typeof currentId !== "number" || !Number.isSafeInteger(currentId))) {
            throw new Error(`Invalid owned string identity for '${field.member}'.`);
        }
        result[field.stringIdentityMember] = await writeBandDynamicString(database, auth, currentId,
            field.stringFormat, edit);
        delete result[field.member];
    }
    if (table.bandScope && existing === null) {
        result[table.bandScope.member] = auth.requireBand().id;
    }
    return result;
}
