// server
import type { TAnyModel } from "@/shared/rootroot";
import { isPublicId } from "shared/publicId";
import * as db3 from "../db3";
import type { TransactionalPrismaClient } from "../shared/apiTypes";

export class DB3PublicIdError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DB3PublicIdError";
    }
}

// generic routine that resolves a public ID to its corresponding numeric ID in the database.
// only supports one at a time for the moment; a batch version may need to be added for larger sets,
// however this normally only gets called with ids that the client sends which should never be many.
// throws if not found.
export async function resolvePublicId(
    table: db3.xTable,
    publicId: string,
    publicData: db3.DB3Authorization,
    database: TransactionalPrismaClient,
    includeDeleted = false,
): Promise<number> {
    if (!table.publicIdMember || !isPublicId(publicId)) {
        throw new DB3PublicIdError(`Invalid public ID for ${table.tableID}.`);
    }
    if (!table.authorizeTableForView(publicData)) {
        throw new DB3PublicIdError(`${table.tableID} was not found.`);
    }
    const where = await table.CalculateWhereClause({
        filterModel: { publicIds: [publicId] },
        publicData,
        includeDeleted,
    });
    const row = await database[table.tableName].findFirst({
        where,
        select: { [table.pkMember]: true },
    });
    const id = row?.[table.pkMember];
    if (typeof id !== "number") {
        throw new DB3PublicIdError(`${table.tableID} was not found.`);
    }
    return id;
}

// takes a model with public ids from the client, 
// and resolves them to their corresponding numeric IDs in the database.
// example: { userId: "publicId123" } becomes { userId: 42 } after resolution.
export async function resolvePublicForeignIds(
    table: db3.xTable,
    model: TAnyModel,
    publicData: db3.DB3Authorization,
    database: TransactionalPrismaClient,
): Promise<TAnyModel> {
    const ret = { ...model };
    for (const field of table.columns) {
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
    publicData: db3.DB3Authorization,
): TAnyModel {
    const ret = { ...model };

    if (table.publicIdMember) {
        delete ret[table.pkMember];
    }

    for (const field of table.columns) {
        if (field.fieldTableAssociation === "foreignObject" && field.fkidMember) {
            const foreignTable = (field as db3.ForeignSingleField<TAnyModel>).getForeignTableSchema();
            const foreignModel = ret[field.member];
            if (foreignModel && typeof foreignModel === "object") {
                ret[field.member] = projectDB3ModelPublicIds(foreignTable, foreignModel, publicData);
                if (foreignTable.publicIdMember) {
                    ret[field.fkidMember] = foreignModel[foreignTable.publicIdMember];
                }
            } else if (foreignTable.publicIdMember && !isPublicId(ret[field.fkidMember])) {
                // Never retain an unresolved database FK for a converted target.
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
    publicData: db3.DB3Authorization,
    contextDesc: string,
    includeDeleted = false,
): TAnyModel | null {
    const authorizeRecursively = (
        currentTable: db3.xTable,
        currentModel: TAnyModel,
        path: string,
    ): TAnyModel | null => {
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
    publicData: db3.DB3Authorization,
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
