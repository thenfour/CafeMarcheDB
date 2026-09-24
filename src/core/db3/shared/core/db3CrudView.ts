import type { TAnyModel } from "@/shared/rootroot";
import {
    ZodToPrismaSelection,
} from "@/shared/prismaUtils";
import type { z } from "zod";
import { z as zod } from "zod";
import {
    defineEntityCrudCommands,
    getDefinedCrudOperations,
    type AnyDB3TableEditorCommands,
    type DB3CrudOperationFlags,
} from "./db3EntityCrud";
import type {
    AnyDB3Table,
    DB3FieldsOf,
    DB3IdentityOf,
    DB3SchemaClientModel,
    DB3SchemaMutationModel,
    xTable,
} from "../db3core";
import type { TagsField } from "../columnTypes/tags";
import {
    defineView,
    type DB3View,
    type DB3ViewSelectionArgs,
    type DB3ViewSelectionContext,
    type DB3ViewWhere,
    type DerivedDB3ViewSelection,
} from "./db3View";
import {
    emptyReferenceContract,
    type AnyDB3ReferenceContract,
    type DB3ReferenceProvider,
} from "./db3Hydration";

export interface DB3CrudView<
    TEntity extends AnyDB3Table,
    TSelection,
    TDtoSchema extends z.ZodTypeAny,
    TClient extends TAnyModel,
    TCrud extends AnyDB3TableEditorCommands,
    TReferences extends AnyDB3ReferenceContract = typeof emptyReferenceContract,
> extends DB3View<TEntity, TSelection, TDtoSchema, TClient, TReferences> {
    readonly crud: TCrud;
}

export type AnyDB3CrudView = DB3View<
    AnyDB3Table,
    any,
    z.ZodTypeAny,
    TAnyModel,
    any
> & { readonly crud: AnyDB3TableEditorCommands };

type CrudViewSelection<
    TEntity extends AnyDB3Table,
    TDtoSchema extends z.AnyZodObject,
    TSelection,
> = [TSelection] extends [undefined]
    ? DerivedDB3ViewSelection<TEntity, TDtoSchema>
    : TSelection;

const crudViewsByCommandID = new Map<string, AnyDB3CrudView>();

function createIdentitySchema<TEntity extends AnyDB3Table>(
    entity: TEntity,
): z.ZodType<DB3IdentityOf<TEntity>>;
function createIdentitySchema(entity: xTable): z.ZodTypeAny;
function createIdentitySchema(entity: xTable): z.ZodTypeAny {
    const schema = entity.publicIdMember
        ? zod.string().length(16).regex(/^[A-Za-z0-9_-]+$/)
        : zod.number().int();
    return schema;
}

/**
 * Builds the strict transport-key boundary for prepared TableClient values.
 * Field values are still parsed and authorized by the authoritative xTable
 * mutation services; this schema prevents identities and unknown members from
 * entering the generated-command envelope.
 */
type PreparedMutationValues<
    TEntity extends AnyDB3Table,
    TDtoSchema extends z.AnyZodObject,
> = DB3SchemaMutationModel<
    DB3SchemaClientModel<z.infer<TDtoSchema>, DB3FieldsOf<TEntity>>,
    DB3FieldsOf<TEntity>
>;

type PreparedMutationSchema<TValues extends TAnyModel> =
    z.AnyZodObject & z.ZodType<TValues>;

function createPreparedMutationSchema<
    TEntity extends AnyDB3Table,
    TDtoSchema extends z.AnyZodObject,
>(
    entity: TEntity,
    dtoSchema: TDtoSchema,
    mode: "new" | "update",
): PreparedMutationSchema<PreparedMutationValues<TEntity, TDtoSchema>> {
    const shape: z.ZodRawShape = {};
    const dtoMembers = new Set(Object.keys(dtoSchema.shape));
    for (const field of entity.columns) {
        if (!dtoMembers.has(field.member)
            && (!field.fkidMember || !dtoMembers.has(field.fkidMember))) {
            continue;
        }
        const member = field.fkidMember || field.member;
        if (member === entity.pkMember || member === entity.publicIdMember) {
            continue;
        }
        const transportSchema = field.fieldTableAssociation === "associationRecord"
            ? zod.array(createIdentitySchema(
                // The runtime discriminator above is the TagsField contract.
                (field as TagsField<TAnyModel>).getForeignTableShema(),
            ))
            : field.codec?.writeSchema ?? zod.unknown();
        shape[member] = transportSchema.superRefine((value, context) => {
            // Prepared mutation values have already passed through
            // ApplyClientToDb. Convert them back to the table's client shape
            // before invoking the field's client-value validator.
            const clientModel = entity.getClientModel({ [member]: value }, mode);
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
    TEntity extends AnyDB3Table,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
    TOperations extends DB3CrudOperationFlags,
    TSelection extends DB3ViewSelectionArgs<TEntity> | undefined = undefined,
    TReferences extends AnyDB3ReferenceContract = typeof emptyReferenceContract,
>(args: {
    viewID: string;
    entity: TEntity;
    selection?: TSelection | ((context: DB3ViewSelectionContext) => TSelection);
    where?: DB3ViewWhere<TEntity> | ((context: DB3ViewSelectionContext) => DB3ViewWhere<TEntity>);
    dtoSchema: TDtoSchema;
    references?: TReferences;
    hydrate: (
        dto: z.infer<TDtoSchema>,
        references: DB3ReferenceProvider<TReferences>,
    ) => TClient;
    operations: TOperations;
}) {
    const viewArgs = {
        viewID: args.viewID,
        entity: args.entity,
        dtoSchema: args.dtoSchema,
        references: args.references,
        where: args.where,
        hydrate: args.hydrate,
    };
    type TResolvedSelection = CrudViewSelection<TEntity, TDtoSchema, TSelection>;
    const selection = args.selection === undefined
        ? ZodToPrismaSelection(args.dtoSchema) as TResolvedSelection
        : args.selection;
    const view = defineView({
        ...viewArgs,
        selection: selection as DB3ViewSelectionArgs<TEntity>,
    }) as DB3View<TEntity, TResolvedSelection, TDtoSchema, TClient, TReferences>;
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
        typeof crud,
        TReferences
    >;
    registerCrudView(crudView as unknown as AnyDB3CrudView);
    return crudView;
}

export function getDB3CrudViewForCommand(commandID: string): AnyDB3CrudView | undefined {
    return crudViewsByCommandID.get(commandID);
}
