import type { TAnyModel } from "@/shared/rootroot";
import type { Prisma } from "db";
import { z } from "zod";
import {
    type DB3FieldsOf,
    GetTableById,
    type AnyDB3Field,
    type DB3PrismaMemberOwnership,
    type DB3ReadPresenceOf,
    type DB3ReadTransportValueOf,
    type xTable,
} from "../db3core";
import type {
    AnyDB3Entity,
    PrismaDelegateOf,
    SchemaOf,
} from "./db3Entity";
import type { DB3ViewSelectionArgs } from "./db3View";

type ArrayItem<TValue> = TValue extends readonly (infer TItem)[] ? TItem : never;

type DB3SelectionSelect<TSelection> = TSelection extends {
    readonly select?: infer TSelect;
} ? NonNullable<TSelect> : never;

type DB3SelectedKeys<TSelect> = Extract<{
    [TKey in keyof TSelect]-?: TSelect[TKey] extends false | null | undefined
    ? never
    : TKey;
}[keyof TSelect], string>;

type DB3NestedSelect<TMemberSelection> = TMemberSelection extends {
    readonly select?: infer TSelect;
} ? NonNullable<TSelect> : never;

type DB3NestedDto<
    TPayload,
    TSelect,
> = {
    [TKey in Extract<DB3SelectedKeys<TSelect>, keyof TPayload>]?:
    DB3SelectedPayloadValue<TPayload[TKey], TSelect[TKey]>;
};

type DB3NestedRelationValue<
    TPayloadValue,
    TNestedSelect,
> = TPayloadValue extends null | undefined
    ? TPayloadValue
    : TPayloadValue extends readonly (infer TItem)[]
    ? DB3NestedDto<TItem, TNestedSelect>[]
    : TPayloadValue extends object
    ? DB3NestedDto<TPayloadValue, TNestedSelect>
    : TPayloadValue;

type DB3SelectedPayloadValue<
    TPayloadValue,
    TMemberSelection,
> = TMemberSelection extends true
    ? TPayloadValue
    : DB3NestedSelect<TMemberSelection> extends never
    ? TPayloadValue
    : DB3NestedRelationValue<TPayloadValue, DB3NestedSelect<TMemberSelection>>;

type DB3PrismaPayload<
    TEntity extends AnyDB3Entity,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
> = ArrayItem<Prisma.Result<
    PrismaDelegateOf<TEntity>,
    TSelection,
    "findMany"
>>;

type DB3RootMemberValue<
    TEntity extends AnyDB3Entity,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TKey extends string,
    TSelect = DB3SelectionSelect<TSelection>,
    TPayload = DB3PrismaPayload<TEntity, TSelection>,
    TFields = DB3FieldsOf<SchemaOf<TEntity>>,
> = TKey extends keyof TPayload
    ? TKey extends keyof TSelect
    ? TSelect[TKey] extends true
    ? TKey extends keyof TFields
    ? DB3ReadTransportValueOf<TFields[TKey]>
    : TPayload[TKey]
    : DB3SelectedPayloadValue<TPayload[TKey], TSelect[TKey]>
    : never
    : never;

type DB3RequiredRootKeys<
    TEntity extends AnyDB3Entity,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TSelect = DB3SelectionSelect<TSelection>,
    TFields = DB3FieldsOf<SchemaOf<TEntity>>,
> = {
    [TKey in DB3SelectedKeys<TSelect>]: TKey extends keyof TFields
    ? DB3ReadPresenceOf<TFields[TKey]> extends "required"
    ? TKey
    : never
    : never;
}[DB3SelectedKeys<TSelect>];

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] };

/** The statically known DTO output for an entity and explicit Prisma selection. */
export type DB3DtoForSelection<
    TEntity extends AnyDB3Entity,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TSelectedKey extends string = DB3SelectedKeys<DB3SelectionSelect<TSelection>>,
    TRequiredKey extends string = DB3RequiredRootKeys<TEntity, TSelection>,
