import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { ComputeChangePlan } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import { ChangeAction, ChangeContext, CreateChangeContext, RegisterChange, TAnyModel } from "shared/utils"
import * as db3 from "../db3";
import { CMDBAuthorizeOrThrow } from "types";
import { AuthenticatedMiddlewareCtx } from "blitz";

export interface separateMutationValuesArgs {
    table: db3.xTable;
    fields: TAnyModel;
};
export interface separateMutationValuesResult {
    associationFields: TAnyModel;
    localFields: TAnyModel;
};
export const separateMutationValues = ({ table, fields }: separateMutationValuesArgs) => {
    const ret: separateMutationValuesResult = {
        associationFields: {},
        localFields: {},
    };

    table.columns.forEach(column => {
        switch (column.fieldTableAssociation) {
            case "tableColumn":
                if (fields[column.member] !== undefined) {
                    ret.localFields[column.member] = fields[column.member];
                }
                break;
            case "foreignObject":
                // foreign objects come in with a different member than column.member (FK member, not object member)
                const typedColumn = column as db3.ForeignSingleField<TAnyModel>;
                if (fields[typedColumn.fkMember] !== undefined) {
                    ret.localFields[typedColumn.fkMember] = fields[typedColumn.fkMember];
                }
                break;
            case "associationRecord":
                if (fields[column.member] !== undefined) {
                    ret.associationFields[column.member] = fields[column.member];
                }
                break;
            case "calculated":
                // strip calculated values from any mutation
                break;
            default:
                throw new Error(`unknown field table association; field:${column.member}`);
                break;
        }
    });
    return ret;
};

export interface UpdateAssociationsArgs {
    ctx: AuthenticatedMiddlewareCtx;
    changeContext: ChangeContext;

    localTable: db3.xTable;
    column: db3.TagsField<TAnyModel>;

    desiredTagIds: number[];
    localId: number;
};

// creates/deletes associations. does not update any other data in associations table; this is only for making/breaking associations.
export const UpdateAssociations = async ({ changeContext, ctx, ...args }: UpdateAssociationsArgs) => {
    const associationTableName = args.column.associationTableSpec.tableName;
    const currentAssociations = await db[associationTableName].findMany({
        where: { [args.column.associationLocalIDMember]: args.localId },
    });

    const cp = ComputeChangePlan(currentAssociations.map(a => a[args.column.associationForeignIDMember]), args.desiredTagIds, (a, b) => a === b);

    // remove associations which exist but aren't in the new array
    await db[associationTableName].deleteMany({
        where: {
            [args.column.associationLocalIDMember]: args.localId,
            [args.column.associationForeignIDMember]: {
                in: cp.delete,
            },
        },
    });

    // register those deletions
    for (let i = 0; i < cp.delete.length; ++i) {
        const oldValues = currentAssociations.find(a => a[args.column.associationForeignIDMember] === cp.delete[i])!;
        await RegisterChange({
            action: ChangeAction.delete,
            changeContext,
            table: associationTableName,
            pkid: oldValues.id,
            oldValues,
            ctx,
        });
    }

    // create new associations
    for (let i = 0; i < cp.create.length; ++i) {
        const tagId = cp.create[i]!;
        const newAssoc = await db[associationTableName].create({
            data: {
                [args.column.associationLocalIDMember]: args.localId,
                [args.column.associationForeignIDMember]: tagId,
            },
        });

        await RegisterChange({
            action: ChangeAction.insert,
            changeContext,
            table: associationTableName,
            pkid: newAssoc.id,
            newValues: newAssoc,
            ctx,
        });
    }
};


