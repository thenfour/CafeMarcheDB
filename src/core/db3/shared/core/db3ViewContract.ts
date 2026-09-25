import type { TAnyModel } from "@/shared/rootroot";
import type { Prisma } from "db";
import { z } from "zod";
import {
    type DB3FieldsOf,
    type DB3ForeignKeyMemberOf,
    type DB3ForeignSingleReferenceField,
    type DB3IdentityOf,
    type AnyDB3Field,
    type DB3PrismaMemberOwnership,
    type DB3ReadConsumerValueOf,
    type DB3ReadPresenceOf,
    type DB3ReadTransportValueOf,
    type DB3RelationTargetTableOf,
    type AnyDB3Table,
    type DB3PrismaDelegateOf,
    type xTable,
} from "../db3core";
import {
    emptyReferenceContract,
    type AnyDB3ReferenceContract,
    type DB3ReferenceProvider,
    type DB3ReferenceValueOf,
} from "./db3Hydration";
import type { DB3ViewSelectionArgs } from "./db3View";
import { prepareDB3ReadSelection } from "./db3ReadSelection";

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

type DB3ForeignFieldForMember<
    TFields,
    TMember extends PropertyKey,
> = {
    [TFieldMember in keyof TFields]:
    DB3ForeignKeyMemberOf<TFields[TFieldMember]> extends infer TForeignKeyMember
    ? TForeignKeyMember extends string
    ? string extends TForeignKeyMember
    ? never
    : TMember extends TForeignKeyMember
    ? TFields[TFieldMember]
    : never
    : never
    : never;
}[keyof TFields];

type DB3FieldForMember<
    TFields,
    TMember extends PropertyKey,
> = TMember extends keyof TFields
    ? TFields[TMember]
    : DB3ForeignFieldForMember<TFields, TMember>;

type DB3ForeignKeyTransportValue<TPayloadValue, TField> =
    [DB3RelationTargetTableOf<TField>] extends [never]
    ? TPayloadValue
    : DB3IdentityOf<Extract<DB3RelationTargetTableOf<TField>, xTable>>
    | Extract<TPayloadValue, null | undefined>;

type DB3ScalarDtoValue<
    TPayloadValue,
    TFields,
    TKey extends PropertyKey,
    TField = DB3FieldForMember<TFields, TKey>,
> = TKey extends keyof TFields
    ? DB3ReadTransportValueOf<TField>
    : [TField] extends [never]
    ? TPayloadValue
    : DB3ForeignKeyTransportValue<TPayloadValue, TField>;

type DB3NestedRelationValue<
    TPayloadValue,
    TNestedSelect,
    TField,
    TTargetTable extends xTable = Extract<DB3RelationTargetTableOf<TField>, xTable>,
> = TField extends DB3ForeignSingleReferenceField<any, any, infer TAllowNull>
    ? TAllowNull extends false
    ? DB3NestedDto<NonNullable<TPayloadValue>, TNestedSelect, TTargetTable>
    : TPayloadValue extends null | undefined
    ? TPayloadValue
    : DB3NestedDto<TPayloadValue, TNestedSelect, TTargetTable>
    : TPayloadValue extends readonly (infer TItem)[]
    ? DB3NestedDto<TItem, TNestedSelect, TTargetTable>[]
    : TPayloadValue extends object
    ? DB3NestedDto<TPayloadValue, TNestedSelect, TTargetTable>
    : TPayloadValue;

type DB3SelectedMemberValue<
    TPayload,
    TSelect,
    TTable extends xTable,
    TKey extends keyof TPayload & keyof TSelect,
    TFields = DB3FieldsOf<TTable>,
    TField = DB3FieldForMember<TFields, TKey>,
> = TSelect[TKey] extends true
    ? DB3ScalarDtoValue<TPayload[TKey], TFields, TKey, TField>
    : DB3NestedSelect<TSelect[TKey]> extends never
    ? TPayload[TKey]
    : DB3NestedRelationValue<
        TPayload[TKey],
        DB3NestedSelect<TSelect[TKey]>,
        TField
    >;

type DB3RequiredSelectedKeys<
    TTable extends xTable,
    TSelect,
    TFields = DB3FieldsOf<TTable>,
> = {
    [TKey in DB3SelectedKeys<TSelect>]:
    DB3ReadPresenceOf<DB3FieldForMember<TFields, TKey>> extends "required"
    ? TKey
    : never
}[DB3SelectedKeys<TSelect>];

