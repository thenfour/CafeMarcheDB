import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { writeBandDynamicString, type DynamicStringWriterDatabase } from "src/locale/server/dynamicStringWriter";
import type { xTable } from "../shared/db3core";

// Field discovery spans registered Prisma models; this boundary validates each heterogeneous field value.
type MutationValues = Record<string, unknown>;

/** Convert authorized field edits to persisted values inside the existing DB3 mutation transaction. */
export async function prepareDB3FieldWrites(table: xTable, values: MutationValues, existing: Readonly<MutationValues> | null,
    auth: CMServerAuthorization, database: DynamicStringWriterDatabase,
): Promise<MutationValues> {
    const result = { ...values };
    for (const field of table.columns) {
        if (!Object.prototype.hasOwnProperty.call(values, field.member)) {
            continue;
        }
        const write = await field.applyTransactionalWrite({
            value: values[field.member], existingRow: existing,
            hasInheritedSource: !!(table.bandScope?.inheritedSourceMember && existing?.[table.bandScope.inheritedSourceMember]),
            writeLocalizedString: (ownedId, format, edit) => writeBandDynamicString(database, auth, ownedId, format, edit),
        });
        if (write) {
            Object.assign(result, write.values);
            for (const member of write.removeMembers) {
                delete result[member];
            }
        }
    }
    if (table.bandScope && existing === null) {
        result[table.bandScope.member] = auth.requireBand().id;
    }
    return result;
}