> = Simplify<{
    [TKey in Extract<TSelectedKey, TRequiredKey>]:
    DB3RootMemberValue<TEntity, TSelection, TKey>;
} & {
    [TKey in Exclude<TSelectedKey, TRequiredKey>]?:
    DB3RootMemberValue<TEntity, TSelection, TKey>;
}>;

/** A runtime Zod object whose inferred output is the selection-derived DTO. */
export type DB3DerivedDtoSchema<
    TEntity extends AnyDB3Entity,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
> = z.ZodObject<
    z.ZodRawShape,
    "strip",
    z.ZodTypeAny,
    DB3DtoForSelection<TEntity, TSelection>,
    DB3DtoForSelection<TEntity, TSelection>
>;

interface DB3CompiledMemberBase {
    readonly member: string;
    readonly selectionPath: string;
    readonly field: AnyDB3Field;
    readonly schema: z.ZodTypeAny;
    readonly required: boolean;
}

export interface DB3CompiledValueMember extends DB3CompiledMemberBase {
    readonly kind: "value";
    readonly ownershipKind: "field" | "foreignKey";
}

export interface DB3CompiledRelationMember extends DB3CompiledMemberBase {
    readonly kind: "relation";
    readonly ownershipKind: "foreignObject" | "relationCollection";
    readonly cardinality: "one" | "many";
    readonly targetTable: xTable;
    readonly members: readonly DB3CompiledMember[];
}

export type DB3CompiledMember = DB3CompiledValueMember | DB3CompiledRelationMember;

export interface DB3CompiledSelection<
    TEntity extends AnyDB3Entity,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
> {
    readonly prismaSelection: TSelection;
    readonly dtoSchema: DB3DerivedDtoSchema<TEntity, TSelection>;
    readonly members: readonly DB3CompiledMember[];
}

function selectionError(
    entity: AnyDB3Entity,
    selectionPath: string,
    reason: string,
): Error {
    return new Error(
        `DB3 entity '${entity.entityID}' cannot compile selection path `
        + `'${selectionPath}': ${reason}`,
    );
}

function getExplicitSelect(
    entity: AnyDB3Entity,
    args: TAnyModel,
    argsPath: string,
): TAnyModel {
    if (args.include !== undefined) {
        throw selectionError(
            entity,
            `${argsPath}.include`,
            "selection derivation currently supports explicit 'select' shapes only.",
        );
    }

    const select = args.select;
    if (!select || typeof select !== "object" || Array.isArray(select)) {
        throw selectionError(
            entity,
            `${argsPath}.select`,
            "expected an explicit Prisma select object.",
        );
    }
    return select;
}

function applyReadPresence(
    field: AnyDB3Field,
    schema: z.ZodTypeAny,
): { schema: z.ZodTypeAny; required: boolean } {
    const required = field.isReadRequiredAfterRowAuth();
    return {
        required,
        schema: required ? schema : schema.optional(),
    };
}

function unsupportedMemberKind(ownership: never): never {
    throw new Error(`Unsupported DB3 Prisma-member ownership '${String(ownership)}'.`);
}