type DB3NestedDto<
    TPayload,
    TSelect,
    TTable extends xTable,
    TSelectedKey extends keyof TPayload & keyof TSelect = Extract<
        DB3SelectedKeys<TSelect>,
        keyof TPayload & keyof TSelect
    >,
    TRequiredKey extends TSelectedKey = Extract<
        DB3RequiredSelectedKeys<TTable, TSelect>,
        TSelectedKey
    >,
> = Simplify<{
    [TKey in Extract<TSelectedKey, TRequiredKey>]-?:
    DB3SelectedMemberValue<TPayload, TSelect, TTable, TKey>;
} & {
    [TKey in Exclude<TSelectedKey, TRequiredKey>]?:
    DB3SelectedMemberValue<TPayload, TSelect, TTable, TKey>;
}>;

type DB3PrismaPayload<
    TEntity extends AnyDB3Table,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
> = ArrayItem<Prisma.Result<
    DB3PrismaDelegateOf<TEntity>,
    TSelection,
    "findMany"
>>;

type DB3RootMemberValue<
    TEntity extends AnyDB3Table,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TKey extends string,
    TSelect = DB3SelectionSelect<TSelection>,
    TPayload = DB3PrismaPayload<TEntity, TSelection>,
> = TKey extends keyof TPayload
    ? TKey extends keyof TSelect
    ? DB3SelectedMemberValue<TPayload, TSelect, TEntity, TKey>
    : never
    : never;

type DB3RequiredRootKeys<
    TEntity extends AnyDB3Table,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TSelect = DB3SelectionSelect<TSelection>,
> = DB3RequiredSelectedKeys<TEntity, TSelect>;

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] };

/** The statically known DTO output for an entity and explicit Prisma selection. */
export type DB3DtoForSelection<
    TEntity extends AnyDB3Table,
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
    TEntity extends AnyDB3Table,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
> = z.ZodObject<
    z.ZodRawShape,
    "strip",
    z.ZodTypeAny,
    DB3DtoForSelection<TEntity, TSelection>,
    DB3DtoForSelection<TEntity, TSelection>
>;

type DB3ScalarClientValue<TSourceValue, TField> =
    Exclude<TSourceValue, undefined> extends DB3ReadTransportValueOf<TField>
    ? DB3ReadConsumerValueOf<TField> | Extract<TSourceValue, undefined>
    : TSourceValue;

type DB3RelationClientValue<
    TSourceValue,
    TTargetTable extends xTable,
    TReferences extends AnyDB3ReferenceContract,
> = TSourceValue extends null | undefined
    ? TSourceValue
    : TSourceValue extends readonly (infer TItem)[]
    ? DB3ClientModelForTable<TItem, TTargetTable, TReferences>[]
    : TSourceValue extends object
    ? DB3ClientModelForTable<TSourceValue, TTargetTable, TReferences>
    : TSourceValue;

type DB3FieldClientValue<
    TSourceValue,
    TField,
    TReferences extends AnyDB3ReferenceContract,
> =
    [DB3RelationTargetTableOf<TField>] extends [never]
    ? DB3ScalarClientValue<TSourceValue, TField>
    : DB3RelationClientValue<
        TSourceValue,
        Extract<DB3RelationTargetTableOf<TField>, xTable>,
        TReferences
    >;

type DB3NormalizedReferenceFieldKeys<
    TDto,
    TFields,
    TReferences extends AnyDB3ReferenceContract,
> = Extract<{
    [TFieldMember in keyof TFields]:
    TFields[TFieldMember] extends DB3ForeignSingleReferenceField<any, infer TForeignKeyMember, any>
    ? string extends TForeignKeyMember
    ? never
    : [DB3ReferenceValueOf<
        TReferences,
        Extract<DB3RelationTargetTableOf<TFields[TFieldMember]>, AnyDB3Table>
    >] extends [never]
    ? never
    : TForeignKeyMember extends keyof TDto
    ? TFieldMember extends keyof TDto
    ? never
    : TFieldMember
    : never
    : never;
}[keyof TFields], keyof TFields>;

type DB3NormalizedReferenceValue<
    TDto,
    TField,
    TReferences extends AnyDB3ReferenceContract,
