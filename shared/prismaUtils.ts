import { z } from "zod";

type UnwrapZodSchema<TSchema extends z.ZodTypeAny> =
    TSchema extends z.ZodOptional<infer TInner> ? UnwrapZodSchema<TInner>
    : TSchema extends z.ZodNullable<infer TInner> ? UnwrapZodSchema<TInner>
    : TSchema extends z.ZodDefault<infer TInner> ? UnwrapZodSchema<TInner>
    : TSchema extends z.ZodCatch<infer TInner> ? UnwrapZodSchema<TInner>
    : TSchema extends z.ZodBranded<infer TInner, any> ? UnwrapZodSchema<TInner>
    : TSchema extends z.ZodEffects<infer TInner, any, any> ? UnwrapZodSchema<TInner>
    : TSchema extends z.ZodPipeline<infer TInput, any> ? UnwrapZodSchema<TInput>
    : TSchema;

type ZodSchemaPrismaFieldSelection<TSchema extends z.ZodTypeAny> =
    UnwrapZodSchema<TSchema> extends z.ZodObject<infer TShape>
    ? { readonly select: ZodShapePrismaSelection<TShape> }
    : UnwrapZodSchema<TSchema> extends z.ZodArray<infer TItem, any>
    ? ZodSchemaPrismaFieldSelection<TItem>
    : true;

type ZodShapePrismaSelection<TShape extends z.ZodRawShape> = {
    readonly [TKey in keyof TShape]: ZodSchemaPrismaFieldSelection<TShape[TKey]>;
};

/** The exact Prisma `select` shape derived from a Zod transport object. */
export type ZodPrismaSelection<TSchema extends z.AnyZodObject> = {
    readonly select: ZodShapePrismaSelection<TSchema["shape"]>;
};

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
    let current = schema;
    while (true) {
        if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
            current = current.unwrap();
            continue;
        }
        if (current instanceof z.ZodDefault || current instanceof z.ZodCatch) {
            current = current.removeDefault();
            continue;
        }
        if (current instanceof z.ZodBranded) {
            current = current.unwrap();
            continue;
        }
        if (current instanceof z.ZodEffects) {
            current = current.innerType();
            continue;
        }
        if (current instanceof z.ZodPipeline) {
            current = current._def.in;
            continue;
        }
        return current;
    }
}

function schemaToPrismaFieldSelection(
    schema: z.ZodTypeAny,
    path: string,
): true | { select: Record<string, unknown> } {
    const unwrapped = unwrapSchema(schema);
    if (unwrapped instanceof z.ZodObject) {
        return {
            select: Object.fromEntries(
                Object.entries(unwrapped.shape).map(([member, memberSchema]) => [
                    member,
                    schemaToPrismaFieldSelection(
                        memberSchema as z.ZodTypeAny,
                        `${path}.${member}`,
                    ),
                ]),
            ),
        };
    }
    if (unwrapped instanceof z.ZodArray) {
        return schemaToPrismaFieldSelection(unwrapped.element, `${path}[]`);
    }
    if (unwrapped instanceof z.ZodUnion
        || unwrapped instanceof z.ZodDiscriminatedUnion
        || unwrapped instanceof z.ZodLazy
        || unwrapped instanceof z.ZodIntersection) {
        throw new Error(
            `Cannot derive a Prisma selection for ambiguous Zod schema at '${path}'.`,
        );
    }
    return true;
}

/**
 * Derives a Prisma `select` from a Zod transport object.
 *
 * Object-valued members are treated as relations and arrays recurse into their
 * element schema. Query behavior such as relation ordering, filtering, and
 * authorization-only fields remains an explicit view-selection concern.
 */
export function ZodToPrismaSelection<TSchema extends z.AnyZodObject>(
    schema: TSchema,
): ZodPrismaSelection<TSchema> {
    if (!(schema instanceof z.ZodObject)) {
        throw new Error("ZodToPrismaSelection only supports ZodObject schemas.");
    }
    return schemaToPrismaFieldSelection(schema, "$root") as ZodPrismaSelection<TSchema>;
}
