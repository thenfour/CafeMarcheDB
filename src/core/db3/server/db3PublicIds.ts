import type { DB3ServerAuthorization } from "./db3ServerAuthorization";
// server
import type { TAnyModel } from "@/shared/rootroot";
import { isPublicId } from "shared/publicId";
import * as db3 from "../db3";
import type { TransactionalPrismaClient } from "../shared/apiTypes";
import { db3Server } from "./db3Server";

export class DB3PublicIdError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DB3PublicIdError";
    }
}

// Resolve public IDs through the target table's ordinary row-visibility policy.
// Missing and inaccessible rows intentionally have the same error so this
// boundary cannot be used as an existence oracle.
export async function resolvePublicIds(
    table: db3.xTable,
    publicIds: readonly unknown[],
    publicData: DB3ServerAuthorization,
    database: TransactionalPrismaClient,
    includeDeleted = false,
): Promise<number[]> {
    if (!table.publicIdMember || publicIds.some(publicId => !isPublicId(publicId))) {
        throw new DB3PublicIdError(`Invalid public ID for ${table.tableID}.`);
    }
    if (!table.authorizeTableForView(publicData)) {
        throw new DB3PublicIdError(`${table.tableID} was not found.`);
    }
    const uniquePublicIds = [...new Set(publicIds.filter(isPublicId))];
    if (uniquePublicIds.length === 0) return [];

    const where = table.CalculateWhereClause({
        filterModel: { publicIds: uniquePublicIds },
        publicData,
        includeDeleted,
    });
    const rows = await database[table.tableName].findMany({
        where,
        select: {
            [table.pkMember]: true,
            [table.publicIdMember]: true,
        },
    });
    const idsByPublicId = new Map<string, number>();
    rows.forEach((row: TAnyModel) => {
        const publicId = row[table.publicIdMember!];
        const id = row[table.pkMember];
        if (typeof publicId === "string" && typeof id === "number") {
            idsByPublicId.set(publicId, id);
        }
    });
    if (idsByPublicId.size !== uniquePublicIds.length) {
        throw new DB3PublicIdError(`${table.tableID} was not found.`);
    }
    return uniquePublicIds.map(publicId => idsByPublicId.get(publicId)!);
}

export async function resolvePublicId(
    table: db3.xTable,
    publicId: string,
    publicData: DB3ServerAuthorization,
    database: TransactionalPrismaClient,
    includeDeleted = false,
): Promise<number> {
    return (await resolvePublicIds(
        table,
        [publicId],
        publicData,
        database,
        includeDeleted,
    ))[0]!;
}

export async function resolvePublicQueryParameters(
    table: db3.xTable,
    params: Record<string, unknown>,
    publicData: DB3ServerAuthorization,
    database: TransactionalPrismaClient,
): Promise<Record<string, unknown>> {
    const resolved = { ...params };
    for (const [parameterName, spec] of Object.entries(table.queryParameters || {})) {
        if (spec.kind !== "entityIdentity" && spec.kind !== "entityIdentityArray") continue;
        const value = resolved[parameterName];
        if (value === undefined || value === null) continue;

        const targetTable = db3.GetTableById(spec.targetTableID);
        if (!targetTable.publicIdMember) continue;

        if (spec.kind === "entityIdentity") {
            resolved[parameterName] = await resolvePublicId(
                targetTable,
                value as string, // Runtime validation derives this shape from the target table.
                publicData,
                database,
            );
            continue;
        }
        if (!Array.isArray(value)) {
            throw new DB3PublicIdError(
                `Expected public-ID array for ${table.tableID}.${parameterName}.`,
            );
        }
        resolved[parameterName] = await resolvePublicIds(
            targetTable,
            value,
            publicData,
            database,
        );
    }
    return resolved;
}