> =
    TField extends DB3ForeignSingleReferenceField<any, infer TForeignKeyMember, any>
    ? TForeignKeyMember extends keyof TDto
    ? DB3ReferenceValueOf<
        TReferences,
        Extract<DB3RelationTargetTableOf<TField>, AnyDB3Table>
    >
    | Extract<TDto[TForeignKeyMember], null | undefined>
    : never
    : never;

type DB3RequiredNormalizedReferenceKeys<
    TDto,
    TFields,
    TReferences extends AnyDB3ReferenceContract,
    TReferenceKey extends keyof TFields = DB3NormalizedReferenceFieldKeys<
        TDto,
        TFields,
        TReferences
    >,
> = {
    [TKey in TReferenceKey]:
    TFields[TKey] extends DB3ForeignSingleReferenceField<any, infer TForeignKeyMember, any>
    ? TForeignKeyMember extends keyof TDto
    ? undefined extends TDto[TForeignKeyMember]
    ? never
    : TKey
    : never
    : never;
}[TReferenceKey];

type DB3NormalizedReferenceProperties<
    TDto,
    TFields,
    TReferences extends AnyDB3ReferenceContract,
    TReferenceKey extends keyof TFields = DB3NormalizedReferenceFieldKeys<
        TDto,
        TFields,
        TReferences
    >,
    TRequiredKey extends keyof TFields = DB3RequiredNormalizedReferenceKeys<
        TDto,
        TFields,
        TReferences
    >,
> = {
    [TKey in Extract<TReferenceKey, TRequiredKey>]-?:
    DB3NormalizedReferenceValue<TDto, TFields[TKey], TReferences>;
} & {
        [TKey in Exclude<TReferenceKey, TRequiredKey>]?:
        DB3NormalizedReferenceValue<TDto, TFields[TKey], TReferences>;
    };

type DB3ClientModelForTable<
    TDto,
    TTable extends xTable,
    TReferences extends AnyDB3ReferenceContract,
    TFields = DB3FieldsOf<TTable>,
> = string extends keyof TFields
    ? { [TKey in keyof TDto]: unknown }
    : Simplify<{
        [TKey in keyof TDto]: TKey extends keyof TFields
        ? DB3FieldClientValue<TDto[TKey], TFields[TKey], TReferences>
        : TDto[TKey];
    } & DB3NormalizedReferenceProperties<TDto, TFields, TReferences>>;

/** The default consumer model after recursively applying selected field codecs. */
export type DB3ClientForSelection<
    TEntity extends AnyDB3Table,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TReferences extends AnyDB3ReferenceContract = typeof emptyReferenceContract,
> = DB3ClientModelForTable<
    DB3DtoForSelection<TEntity, TSelection>,
    TEntity,
    TReferences
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
    readonly referenceDependency?: DB3ReferenceDependency;
}

