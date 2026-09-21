import type { TAnyModel } from "@/shared/rootroot";
import type { z } from "zod";
import { z as zod } from "zod";
import {
    defineEntityCreateUpdateCommands,
    defineEntityCrudCommands,
    defineEntityUpdateDeleteCommands,
    hasGeneratedCreateCommand,
    hasGeneratedDeleteCommand,
    type AnyDB3EntityEditorCommands,
} from "./db3EntityCrud";
import type { AnyDB3Entity, EntityIdOf } from "./db3Entity";
import {
    defineView,
    type DB3View,
    type DB3ViewSelectionContext,
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
 * Compatibility bridge for xTable fields whose client value differs from the
 * database/DTO value. CRUD views still use the table schema's established
 * conversion contract while entities migrate to explicitly typed hydration.
 */
function applyTableSchemaDbToClient<TModel extends TAnyModel>(
    entity: AnyDB3Entity,
    model: TModel,
    mode: "view" | "new" | "update",
): TModel {
    return entity.schema.getClientModel(model, mode) as TModel;
}

/**
 * Builds the strict transport-key boundary for prepared TableClient values.
 * Field values are still parsed and authorized by the authoritative xTable
 * mutation services; this schema prevents identities and unknown members from
 * entering the generated-command envelope.
 */
function createPreparedMutationSchema(
    entity: AnyDB3Entity,
    dtoSchema: z.AnyZodObject,
    mode: "new" | "update",
): z.AnyZodObject {
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
        shape[member] = zod.unknown().superRefine((value, context) => {
            // Prepared mutation values have already passed through
            // ApplyClientToDb. Convert them back to the table's client shape
            // before invoking the field's client-value validator.
            const clientModel = applyTableSchemaDbToClient(
                entity,
                { [member]: value },
                mode,
            );
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
    return zod.object(shape).strict();
}

function registerCrudView(view: AnyDB3CrudView): void {
    const commands = [
        view.crud.updateCommand,
        ...(hasGeneratedCreateCommand(view.crud) ? [view.crud.createCommand] : []),
        ...(hasGeneratedDeleteCommand(view.crud) ? [view.crud.deleteCommand] : []),
    ];
    for (const command of commands) {
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
 * Defines a named read view with generated single-row create/update/delete
 * commands. The linked xTable remains the authority for writable fields,
 * transformation, authorization, defaults, and delete policy.
 */
export function defineCrudView<
    TEntity extends AnyDB3Entity,
    TSelection,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
>(args: {
    viewID: string;
    entity: TEntity;
    selection: TSelection | ((context: DB3ViewSelectionContext) => TSelection);
    dtoSchema: TDtoSchema;
    hydrate: (dto: z.infer<TDtoSchema>, references: DB3ReferenceProvider) => TClient;
}) {
    const view = defineView({
        ...args,
        hydrate: (dto, references) => args.hydrate(
            applyTableSchemaDbToClient(args.entity, dto, "view"),
            references,
        ),
    });
    const createSchema = createPreparedMutationSchema(args.entity, args.dtoSchema, "new");
    const updateFieldsSchema = createPreparedMutationSchema(args.entity, args.dtoSchema, "update");
    const crud = defineEntityCrudCommands({
        entity: args.entity,
        identitySchema: createIdentitySchema(args.entity),
        createSchema,
        updateFieldsSchema,
    });
    const crudView = Object.assign(view, { crud }) as DB3CrudView<
        TEntity,
        TSelection,
        TDtoSchema,
        TClient,
        typeof crud
    >;
    registerCrudView(crudView as unknown as AnyDB3CrudView);
    return crudView;
}

/**
 * same as crud view, but without delete.
 * 
 * TODO: unify with defineCrudView to reduce code duplication.
 */
export function defineCreateUpdateView<
    TEntity extends AnyDB3Entity,
    TSelection,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
>(args: {
    viewID: string;
    entity: TEntity;
    selection: TSelection | ((context: DB3ViewSelectionContext) => TSelection);
    dtoSchema: TDtoSchema;
    hydrate: (dto: z.infer<TDtoSchema>, references: DB3ReferenceProvider) => TClient;
}) {
    if (args.entity.schema.deletePolicy !== "disabled") {
        // well, we *could* allow this; if a client view wants to restrict deletion go ahead.
        // but this is mostly a sanity check because you can still define a full CRUD view
        // and just not expose the delete command.
        throw new Error(
            `${args.entity.entityID} permits deletion; define a full CRUD view instead.`,
        );
    }
    const view = defineView({
        ...args,
        hydrate: (dto, references) => args.hydrate(
            applyTableSchemaDbToClient(args.entity, dto, "view"),
            references,
        ),
    });
    const createSchema = createPreparedMutationSchema(args.entity, args.dtoSchema, "new");
    const updateFieldsSchema = createPreparedMutationSchema(args.entity, args.dtoSchema, "update");
    const crud = defineEntityCreateUpdateCommands({
        entity: args.entity,
        identitySchema: createIdentitySchema(args.entity),
        createSchema,
        updateFieldsSchema,
    });
    const crudView = Object.assign(view, { crud }) as DB3CrudView<
        TEntity,
        TSelection,
        TDtoSchema,
        TClient,
        typeof crud
    >;
    registerCrudView(crudView as unknown as AnyDB3CrudView);
    return crudView;
}

/**
 * Defines a named editor view whose entity can be updated and deleted, while
 * creation remains owned by a separate workflow (for example file upload).
 */
export function defineUpdateDeleteView<
    TEntity extends AnyDB3Entity,
    TSelection,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
>(args: {
    viewID: string;
    entity: TEntity;
    selection: TSelection | ((context: DB3ViewSelectionContext) => TSelection);
    dtoSchema: TDtoSchema;
    hydrate: (dto: z.infer<TDtoSchema>, references: DB3ReferenceProvider) => TClient;
    getIdentity: (client: TClient) => EntityIdOf<TEntity>;
}) {
    if (args.entity.schema.deletePolicy === "disabled") {
        throw new Error(
            `${args.entity.entityID} does not permit deletion; define a create/update view instead.`,
        );
    }
    const view = defineView({
        ...args,
        hydrate: (dto, references) => args.hydrate(
            applyTableSchemaDbToClient(args.entity, dto, "view"),
            references,
        ),
    });
    const updateFieldsSchema = createPreparedMutationSchema(args.entity, args.dtoSchema, "update");
    const crud = defineEntityUpdateDeleteCommands({
        entity: args.entity,
        identitySchema: createIdentitySchema(args.entity),
        updateFieldsSchema,
    });
    const crudView = Object.assign(view, { crud }) as DB3CrudView<
        TEntity,
        TSelection,
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
