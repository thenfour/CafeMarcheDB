import type { TAnyModel } from "@/shared/rootroot";
import {
    ZodToPrismaSelection,
} from "@/shared/prismaUtils";
import type { z } from "zod";
import { z as zod } from "zod";
import {
    defineEntityCrudCommands,
    getDefinedCrudOperations,
    type AnyDB3EntityEditorCommands,
    type DB3CrudOperationFlags,
} from "./db3EntityCrud";
import type { AnyDB3Entity, EntityIdOf, SchemaOf } from "./db3Entity";
import type {
    DB3FieldsOf,
    DB3SchemaClientModel,
    DB3SchemaMutationModel,
} from "../db3core";
import {
    defineView,
    type DB3View,
    type DB3ViewSelectionArgs,
    type DB3ViewSelectionContext,
    type DerivedDB3ViewSelection,
} from "./db3View";
import type { DB3ReferenceProvider } from "./db3Hydration";

export interface DB3CrudView<
    TEntity extends AnyDB3Entity,
    TSelection,
    TDtoSchema extends z.ZodTypeAny,
    TClient extends TAnyModel,
    TCrud extends AnyDB3EntityEditorCommands,
> extends DB3View<TEntity, TSelection, TDtoSchema, TClient> {
    readonly crud: TCrud;
}

export type AnyDB3CrudView = DB3View<
    AnyDB3Entity,
    any,
    z.ZodTypeAny,
    TAnyModel
> & { readonly crud: AnyDB3EntityEditorCommands };

type CrudViewSelection<
    TEntity extends AnyDB3Entity,
    TDtoSchema extends z.AnyZodObject,
    TSelection,
> = [TSelection] extends [undefined]
    ? DerivedDB3ViewSelection<TEntity, TDtoSchema>
    : TSelection;

const crudViewsByCommandID = new Map<string, AnyDB3CrudView>();

function createIdentitySchema<TEntity extends AnyDB3Entity>(
    entity: TEntity,
): z.ZodType<EntityIdOf<TEntity>> {
    const schema = entity.schema.publicIdMember
        ? zod.string().length(16).regex(/^[A-Za-z0-9_-]+$/)
        : zod.number().int();
    return schema as z.ZodType<EntityIdOf<TEntity>>;
}

/**
 * Builds the strict transport-key boundary for prepared TableClient values.
 * Field values are still parsed and authorized by the authoritative xTable
 * mutation services; this schema prevents identities and unknown members from
 * entering the generated-command envelope.
 */
type PreparedMutationValues<
    TEntity extends AnyDB3Entity,
    TDtoSchema extends z.AnyZodObject,
> = DB3SchemaMutationModel<
    DB3SchemaClientModel<z.infer<TDtoSchema>, DB3FieldsOf<SchemaOf<TEntity>>>,
    DB3FieldsOf<SchemaOf<TEntity>>
>;

type PreparedMutationSchema<TValues extends TAnyModel> =
    z.AnyZodObject & z.ZodType<TValues>;

function createPreparedMutationSchema<
    TEntity extends AnyDB3Entity,
    TDtoSchema extends z.AnyZodObject,
>(
    entity: TEntity,
    dtoSchema: TDtoSchema,
    mode: "new" | "update",
): PreparedMutationSchema<PreparedMutationValues<TEntity, TDtoSchema>> {
    const shape: z.ZodRawShape = {};
    const dtoMembers = new Set(Object.keys(dtoSchema.shape));
    for (const field of entity.schema.columns) {
        if (!dtoMembers.has(field.member)
            && (!field.fkidMember || !dtoMembers.has(field.fkidMember))) {
            continue;
        }
        const member = field.fkidMember || field.member;
        if (member === entity.schema.pkMember || member === entity.schema.publicIdMember) {
            continue;
        }
        const transportSchema = field.codec?.writeSchema ?? zod.unknown();
        shape[member] = transportSchema.superRefine((value, context) => {
            // Prepared mutation values have already passed through
            // ApplyClientToDb. Convert them back to the table's client shape
            // before invoking the field's client-value validator.
            const clientModel = entity.schema.getClientModel({ [member]: value }, mode);
            const validation = field.ValidateAndParse({
                row: clientModel,
                mode,
            });
            if (validation.result === "error") {
                context.addIssue({
                    code: zod.ZodIssueCode.custom,
                    message: validation.errorMessage || `Invalid value for ${member}.`,
                });
            }
        }).optional();
    }
    const schema = zod.object(shape).strict();
    // Runtime field discovery cannot retain the keyed xTable map through
    // Object.keys(). PreparedMutationValues derives the same included
    // same-key fields from the concrete entity schema, while the construction
    // above remains authoritative for runtime parsing and authorization.
    return schema as PreparedMutationSchema<PreparedMutationValues<TEntity, TDtoSchema>>;
}

function registerCrudView(view: AnyDB3CrudView): void {
    for (const { command } of getDefinedCrudOperations(view.crud)) {
        const existing = crudViewsByCommandID.get(command.commandID);
        if (existing && existing.viewID !== view.viewID) {
            throw new Error(
                `DB3 CRUD command '${command.commandID}' is already registered by view '${existing.viewID}'.`,
            );
        }
        crudViewsByCommandID.set(command.commandID, view);
    }
}

/**
 * Defines a named read view with generated single-row mutation operations.
 * Update is always supported; create and delete are explicit capabilities.
 * The view's hydrate function explicitly owns DTO-to-client conversion. The
 * linked xTable remains the authority for writable fields, authorization,
 * defaults, and delete policy.
 */
export function defineCrudView<
    TEntity extends AnyDB3Entity,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
    TOperations extends DB3CrudOperationFlags,
    TSelection extends DB3ViewSelectionArgs<TEntity> | undefined = undefined,
>(args: {
    viewID: string;
    entity: TEntity;
    selection?: TSelection | ((context: DB3ViewSelectionContext) => TSelection);
    dtoSchema: TDtoSchema;
    hydrate: (dto: z.infer<TDtoSchema>, references: DB3ReferenceProvider) => TClient;
    operations: TOperations;
}) {
    const viewArgs = {
        viewID: args.viewID,
        entity: args.entity,
        dtoSchema: args.dtoSchema,
        hydrate: args.hydrate,
    };
    type TResolvedSelection = CrudViewSelection<TEntity, TDtoSchema, TSelection>;
    const selection = args.selection === undefined
        ? ZodToPrismaSelection(args.dtoSchema) as TResolvedSelection
        : args.selection;
    const view = defineView({
        ...viewArgs,
        selection: selection as DB3ViewSelectionArgs<TEntity>,
    }) as DB3View<TEntity, TResolvedSelection, TDtoSchema, TClient>;
    const createSchema = createPreparedMutationSchema(args.entity, args.dtoSchema, "new");
    const updateFieldsSchema = createPreparedMutationSchema(args.entity, args.dtoSchema, "update");
    const crud = defineEntityCrudCommands({
        entity: args.entity,
        identitySchema: createIdentitySchema(args.entity),
        operations: args.operations,
        createSchema,
        updateFieldsSchema,
    });
    const crudView = Object.assign(view, { crud }) as DB3CrudView<
        TEntity,
        TResolvedSelection,
        TDtoSchema,
        TClient,
        typeof crud
    >;
    registerCrudView(crudView as unknown as AnyDB3CrudView);
    return crudView;
}

export function getDB3CrudViewForCommand(commandID: string): AnyDB3CrudView | undefined {
    return crudViewsByCommandID.get(commandID);
}
