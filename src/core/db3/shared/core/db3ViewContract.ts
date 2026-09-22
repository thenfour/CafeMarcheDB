import type { TAnyModel } from "@/shared/rootroot";
import { z } from "zod";
import {
    GetTableById,
    type AnyDB3Field,
    type DB3PrismaMemberOwnership,
    type xTable,
} from "../db3core";
import type { AnyDB3Entity } from "./db3Entity";
import type { DB3ViewSelectionArgs } from "./db3View";

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

export interface DB3CompiledSelection<TSelection> {
    readonly prismaSelection: TSelection;
    readonly dtoSchema: z.AnyZodObject;
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
): DB3CompiledSelection<TSelection> {
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
        ...compiled,
    };
}
