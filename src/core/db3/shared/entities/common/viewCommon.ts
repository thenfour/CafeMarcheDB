import { z } from "zod";


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


    createdByUserId: () => ({ createdByUserId: z.number().int().nullable() }),
    createdByUser: () => ({
        createdByUser: z.object({
            id: z.number().int(),
            name: z.string(),
        }).nullable()
    }),
    visiblePermissionId: () => ({ visiblePermissionId: z.number().int().nullable() }),
    visiblePermission: () => ({
        visiblePermission: z.object({
            id: z.number().int(),
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