function compileSelect(
    entity: AnyDB3Entity,
    table: xTable,
    select: TAnyModel,
    selectPath: string,
): { dtoSchema: z.AnyZodObject; members: readonly DB3CompiledMember[] } {
    const shape: Record<string, z.ZodTypeAny> = {};
    const members: DB3CompiledMember[] = [];

    for (const [member, memberSelection] of Object.entries(select)) {
        if (memberSelection === false || memberSelection === undefined) continue;

        const selectionPath = `${selectPath}.${member}`;
        let ownership: DB3PrismaMemberOwnership;
        try {
            ownership = table.resolvePrismaMember(member, selectionPath);
        } catch (cause) {
            throw selectionError(
                entity,
                selectionPath,
                cause instanceof Error ? cause.message : String(cause),
            );
        }

        const fieldClass = ownership.field.constructor.name;
        switch (ownership.kind) {
            case "field":
            case "foreignKey": {
                if (memberSelection !== true) {
                    throw selectionError(
                        entity,
                        selectionPath,
                        `${fieldClass} field '${ownership.field.member}' uses an unsupported `
                        + "non-scalar selection shape.",
                    );
                }
                if (!ownership.readTransportSchema) {
                    throw selectionError(
                        entity,
                        selectionPath,
                        `${fieldClass} field '${ownership.field.member}' does not declare `
                        + `a read transport schema for its ${ownership.kind} member '${member}'.`,
                    );
                }

                const presence = applyReadPresence(
                    ownership.field,
                    ownership.readTransportSchema,
                );
                shape[member] = presence.schema;
                members.push({
                    kind: "value",
                    ownershipKind: ownership.kind,
                    member,
                    selectionPath,
                    field: ownership.field,
                    schema: presence.schema,
                    required: presence.required,
                });
                break;
            }

            case "foreignObject":
            case "relationCollection": {
                if (!memberSelection || typeof memberSelection !== "object"
                    || Array.isArray(memberSelection)) {
                    throw selectionError(
                        entity,
                        selectionPath,
                        `${fieldClass} field '${ownership.field.member}' requires relation `
                        + "arguments with an explicit nested select.",
                    );
                }

                const nestedSelect = getExplicitSelect(
                    entity,
                    memberSelection,
                    selectionPath,
                );
                const targetTable = GetTableById(ownership.targetTableID);
                const nested = compileSelect(
                    entity,
                    targetTable,
                    nestedSelect,
                    `${selectionPath}.select`,
                );
                let relationSchema: z.ZodTypeAny = ownership.kind === "relationCollection"
                    ? z.array(nested.dtoSchema)
                    : nested.dtoSchema;
                if (ownership.kind === "foreignObject" && ownership.nullable) {
                    relationSchema = relationSchema.nullable();
                }
                const presence = applyReadPresence(ownership.field, relationSchema);
                shape[member] = presence.schema;
                members.push({
                    kind: "relation",
                    ownershipKind: ownership.kind,
                    cardinality: ownership.kind === "relationCollection" ? "many" : "one",
                    member,
                    selectionPath,
                    field: ownership.field,
                    schema: presence.schema,
                    required: presence.required,
                    targetTable,
                    members: nested.members,
                });
                break;
            }

            default:
                unsupportedMemberKind(ownership);
        }
    }

    return {
        dtoSchema: z.object(shape),
        members,
    };
}

/**
 * Compiles the supported subset of an explicit Prisma selection. Shape-neutral
 * relation arguments such as where/orderBy/pagination remain untouched; only
 * each level's select object contributes to the DTO schema.
 */
export function compileDB3Selection<
    TEntity extends AnyDB3Entity,
    const TSelection extends DB3ViewSelectionArgs<TEntity>,
>(
    entity: TEntity,
    selection: TSelection,
): DB3CompiledSelection<TEntity, TSelection> {
    const selectionValue = selection as TAnyModel;
    const select = getExplicitSelect(entity, selectionValue, entity.entityID);
    const compiled = compileSelect(
        entity,
        entity.schema,
        select,
        `${entity.entityID}.select`,
    );

    return {
        prismaSelection: selection,
        dtoSchema: compiled.dtoSchema as DB3DerivedDtoSchema<TEntity, TSelection>,
        members: compiled.members,
    };
}

/** Derives the validated DTO schema for an explicit Prisma selection. */
export function deriveDtoSchema<
    TEntity extends AnyDB3Entity,
    const TSelection extends DB3ViewSelectionArgs<TEntity>,
>(
    entity: TEntity,
    selection: TSelection,
): DB3DerivedDtoSchema<TEntity, TSelection> {
    return compileDB3Selection(entity, selection).dtoSchema;
}