// Takes a model with public IDs from the client and resolves scalar foreign
// keys and association target arrays to numeric database IDs.
// Examples: { userId: "publicId123" } becomes { userId: 42 }, and
// { tags: ["publicId456"] } becomes { tags: [84] }.
export async function resolvePublicForeignIds(
    table: db3.xTable,
    model: TAnyModel,
    publicData: DB3ServerAuthorization,
    database: TransactionalPrismaClient,
): Promise<TAnyModel> {
    const ret = { ...model };
    for (const field of table.columns) {
        if (field.fieldTableAssociation === "associationRecord") {
            if (!Object.prototype.hasOwnProperty.call(ret, field.member)) continue;
            const associationField = field as db3.TagsField<TAnyModel>;
            const foreignTable = associationField.getForeignTableShema();
            if (!foreignTable.publicIdMember) continue;

            const identities = ret[field.member];
            if (!Array.isArray(identities)) {
                throw new DB3PublicIdError(
                    `Expected public-ID array for ${table.tableID}.${field.member}.`,
                );
            }
            ret[field.member] = await resolvePublicIds(
                foreignTable,
                identities,
                publicData,
                database,
            );
            continue;
        }

        if (field.fieldTableAssociation !== "foreignObject" || !field.fkidMember) {
            // not a foreign object.
            continue;
        }
        const foreignTable = (field as db3.ForeignSingleField<TAnyModel>).getForeignTableSchema();
        if (!foreignTable.publicIdMember) {
            // foreign table doesn't use publicId; skip.
            continue;
        }

        // does the passed-in model actually contain this foreign key?
        if (Object.prototype.hasOwnProperty.call(ret, field.fkidMember)) {
            const value = ret[field.fkidMember];
            if (value !== null && value !== undefined) {
                ret[field.fkidMember] = await resolvePublicId(foreignTable, value, publicData, database);
            }
        }

        // and if the passed-in model contains the foreign object itself, resolve its public ID.
        // example:
        // { user: { publicId: "publicId123", ... } } becomes { userId: 42 } after resolution.
        // mutations from client include either the fkid or the foreign object itself; it's just a
        // consequence of how client code is structured.
        if (Object.prototype.hasOwnProperty.call(ret, field.member)) {
            const value = ret[field.member];
            if (value !== null && value !== undefined) {
                const publicId = value[foreignTable.publicIdMember];
                ret[field.fkidMember] = await resolvePublicId(foreignTable, publicId, publicData, database);
                delete ret[field.member];
            }
        }
    }
    return ret;
}

// takes a db model object, creates a resulting client-viewable object with public IDs instead of internal IDs
export function projectDB3ModelPublicIds(
    table: db3.xTable,
    model: TAnyModel,
    publicData?: DB3ServerAuthorization,
): TAnyModel {
    const ret = { ...model };

    if (table.publicIdMember) {
        delete ret[table.pkMember];
    }

    for (const field of table.columns) {
        if (field.fieldTableAssociation === "foreignObject" && field.fkidMember) {
            // i'm going to use `status` / `statusId` as an example of what's going on.
            // this branch turns `statusId` from it's internal numeric id to its public ID
            const foreignTable = (field as db3.ForeignSingleField<TAnyModel>).getForeignTableSchema();
            const foreignModel = ret[field.member];
            if (foreignModel && typeof foreignModel === "object")// foreign object is present (`status`); recurse.
            {
                ret[field.member] = projectDB3ModelPublicIds(foreignTable, foreignModel, publicData);
                if (foreignTable.publicIdMember) {
                    // foreign refs also have a 2nd representation as the fkid (`statusId`)
                    ret[field.fkidMember] = foreignModel[foreignTable.publicIdMember];
                }
            } else if (
                foreignTable.publicIdMember // foreign table uses public IDs
                && ret[field.fkidMember] !== null // The foreign _key_ is not null; a relationship exists but its object isn't there
                && !isPublicId(ret[field.fkidMember] // the fkid hasn't been converted to a public ID yet.
                )
            ) {
                // so `statusId` = 42, but `status` is not present, and the status entity
                // uses publicIds. It means we don't know its public ID (it's still unresolved);
                // Never retain an unresolved database FK for a converted target.
                // Null is the public representation of an absent optional relation.
                delete ret[field.fkidMember];
            }
            continue;
        }

        if (field.fieldTableAssociation === "associationRecord" && Array.isArray(ret[field.member])) {
            const associationTable = (field as db3.TagsField<TAnyModel>).getAssociationTableShema();
            ret[field.member] = ret[field.member].map(association => (
                projectDB3ModelPublicIds(associationTable, association, publicData)
            ));
            continue;
        }

        // setlists / song lists are an example of ForeignCollectionField. similar but not equal
        // to associationRecord.
        if (field instanceof db3.ForeignCollectionField && Array.isArray(ret[field.member])) {
            const foreignTable = db3.GetTableById(field.foreignTableID);
            ret[field.member] = ret[field.member].map(foreignModel => (
                projectDB3ModelPublicIds(foreignTable, foreignModel, publicData)
            ));
        }
    }

    return ret;
}

