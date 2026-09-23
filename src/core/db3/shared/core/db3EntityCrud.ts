// crud are basically a specialization of the db3 command system to support simple mutations.

import type { TAnyModel } from "@/shared/rootroot";
import { z } from "zod";
import type { AnyDB3Table, DB3IdentityOf } from "../db3core";
import { defineCommand, type AnyDB3Command } from "./db3Command";

// is this a duplication?
const identityResultSchema = <TIdentitySchema extends z.ZodTypeAny>(
    identitySchema: TIdentitySchema,
) => z.object({
    identity: identitySchema,
}).strict();

// ensure that the given zod schema does not contain the server-owned identity fields
// `id` or `publicId` typically.
function requireWritableSchemasDoNotOwnIdentity(
    entity: AnyDB3Table,
    schemaName: string,
    schema: z.AnyZodObject,
): void {
    const identityMembers = new Set([
        entity.pkMember,
        entity.publicIdMember,
    ].filter((member): member is string => !!member));

    const declaredIdentityMembers = //
        Object.keys(schema.shape)
            .filter(member => identityMembers.has(member));

    if (declaredIdentityMembers.length > 0) {
        throw new Error(
            `${entity.tableID} ${schemaName} must not declare server-owned identity fields: ${declaredIdentityMembers.join(", ")}.`,
        );
    }
}

function getDeleteType(entity: AnyDB3Table): "softWhenPossible" | "hard" {
    switch (entity.deletePolicy) {
        case "hard":
            return "hard";
        case "softOnly":
            return "softWhenPossible";
        case "disabled":
            throw new Error(`${entity.tableID} does not permit generated delete commands.`);
    }
}

export interface DB3CrudOperationFlags {
    readonly create?: true;
    readonly update: true;
    readonly delete?: true;
}

interface EntityCrudCommandArgs<
    TEntity extends AnyDB3Table,
    TIdentitySchema extends z.ZodType<DB3IdentityOf<TEntity>>,
    TCreateSchema extends z.AnyZodObject,
    TUpdateFieldsSchema extends z.AnyZodObject,
> {
    entity: TEntity;
    identitySchema: TIdentitySchema;
    operations: DB3CrudOperationFlags;
    createSchema: TCreateSchema;
    updateFieldsSchema: TUpdateFieldsSchema;
}

function createEntityUpdateSchema<
    TEntity extends AnyDB3Table,
    TIdentitySchema extends z.ZodType<DB3IdentityOf<TEntity>>,
    TUpdateFieldsSchema extends z.AnyZodObject,
>(
    entity: TEntity,
    identitySchema: TIdentitySchema,
    updateFieldsSchema: TUpdateFieldsSchema,
) {
    requireWritableSchemasDoNotOwnIdentity(entity, "update schema", updateFieldsSchema);

    const patchSchema: z.ZodType<Partial<z.infer<TUpdateFieldsSchema>>> = updateFieldsSchema
        .strict()
        .partial()
        .superRefine((patch, ctx) => {
            const presentEntries = Object.entries(patch);
            if (presentEntries.length === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Update patch must contain at least one field.",
                });
            }
            for (const [fieldName, value] of presentEntries) {
                if (value !== undefined) continue;
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [fieldName],
                    message: "Patch fields cannot be undefined; omit unchanged fields instead.",
                });
            }
        });
    return z.object({
        identity: identitySchema,
        patch: patchSchema,
    }).strict();
}

function defineCreateOperation<
    TEntity extends AnyDB3Table,
    TIdentitySchema extends z.ZodType<DB3IdentityOf<TEntity>>,
    TCreateSchema extends z.AnyZodObject,
    TUpdateFieldsSchema extends z.AnyZodObject,
>(args: EntityCrudCommandArgs<
    TEntity,
    TIdentitySchema,
    TCreateSchema,
    TUpdateFieldsSchema
>) {
    requireWritableSchemasDoNotOwnIdentity(args.entity, "create schema", args.createSchema);

    // Zod's methods on the AnyZodObject constraint widen the inferred shape;
    // preserve the caller's concrete DTO type while tightening runtime parsing.
    const createSchema = args.createSchema.strict() as TCreateSchema;
    const resultSchema = identityResultSchema(args.identitySchema);
    const invalidation = {
        mode: "caller" as const,
        entityIDs: [args.entity.tableID],
    };

    return {
        kind: "create" as const,
        command: defineCommand({
            commandID: `${args.entity.tableID}_Create`,
            entity: args.entity,
            dtoSchema: createSchema,
            resultSchema,
            serialize: (input: z.infer<typeof createSchema>) => input,
            invalidation,
        }),
    };
}

function defineUpdateOperation<
    TEntity extends AnyDB3Table,
    TIdentitySchema extends z.ZodType<DB3IdentityOf<TEntity>>,
    TCreateSchema extends z.AnyZodObject,
    TUpdateFieldsSchema extends z.AnyZodObject,
>(args: EntityCrudCommandArgs<
    TEntity,
    TIdentitySchema,
    TCreateSchema,
    TUpdateFieldsSchema
>) {
    const updateSchema = createEntityUpdateSchema(
        args.entity,
        args.identitySchema,
        args.updateFieldsSchema,
    );
    const resultSchema = identityResultSchema(args.identitySchema);
    const invalidation = {
        mode: "caller" as const,
        entityIDs: [args.entity.tableID],
    };

    return {
        kind: "update" as const,
        command: defineCommand({
            commandID: `${args.entity.tableID}_Update`,
            entity: args.entity,
            dtoSchema: updateSchema,
            resultSchema,
            serialize: (input: z.infer<typeof updateSchema>) => input,
            invalidation,
        }),
    };
}