// DELETE ////////////////////////////////////////////////
export const deleteImpl = async (table: db3.xTable, id: number, ctx: AuthenticatedMiddlewareCtx, currentUser: db3.UserWithRolesPayload): Promise<boolean> => {
    try {
        const contextDesc = `delete:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        CMDBAuthorizeOrThrow(contextDesc, table.editPermission, ctx);
        const dbTableClient = db[table.tableName]; // the prisma interface

        // delete any associations for this item first.
        table.columns.forEach(column => {
            if (column.fieldTableAssociation !== "associationRecord") { return; }
            UpdateAssociations({
                changeContext,
                ctx,
                localId: id,
                localTable: table,
                column: column as db3.TagsField<TAnyModel>,
                desiredTagIds: [],
            });
        });

        const oldValues = await dbTableClient.findFirst({ where: { [table.pkMember]: id } });
        if (!oldValues) {
            throw new Error(`can't delete unknown '${table.tableName}' with pk '${id}'`);
        }
        const choice = await dbTableClient.deleteMany({ where: { [table.pkMember]: id } });

        await RegisterChange({
            action: ChangeAction.delete,
            changeContext,
            table: table.tableName,
            pkid: id,
            oldValues: oldValues,
            ctx,
        });
        return true;
    } catch (e) {
        console.error(e);
        throw (e);
    }
};

// INSERT ////////////////////////////////////////////////
export const insertImpl = async (table: db3.xTable, fields: TAnyModel, ctx: AuthenticatedMiddlewareCtx, currentUser: db3.UserWithRolesPayload): Promise<boolean> => {
    try {
        const contextDesc = `insert:${table.tableName}`;
        CMDBAuthorizeOrThrow(contextDesc, table.editPermission, ctx);
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = db[table.tableName]; // the prisma interface

        const clientModelForValidation: TAnyModel = table.getClientModel(fields, "new");
        const validateResult = table.ValidateAndComputeDiff(clientModelForValidation, clientModelForValidation, "new");
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }

        const { localFields, associationFields } = separateMutationValues({ table, fields });

        // at this point `fields` should not be used because it mixes foreign associations with local values
        // console.log(`Separated local & associations. LOCAL:`);
        // console.log(JSON.stringify(localFields));
        // console.log(`ASSOCIATIONS:`);
        // console.log(JSON.stringify(associationFields));

        const obj = await dbTableClient.create({
            data: localFields,
            include: table.localInclude,
        });

        await RegisterChange({
            action: ChangeAction.insert,
            changeContext,
            table: table.tableName,
            pkid: obj[table.pkMember],
            newValues: localFields,
            ctx,
        });

        // now update any associations
        table.columns.forEach(column => {
            if (column.fieldTableAssociation !== "associationRecord") { return; }
            if (!associationFields[column.member]) { return; }
            UpdateAssociations({
                changeContext,
                ctx,
                localId: obj[table.pkMember],
                localTable: table,
                column: column as db3.TagsField<TAnyModel>,
                desiredTagIds: associationFields[column.member],
            });
        });

        return obj;
    } catch (e) {
        console.error(e);
        throw (e);
    }
}


// UPDATE ////////////////////////////////////////////////
export const updateImpl = async (table: db3.xTable, pkid: number, fields: TAnyModel, ctx: AuthenticatedMiddlewareCtx, currentUser: db3.UserWithRolesPayload): Promise<boolean> => {
    try {
        const contextDesc = `update:${table.tableName}`;
        CMDBAuthorizeOrThrow(contextDesc, table.editPermission, ctx);
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = db[table.tableName]; // the prisma interface

        // in order to validate, we must convert "db" values to "client" values which ValidateAndComputeDiff expects.
        const clientModelForValidation: TAnyModel = table.getClientModel(fields, "update");
        const validateResult = table.ValidateAndComputeDiff(clientModelForValidation, clientModelForValidation, "update");
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }

        const { localFields, associationFields } = separateMutationValues({ table, fields });
        // at this point `fields` should not be used.

        const oldValues = await dbTableClient.findFirst({ where: { [table.pkMember]: pkid } });

        const obj = await dbTableClient.update({
            where: { [table.pkMember]: pkid },
            data: localFields,
            include: table.localInclude,
        });

        await RegisterChange({
            action: ChangeAction.update,
            changeContext,
            table: table.tableName,
            pkid,
            oldValues,
            newValues: obj,
            ctx,
        });

        // now update any associations
        table.columns.forEach(column => {
            if (column.fieldTableAssociation !== "associationRecord") { return; }
            if (!associationFields[column.member]) { return; }
            UpdateAssociations({
                changeContext,
                ctx,
                localId: obj[table.pkMember],
                localTable: table,
                column: column as db3.TagsField<TAnyModel>,
                desiredTagIds: associationFields[column.member],
            });
        });

        return obj;
    } catch (e) {
        console.error(e);
        throw (e);
    }
}
