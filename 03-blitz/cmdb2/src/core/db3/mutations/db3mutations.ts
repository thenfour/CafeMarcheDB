import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { DeleteByIdMutationImplementation } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange, TAnyModel } from "shared/utils"
import { GetObjectByIdSchema } from "src/auth/schemas";
import * as db3 from "../db3";
import { CMDBAuthorizeOrThrow } from "types";
import { AuthenticatedMiddlewareCtx } from "blitz";

// DELETE ////////////////////////////////////////////////
const deleteImpl = async (table: db3.xTable, id: number, ctx: AuthenticatedMiddlewareCtx): Promise<boolean> => {
    try {
        const contextDesc = `delete:${table.tableName}`;
        CMDBAuthorizeOrThrow(contextDesc, table.editPermission, ctx);
        const dbTableClient = db[table.tableName]; // the prisma interface

        const oldValues = await dbTableClient.findFirst({ where: { [table.pkMember]: id } });
        if (!oldValues) {
            throw new Error(`can't delete unknown '${table.tableName}' with pk '${id}'`);
        }
        const choice = await dbTableClient.deleteMany({ where: { [table.pkMember]: id } });

        await RegisterChange({
            action: ChangeAction.delete,
            changeContext: CreateChangeContext(contextDesc),
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
const insertImpl = async (table: db3.xTable, fields: TAnyModel, ctx: AuthenticatedMiddlewareCtx): Promise<boolean> => {
    try {
        const contextDesc = `insert:${table.tableName}`;
        CMDBAuthorizeOrThrow(contextDesc, table.editPermission, ctx);
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = db[table.tableName]; // the prisma interface

        const validateResult = table.ValidateAndComputeDiff(fields, fields);
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }

        // separate association arrays from the local columns.
        const associationFields: TAnyModel = {};
        const localFields: TAnyModel = {};
        table.columns.forEach(column => {
            if (fields[column.member] === undefined) {
                return;
            }
            const dest = (column.fieldTableAssociation === "associationRecord") ? associationFields : localFields;
            dest[column.member] = fields[column.member];
        });
        // at this point `fields` should not be used.

        const obj = await dbTableClient.create({
            data: localFields,
            include: table.localInclude,
        });

        await RegisterChange({
            action: ChangeAction.insert,
            changeContext,
            table: "instrumentTag",
            pkid: obj.id,
            newValues: localFields,
            ctx,
        });

        // now update any associations
        for (const [fieldName, associations] of Object.entries(associationFields)) {
            console.log(`todo: insert association.... ${JSON.stringify(fieldName)}: ${associations.length}`);
        }

        return obj;
    } catch (e) {
        console.error(e);
        throw (e);
    }
}


// UPDATE ////////////////////////////////////////////////
const updateImpl = async (table: db3.xTable, pkid: number, fields: TAnyModel, ctx: AuthenticatedMiddlewareCtx): Promise<boolean> => {
    try {
        const contextDesc = `update:${table.tableName}`;
        CMDBAuthorizeOrThrow(contextDesc, table.editPermission, ctx);
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = db[table.tableName]; // the prisma interface

        const validateResult = table.ValidateAndComputeDiff(fields, fields);
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }

        // separate association arrays from the local columns.
        const associationFields: TAnyModel = {};
        const localFields: TAnyModel = {};
        table.columns.forEach(column => {
            if (fields[column.member] === undefined) {
                return;
            }
            const dest = (column.fieldTableAssociation === "associationRecord") ? associationFields : localFields;
            dest[column.member] = fields[column.member];
        });
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
            table: "role",
            pkid,
            oldValues,
            newValues: obj,
            ctx,
        });

        // now update any associations
        for (const [fieldName, associations] of Object.entries(associationFields)) {
            console.log(`todo: update association.... ${JSON.stringify(fieldName)}: ${associations.length}`);
        }

        return obj;
    } catch (e) {
        console.error(e);
        throw (e);
    }
}

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize("db3mutations", Permission.login),
    async (input: db3.MutatorInput, ctx: AuthenticatedMiddlewareCtx) => {
        const table = db3.gAllTables[input.tableName]!;
        if (input.deleteId != null) {
            return await deleteImpl(table, input.deleteId, ctx);
        }
        if (input.insertModel != null) {
            return await insertImpl(table, input.insertModel, ctx);
        }
        if (input.updateModel != null) {
            return await updateImpl(table, input.updateId!, input.updateModel, ctx);
        }
    }
);