export interface DB3ReferenceDependency {
    readonly sourceTable: xTable;
    readonly targetTable: AnyDB3Table;
    readonly foreignKeyMember: string;
    readonly relationMember: string;
    readonly selectionPath: string;
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
    TEntity extends AnyDB3Table,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
> {
    readonly prismaSelection: TSelection;
    readonly dtoSchema: DB3DerivedDtoSchema<TEntity, TSelection>;
    readonly members: readonly DB3CompiledMember[];
    readonly referenceDependencies: readonly DB3ReferenceDependency[];
}

export interface DB3ViewContract<
    TEntity extends AnyDB3Table,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TTransportSelection extends DB3ViewSelectionArgs<TEntity> = TSelection,
    TReferences extends AnyDB3ReferenceContract = typeof emptyReferenceContract,
> {
    readonly prismaSelection: TSelection;
    readonly dtoSchema: DB3DerivedDtoSchema<TEntity, TTransportSelection>;
    readonly members: readonly DB3CompiledMember[];
    readonly referenceDependencies: readonly DB3ReferenceDependency[];
    readonly referenceContract: TReferences;
    readonly hydrate: (
        dto: DB3DtoForSelection<TEntity, TTransportSelection>,
        references: DB3ReferenceProvider<TReferences>,
    ) => DB3ClientForSelection<TEntity, TTransportSelection, TReferences>;
}

function selectionError(
    entity: AnyDB3Table,
    selectionPath: string,
    reason: string,
): Error {
    return new Error(
        `DB3 table '${entity.tableID}' cannot compile selection path `
        + `'${selectionPath}': ${reason}`,
    );
}

function getExplicitSelect(
    entity: AnyDB3Table,
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

function assertTransportSelectionIsFetched(
    entity: AnyDB3Table,
    prismaArgs: TAnyModel,
    transportArgs: TAnyModel,
    argsPath: string,
): void {
    const prismaSelect = getExplicitSelect(entity, prismaArgs, argsPath);
    const transportSelect = getExplicitSelect(entity, transportArgs, `${argsPath}.transport`);

    for (const [member, transportMemberSelection] of Object.entries(transportSelect)) {
        if (transportMemberSelection === false || transportMemberSelection === undefined) continue;

        const selectionPath = `${argsPath}.select.${member}`;
        const prismaMemberSelection = prismaSelect[member];
        if (prismaMemberSelection === false
            || prismaMemberSelection === null
            || prismaMemberSelection === undefined) {
            throw selectionError(
                entity,
                selectionPath,
                "transport selection member is not fetched by the Prisma selection.",
            );
        }

        if (transportMemberSelection === true) {
            if (prismaMemberSelection !== true) {
                throw selectionError(
                    entity,
                    selectionPath,
                    "transport scalar selection does not match the Prisma selection shape.",
                );
            }
            continue;
        }

        if (!transportMemberSelection || typeof transportMemberSelection !== "object"
            || Array.isArray(transportMemberSelection)
            || !prismaMemberSelection || typeof prismaMemberSelection !== "object"
            || Array.isArray(prismaMemberSelection)) {
            throw selectionError(
                entity,
                selectionPath,
                "transport relation selection does not match the Prisma selection shape.",
            );
        }

        assertTransportSelectionIsFetched(
            entity,
            prismaMemberSelection,
            transportMemberSelection,
            selectionPath,
        );
    }
}


// private selection enrichment which adds foreign ref public ID selections automatically.
// for example if a view wants:
// {
//   select: {
//     caption: true,
//     visiblePermissionId: true,
//   },
// }
// visiblePermissionId is the numeric fk used internally by the database.
// but cilent-facing DTO needs to convert that to the string publicId.
// this adds the necessary server-only selections to ensure the public ID is included.
// the above becomes:
// {
//   select: {
//     caption: true,
//     visiblePermissionId: true,
//     visiblePermission: {
//       select: {
//         publicId: true,
//       },
//     },
//   },
// }
// the pipeline is:
// Prisma result
//   { visiblePermissionId: 42,
//     visiblePermission: { publicId: "AbCd..." } }
//
// projectDB3ModelPublicIds ->
//   { visiblePermissionId: "AbCd...",
//     visiblePermission: { publicId: "AbCd..." } }
//
// view's parse DTO:
//   { visiblePermissionId: "AbCd..." }
function addPublicIdentityProjectionSelections(
    entity: AnyDB3Table,
    table: xTable,
    prismaArgs: TAnyModel,
    transportArgs: TAnyModel,
    argsPath: string,
): TAnyModel {
    const prismaSelect = getExplicitSelect(entity, prismaArgs, argsPath);
    const transportSelect = getExplicitSelect(entity, transportArgs, `${argsPath}.transport`);
    let enrichedSelect = prismaSelect;

    const setSelectionMember = (member: string, selection: unknown) => {
        if (enrichedSelect === prismaSelect) enrichedSelect = { ...prismaSelect };
        enrichedSelect[member] = selection;
    };

    for (const [member, transportMemberSelection] of Object.entries(transportSelect)) {
        if (transportMemberSelection === false || transportMemberSelection === undefined) continue;

        const selectionPath = `${argsPath}.select.${member}`;
        const ownership = table.resolvePrismaMember(member, selectionPath);
        if (ownership.kind === "foreignKey") {
            const targetTable = ownership.getTargetTable();
            if (!targetTable.publicIdMember) continue;

            const relationMember = ownership.relationMember;
            const currentRelationSelection = enrichedSelect[relationMember];
            if (currentRelationSelection === true) continue;

            if (!currentRelationSelection
                || typeof currentRelationSelection !== "object"
                || Array.isArray(currentRelationSelection)) {
                setSelectionMember(relationMember, {
                    select: { [targetTable.publicIdMember]: true },
                });
                continue;
            }

            const currentRelationSelect = getExplicitSelect(
                entity,
                currentRelationSelection,
                `${argsPath}.select.${relationMember}`,
            );
            if (currentRelationSelect[targetTable.publicIdMember] !== true) {
                setSelectionMember(relationMember, {
                    ...currentRelationSelection,
                    select: {
                        ...currentRelationSelect,
                        [targetTable.publicIdMember]: true,
                    },
                });
            }
            continue;
        }

        if ((ownership.kind === "foreignObject" || ownership.kind === "relationCollection")
            && transportMemberSelection
            && typeof transportMemberSelection === "object"
            && !Array.isArray(transportMemberSelection)) {
            const prismaMemberSelection = enrichedSelect[member];
            if (!prismaMemberSelection
                || typeof prismaMemberSelection !== "object"
                || Array.isArray(prismaMemberSelection)) {
                continue;
            }
            const enrichedMemberSelection = addPublicIdentityProjectionSelections(
                entity,
                ownership.getTargetTable(),
                prismaMemberSelection,
                transportMemberSelection,
                selectionPath,
            );
            if (enrichedMemberSelection !== prismaMemberSelection) {
                setSelectionMember(member, enrichedMemberSelection);
            }
        }
    }

    return enrichedSelect === prismaSelect
        ? prismaArgs
        : { ...prismaArgs, select: enrichedSelect };
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
    entity: AnyDB3Table,
    table: xTable,
    select: TAnyModel,
    selectPath: string,
    referenceContract: AnyDB3ReferenceContract,
): {
    dtoSchema: z.AnyZodObject;
    members: readonly DB3CompiledMember[];
    referenceDependencies: readonly DB3ReferenceDependency[];
} {
    const shape: Record<string, z.ZodTypeAny> = {};
    const members: DB3CompiledMember[] = [];
    const referenceDependencies: DB3ReferenceDependency[] = [];

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
                let referenceDependency: DB3ReferenceDependency | undefined;
                if (ownership.kind === "foreignKey") {
                    const relationSelection = select[ownership.relationMember];
                    const relationIsSelected = relationSelection !== undefined
                        && relationSelection !== false
                        && relationSelection !== null;
                    if (!relationIsSelected) {
                        const targetTable = ownership.getTargetTable();
                        if (referenceContract.has(targetTable as AnyDB3Table)) {
                            referenceDependency = {
                                sourceTable: table,
                                targetTable: targetTable as AnyDB3Table,
                                foreignKeyMember: member,
                                relationMember: ownership.relationMember,
                                selectionPath,
                            };
                            referenceDependencies.push(referenceDependency);
                        }
                    }
                }
                shape[member] = presence.schema;
                members.push({
                    kind: "value",
                    ownershipKind: ownership.kind,
                    member,
                    selectionPath,
                    field: ownership.field,
                    schema: presence.schema,
                    required: presence.required,
                    referenceDependency,
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
                const targetTable = ownership.getTargetTable();
                const nested = compileSelect(
                    entity,
                    targetTable,
                    nestedSelect,
                    `${selectionPath}.select`,
                    referenceContract,
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
                referenceDependencies.push(...nested.referenceDependencies);
                break;
            }

            default:
                unsupportedMemberKind(ownership);
        }
    }

    return {
        dtoSchema: z.object(shape),
        members,
        referenceDependencies,
    };
}

/**
 * Compiles the supported subset of an explicit Prisma selection. Shape-neutral
 * relation arguments such as where/orderBy/pagination remain untouched; only
 * each level's select object contributes to the DTO schema.
 */
export function compileDB3Selection<
    TEntity extends AnyDB3Table,
    const TSelection extends DB3ViewSelectionArgs<TEntity>,
>(
    entity: TEntity,
    selection: TSelection,
    referenceContract: AnyDB3ReferenceContract = emptyReferenceContract,
): DB3CompiledSelection<TEntity, TSelection> {
    const selectionValue = selection as TAnyModel;
    const select = getExplicitSelect(entity, selectionValue, entity.tableID);
    const compiled = compileSelect(
        entity,
        entity,
        select,
        `${entity.tableID}.select`,
        referenceContract,
    );

    return {
        prismaSelection: selection,
        dtoSchema: compiled.dtoSchema as DB3DerivedDtoSchema<TEntity, TSelection>,
        members: compiled.members,
        referenceDependencies: compiled.referenceDependencies,
    };
}

/** Derives the validated DTO schema for an explicit Prisma selection. */
export function deriveDtoSchema<
    TEntity extends AnyDB3Table,
    const TSelection extends DB3ViewSelectionArgs<TEntity>,
>(
    entity: TEntity,
    selection: TSelection,
): DB3DerivedDtoSchema<TEntity, TSelection> {
    return compileDB3Selection(entity, selection).dtoSchema;
}

function hydrateCompiledMembers(
    members: readonly DB3CompiledMember[],
    dto: TAnyModel,
    references: DB3ReferenceProvider,
    path: string,
): TAnyModel {
    const clientModel = { ...dto };

    for (const member of members) {
        const value = dto[member.member];
        // Optional members removed by authorization do not participate in
        // hydration, and their codecs must not receive undefined.
        if (value === undefined) continue;

        if (member.kind === "value") {
            if (member.ownershipKind === "field") {
                clientModel[member.member] = member.field.hydrateReadTransportValue(value);
            } else if (member.referenceDependency) {
                const dependency = member.referenceDependency;
                if (value === null) {
                    clientModel[dependency.relationMember] = null;
                } else {
                    clientModel[dependency.relationMember] = references.require(
                        dependency.targetTable,
                        value,
                        `${path}.${dependency.foreignKeyMember}`,
                    );
                }
            }
            continue;
        }

        if (value === null) continue;
        clientModel[member.member] = member.cardinality === "many"
            ? (value as TAnyModel[]).map((item, index) => hydrateCompiledMembers(
                member.members,
                item,
                references,
                `${path}.${member.member}[${index}]`,
            ))
            : hydrateCompiledMembers(
                member.members,
                value as TAnyModel,
                references,
                `${path}.${member.member}`,
            );
    }

    return clientModel;
}

function hydrateCompiledSelection<
    TEntity extends AnyDB3Table,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TReferences extends AnyDB3ReferenceContract,
>(
    entity: TEntity,
    compiled: DB3CompiledSelection<TEntity, TSelection>,
    dto: DB3DtoForSelection<TEntity, TSelection>,
    references: DB3ReferenceProvider<TReferences>,
): DB3ClientForSelection<TEntity, TSelection, TReferences> {
    // Parse the complete DTO before running any codec. A later invalid member
    // therefore cannot leave earlier members partially hydrated.
    const parsedDto = compiled.dtoSchema.parse(dto) as TAnyModel;
    const identity = parsedDto[entity.clientIdMember];
    const path = identity === undefined
        ? entity.tableID
        : `${entity.tableID}(${String(identity)})`;
    return hydrateCompiledMembers(
        compiled.members,
        parsedDto,
        references,
        path,
    ) as DB3ClientForSelection<TEntity, TSelection, TReferences>;
}

/**
 * Derives the selection, DTO schema, and default consumer hydrator from
 * one compiled description. Embedded relations are recursively hydrated from
 * the nested member tree; normalized foreign keys resolve through the supplied
 * reference provider without performing I/O.
 */
export function deriveViewContract<
    TEntity extends AnyDB3Table,
    const TSelection extends DB3ViewSelectionArgs<TEntity>,
    const TTransportSelection extends DB3ViewSelectionArgs<TEntity> = TSelection,
    const TReferences extends AnyDB3ReferenceContract = typeof emptyReferenceContract,
>(
    entity: TEntity,
    selection: TSelection,
    options?: {
        readonly transportSelection?: TTransportSelection;
        readonly references?: TReferences;
    },
): DB3ViewContract<
    TEntity,
    TSelection,
    TTransportSelection,
    TReferences
> {
    const transportSelection = options?.transportSelection
        ?? (selection as unknown as TTransportSelection);
    if (options?.transportSelection) {
        assertTransportSelectionIsFetched(
            entity,
            selection as TAnyModel,
            transportSelection as TAnyModel,
            entity.tableID,
        );
    }
    const referenceContract = options?.references
        ?? (emptyReferenceContract as TReferences);
    const compiled = compileDB3Selection(
        entity,
        transportSelection,
        referenceContract,
    );
    // The recursive projection compiler mutates an otherwise Prisma-generic
    // selection shape, so its internal boundary deliberately uses TAnyModel.
    const prismaSelection = addPublicIdentityProjectionSelections(
        entity,
        entity,
        selection as TAnyModel,
        transportSelection as TAnyModel,
        entity.tableID,
    );
    return {
        ...compiled,
        // Projection and authorization support only add hidden Prisma fields;
        // TSelection remains the caller-authored selection authority.
        prismaSelection: prepareDB3ReadSelection(entity, prismaSelection).selection as TSelection,
        referenceContract,
        hydrate: (dto, references) => hydrateCompiledSelection(entity, compiled, dto, references),
    };
}