// Applies field and row authorization to every selected relation before projecting
// database identifiers. This is intentionally separate from the legacy transport
// helper: named views opt into the complete DTO boundary while older callers can be
// migrated independently.
export function authorizeAndProjectDB3ViewModel(
    table: db3.xTable,
    model: TAnyModel,
    publicData: DB3ServerAuthorization,
    contextDesc: string,
    includeDeleted = false,
): TAnyModel | null {
    const authorizeRecursively = (
        currentTable: db3.xTable,
        currentModel: TAnyModel,
        path: string,
    ): TAnyModel | null => {
        db3Server.table(currentTable).assertReadAuthorizationInput(currentModel, `${contextDesc}:${path}`);
        const result = currentTable.authorizeAndSanitize({
            contextDesc: `${contextDesc}:${path}`,
            publicData,
            includeDeleted,
            rowMode: "view",
            model: currentModel,
            fallbackOwnerId: null,
        });
        if (!result.rowIsAuthorized) return null;

        const authorizedModel = { ...result.authorizedModel };
        for (const field of currentTable.columns) {
            if (!Object.prototype.hasOwnProperty.call(authorizedModel, field.member)) continue;
            const value = authorizedModel[field.member];

            if (field.fieldTableAssociation === "foreignObject" && value && typeof value === "object") {
                const foreignTable = (field as db3.ForeignSingleField<TAnyModel>).getForeignTableSchema();
                const authorizedForeign = authorizeRecursively(foreignTable, value, `${path}.${field.member}`);
                if (authorizedForeign) {
                    authorizedModel[field.member] = authorizedForeign;
                } else {
                    delete authorizedModel[field.member];
                    if (field.fkidMember) delete authorizedModel[field.fkidMember];
                }
                continue;
            }

            if (field.fieldTableAssociation === "associationRecord" && Array.isArray(value)) {
                const associationTable = (field as db3.TagsField<TAnyModel>).getAssociationTableShema();
                authorizedModel[field.member] = value
                    .map((association, index) => authorizeRecursively(
                        associationTable,
                        association,
                        `${path}.${field.member}[${index}]`,
                    ))
                    .filter((association): association is TAnyModel => association !== null);
                continue;
            }

            if (field instanceof db3.ForeignCollectionField && Array.isArray(value)) {
                const foreignTable = db3.GetTableById(field.foreignTableID);
                authorizedModel[field.member] = value
                    .map((foreignModel, index) => authorizeRecursively(
                        foreignTable,
                        foreignModel,
                        `${path}.${field.member}[${index}]`,
                    ))
                    .filter((foreignModel): foreignModel is TAnyModel => foreignModel !== null);
            }
        }
        return authorizedModel;
    };

    const authorizedModel = authorizeRecursively(table, model, table.tableID);
    return authorizedModel
        ? projectDB3ModelPublicIds(table, authorizedModel, publicData)
        : null;
}

// recursively checks if a table or any of its related tables use public IDs in transport
// walks columns, down through associations as they're defined in the db3 schemas.
export function tableUsesPublicIdsInTransport(table: db3.xTable, ancestors = new Set<string>()): boolean {
    if (table.publicIdMember) {
        return true; // yes.
    }
    if (ancestors.has(table.tableID)) {
        return false; // prevent infinite recursion in case of circular references
    }
    const nextAncestors = new Set(ancestors).add(table.tableID);
    return table.columns.some(field => {
        if (field.fieldTableAssociation === "foreignObject") {
            return tableUsesPublicIdsInTransport(
                (field as db3.ForeignSingleField<TAnyModel>).getForeignTableSchema(),
                nextAncestors,
            );
        }
        if (field.fieldTableAssociation === "associationRecord") {
            return tableUsesPublicIdsInTransport(
                (field as db3.TagsField<TAnyModel>).getAssociationTableShema(),
                nextAncestors,
            );
        }
        if (field instanceof db3.ForeignCollectionField) {
            return tableUsesPublicIdsInTransport(db3.GetTableById(field.foreignTableID), nextAncestors);
        }
        return false;
    });
}

// takes a data model, sanitizes it for transport by resolving public IDs
export function sanitizeDB3ModelForTransport(
    table: db3.xTable,
    model: TAnyModel | null,
    publicData: DB3ServerAuthorization,
    contextDesc: string,
): TAnyModel {
    if (!model) {
        throw new DB3PublicIdError(`${table.tableID} was not found after mutation.`);
    }

    const result = table.authorizeAndSanitize({
        contextDesc,
        publicData,
        rowMode: "view",
        model,
        fallbackOwnerId: null,
    });
    if (!result.rowIsAuthorized) {
        throw new DB3PublicIdError(`Not authorized to view ${table.tableID}.`);
    }
    return projectDB3ModelPublicIds(table, result.authorizedModel, publicData);
}
