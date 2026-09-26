import { z } from "zod";
import { isPublicId, type PermissionPublicId, type UserPublicId } from "shared/publicId";


// common view schemas for db3 entities
export const db3s = {
    id: () => ({ id: z.number().int() }),
    descriptionColorSortOrder: () => ({
        description: z.string().optional(),
        color: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
    }),
    iconName: () => ({ iconName: z.string().nullable().optional() }),
    isDeleted: () => ({ isDeleted: z.boolean().optional() }),

    dateRange: () => ({
        startsAt: z.date().nullable().optional(),
        durationMillis: z.bigint().optional(),
        isAllDay: z.boolean().optional(),
    }),


    createdByUserId: () => ({ createdByUserId: z.custom<UserPublicId>(isPublicId).nullable() }),
    createdByUser: () => ({
        createdByUser: z.object({
            publicId: z.custom<UserPublicId>(isPublicId),
            name: z.string(),
        }).nullable()
    }),
    visiblePermissionId: () => ({
        visiblePermissionId: z.custom<PermissionPublicId>(isPublicId).nullable(),
    }),
    visiblePermission: () => ({
        visiblePermission: z.object({
            publicId: z.custom<PermissionPublicId>(isPublicId),
            name: z.string(),
            isVisibility: z.boolean(),
            description: z.string().nullable(),
            sortOrder: z.number().int(),
            significance: z.string().nullable(),
            color: z.string().nullable(),
            iconName: z.string().nullable(),
        }).nullable()
    }),


    // fields that may come back undefined when unauthorized. this wrapper
    // is to label the field semantically as such.
    // i would love for there to be a fluent way to mark fields as requiring authorization
    // like,
    //     z.string().authNeeded()
    authNeeded: <T extends z.ZodTypeAny>(schema: T) => schema.optional(),
}

// helper function to test if all optional fields in a Zod schema are populated;
// this is done recursively through z.object, z.array;
export const areAllOptionalFieldsPopulated = <T>(obj: T, schema: z.ZodTypeAny): boolean => {
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        for (const key in shape) {
            if (obj[key] === undefined || obj[key] === null) {
                return false;
            }
            if (!areAllOptionalFieldsPopulated(obj[key], shape[key])) {
                return false;
            }
        }
        return true;
    }
    if (schema instanceof z.ZodArray) {
        if (!Array.isArray(obj)) {
            return false;
        }
        for (const item of obj) {
            if (!areAllOptionalFieldsPopulated(item, schema.element)) {
                return false;
            }
        }
        return true;
    }
    return true;
};


type Grafted<A, B> =
    A extends readonly unknown[] ? B :
    B extends readonly unknown[] ? B :
    A extends object
    ? B extends object
    ? {
        [K in keyof A | keyof B]:
        K extends keyof B
        ? K extends keyof A ? Grafted<A[K], B[K]> : B[K]
        : K extends keyof A ? A[K] : never;
    }
    : B
    : B;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null
        && typeof value === "object"
        && !Array.isArray(value)
        && (Object.getPrototypeOf(value) === Object.prototype
            || Object.getPrototypeOf(value) === null);
}

export function graft<const A extends Record<string, unknown>, const B extends Record<string, unknown>>(
    base: A,
    additions: B,
): Grafted<A, B> {
    const result: Record<string, unknown> = { ...base };

    for (const [key, value] of Object.entries(additions)) {
        const previous = result[key];
        result[key] =
            isPlainObject(previous) && isPlainObject(value)
                ? graft(previous, value)
                : value;
    }

    return result as Grafted<A, B>;
}