function defineDeleteOperation<
    TEntity extends AnyDB3Table,
    TIdentitySchema extends z.ZodType<DB3IdentityOf<TEntity>>,
    TCreateSchema extends z.AnyZodObject,
    TUpdateFieldsSchema extends z.AnyZodObject,
>(args: EntityCrudCommandArgs<
    TEntity,
    TIdentitySchema,
    TCreateSchema,
    TUpdateFieldsSchema
>) {
    const deleteSchema = z.object({
        identity: args.identitySchema,
    }).strict();
    const resultSchema = identityResultSchema(args.identitySchema);
    const invalidation = {
        mode: "caller" as const,
        entityIDs: [args.entity.tableID],
    };

    return {
        kind: "delete" as const,
        deleteType: getDeleteType(args.entity),
        command: defineCommand({
            commandID: `${args.entity.tableID}_Delete`,
            entity: args.entity,
            dtoSchema: deleteSchema,
            resultSchema,
            serialize: (input: z.infer<typeof deleteSchema>) => input,
            invalidation,
        }),
    };
}

export interface DB3GeneratedCrudOperation<
    TKind extends "create" | "update" | "delete",
    TCommand extends AnyDB3Command,
> {
    readonly kind: TKind;
    readonly command: TCommand;
}

export type DB3GeneratedCreateOperation<TCommand extends AnyDB3Command = AnyDB3Command> =
    DB3GeneratedCrudOperation<"create", TCommand>;

export type DB3GeneratedUpdateOperation<TCommand extends AnyDB3Command = AnyDB3Command> =
    DB3GeneratedCrudOperation<"update", TCommand>;

export interface DB3GeneratedDeleteOperation<TCommand extends AnyDB3Command = AnyDB3Command>
    extends DB3GeneratedCrudOperation<"delete", TCommand> {
    readonly deleteType: "softWhenPossible" | "hard";
}

export type AnyDB3GeneratedCrudOperation =
    | DB3GeneratedCreateOperation
    | DB3GeneratedUpdateOperation
    | DB3GeneratedDeleteOperation;

export interface DB3TableEditorCommands<
    TEntity extends AnyDB3Table,
    TIdentitySchema extends z.ZodType<DB3IdentityOf<TEntity>>,
    TCreateOperation extends DB3GeneratedCreateOperation | undefined,
    TUpdateOperation extends DB3GeneratedUpdateOperation,
    TDeleteOperation extends DB3GeneratedDeleteOperation | undefined,
> {
    readonly entity: TEntity;
    readonly identitySchema: TIdentitySchema;
    readonly operations: {
        readonly create: TCreateOperation;
        readonly update: TUpdateOperation;
        readonly delete: TDeleteOperation;
    };
}

export interface AnyDB3TableEditorCommands {
    readonly entity: AnyDB3Table;
    readonly identitySchema: z.ZodTypeAny;
    readonly operations: {
        readonly create: DB3GeneratedCreateOperation | undefined;
        readonly update: DB3GeneratedUpdateOperation;
        readonly delete: DB3GeneratedDeleteOperation | undefined;
    };
}

/**
 * Defines the ordinary single-row write contract for an entity.
 *
 * The supplied schemas declare writable fields only. Identity is generated by
 * the server on create and travels separately from a present-keys-only patch on
 * update. The public DTOs therefore never expose xTable names, numeric table
 * IDs, or the legacy generic mutation envelope.
 */
export function defineEntityCrudCommands<
    TEntity extends AnyDB3Table,
    TIdentitySchema extends z.ZodType<DB3IdentityOf<TEntity>>,
    TCreateSchema extends z.AnyZodObject,
    TUpdateFieldsSchema extends z.AnyZodObject,
    TOperations extends DB3CrudOperationFlags,
>(args: EntityCrudCommandArgs<
    TEntity,
    TIdentitySchema,
    TCreateSchema,
    TUpdateFieldsSchema
> & { operations: TOperations }) {
    const createOperation = args.operations.create
        ? defineCreateOperation(args)
        : undefined;
    const updateOperation = defineUpdateOperation(args);
    const deleteOperation = args.operations.delete
        ? defineDeleteOperation(args)
        : undefined;

    return {
        entity: args.entity,
        identitySchema: args.identitySchema,
        operations: {
            create: createOperation,
            update: updateOperation,
            delete: deleteOperation,
        },
    } as unknown as DB3TableEditorCommands<
        TEntity,
        TIdentitySchema,
        TOperations["create"] extends true ? NonNullable<typeof createOperation> : undefined,
        typeof updateOperation,
        TOperations["delete"] extends true ? NonNullable<typeof deleteOperation> : undefined
    >;
}

export function getDefinedCrudOperations(
    commands: AnyDB3TableEditorCommands,
): AnyDB3GeneratedCrudOperation[] {
    return [
        commands.operations.create,
        commands.operations.update,
        commands.operations.delete,
    ].filter((operation): operation is AnyDB3GeneratedCrudOperation => !!operation);
}

function preparedValuesEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (a instanceof Date && b instanceof Date) return a.valueOf() === b.valueOf();
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length
            && a.every((value, index) => preparedValuesEqual(value, b[index]));
    }
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);
    return aKeys.length === bKeys.length
        && aKeys.every(key => Object.prototype.hasOwnProperty.call(bRecord, key)
            && preparedValuesEqual(aRecord[key], bRecord[key]));
}

/** Returns the present-keys-only patch between two prepared mutation models. */
export function createEntityCrudUpdatePatch(
    previous: TAnyModel,
    next: TAnyModel,
): TAnyModel {
    return Object.fromEntries(
        Object.entries(next).filter(([member, value]) => (
            !Object.prototype.hasOwnProperty.call(previous, member)
            || !preparedValuesEqual(previous[member], value)
        )),
    );
}
