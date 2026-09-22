import type { TAnyModel } from "@/shared/rootroot";
import { z } from "zod";
import type { AnyDB3Field } from "../db3core";
import type { AnyDB3Entity } from "./db3Entity";
import type { DB3ViewSelectionArgs } from "./db3View";

export interface DB3CompiledScalarMember {
    readonly member: string;
    readonly selectionPath: string;
    readonly field: AnyDB3Field;
    readonly schema: z.ZodTypeAny;
    readonly required: boolean;
}

export interface DB3CompiledScalarSelection<TSelection> {
    readonly prismaSelection: TSelection;
    readonly dtoSchema: z.AnyZodObject;
    readonly members: readonly DB3CompiledScalarMember[];
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

/**
 * Compiles the scalar-only subset of an explicit Prisma selection. This is the
 * common runtime description that DTO derivation and automatic hydration will
 * share; relation support is added deliberately in later phases.
 */
export function compileDB3ScalarSelection<
    TEntity extends AnyDB3Entity,
    const TSelection extends DB3ViewSelectionArgs<TEntity>,
>(
    entity: TEntity,
    selection: TSelection,
): DB3CompiledScalarSelection<TSelection> {
    const selectionValue = selection as TAnyModel;
    if (selectionValue.include !== undefined) {
        throw selectionError(
            entity,
            `${entity.entityID}.include`,
            "the scalar compiler supports explicit 'select' selections only.",
        );
    }

    const select = selectionValue.select;
    if (!select || typeof select !== "object" || Array.isArray(select)) {
        throw selectionError(
            entity,
            `${entity.entityID}.select`,
            "expected an explicit Prisma select object.",
        );
    }

    const shape: Record<string, z.ZodTypeAny> = {};
    const members: DB3CompiledScalarMember[] = [];

    for (const [member, memberSelection] of Object.entries(select)) {
        if (memberSelection === false || memberSelection === undefined) continue;

        const selectionPath = `${entity.entityID}.select.${member}`;
        let ownership;
        try {
            ownership = entity.schema.resolvePrismaMember(member, selectionPath);
        } catch (cause) {
            throw selectionError(
                entity,
                selectionPath,
                cause instanceof Error ? cause.message : String(cause),
            );
        }

        const fieldClass = ownership.field.constructor.name;
        if (ownership.kind !== "field") {
            throw selectionError(
                entity,
                selectionPath,
                `${fieldClass} field '${ownership.field.member}' owns this as `
                + `${ownership.kind}; relation and normalized foreign-key selections `
                + "are not supported by the scalar compiler.",
            );
        }
        if (memberSelection !== true) {
            throw selectionError(
                entity,
                selectionPath,
                `${fieldClass} field '${ownership.field.member}' uses an unsupported `
                + "non-scalar selection shape.",
            );
        }
        if (!ownership.field.readTransportSchema) {
            throw selectionError(
                entity,
                selectionPath,
                `${fieldClass} field '${ownership.field.member}' does not declare `
                + "readTransportSchema.",
            );
        }

        const required = ownership.field.isReadRequiredAfterRowAuth();
        const schema = required
            ? ownership.field.readTransportSchema
            : ownership.field.readTransportSchema.optional();
        shape[member] = schema;
        members.push({
            member,
            selectionPath,
            field: ownership.field,
            schema,
            required,
        });
    }

    return {
        prismaSelection: selection,
        dtoSchema: z.object(shape),
        members,
    };
}
