import db, { Prisma } from "db";
import { CoerceToNumberOrNull, ValidateInt } from "shared/utils";
import { z } from "zod"

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const InstrumentNameSchema = z.string().min(1);

export const InsertInstrumentSchema = z.object({
    name: InstrumentNameSchema,
    sortOrder: z.number(),
    functionalGroupId: z.number(),
    instrumentTags: z.array(z.object({
        tagId: z.number()
    })),
    //tagIds: z.array(z.number()).optional(),
});

export const UpdateInstrumentSchema = z.object({
    id: z.number(),
    name: InstrumentNameSchema.optional(),
    sortOrder: z.number().optional(),
    functionalGroupId: z.number().optional(),
    tagIds: z.array(z.number()).optional(),
});


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const InstrumentTagTextSchema = z.string().min(1);
export const InstrumentTagColorSchema = z.string().nullable();
export const InstrumentTagSignificanceSchema = z.string().nullable();
export const InstrumentTagSortOrderSchema = z.preprocess(CoerceToNumberOrNull, z.number().refine(ValidateInt));

export const InsertInstrumentTagSchema = z.object({
    text: InstrumentTagTextSchema,
    color: InstrumentTagColorSchema,
    significance: InstrumentTagSignificanceSchema,
    sortOrder: InstrumentTagSortOrderSchema,
});

export const UpdateInstrumentTagSchema = z.object({
    id: z.number(),
    text: InstrumentTagTextSchema.optional(),
    color: InstrumentTagColorSchema.optional(),
    significance: InstrumentTagSignificanceSchema.optional(),
    sortOrder: InstrumentTagSortOrderSchema.optional(),
});

export const InsertInstrumentTagFromStringAsAssociationSchema = z.object({
    localPk: z.number().nullable(),
    text: InstrumentTagTextSchema,
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const InstrumentFunctionalGroupNameSchema = z.string().min(1);
export const InstrumentFunctionalGroupDescriptionSchema = z.string();
export const InstrumentFunctionalGroupSortOrderSchema = z.number();

export const InsertInstrumentFunctionalGroupSchema = z.object({
    name: InstrumentFunctionalGroupNameSchema,
    description: InstrumentFunctionalGroupDescriptionSchema,
    sortOrder: InstrumentFunctionalGroupSortOrderSchema,
});

export const UpdateInstrumentFunctionalGroupSchema = z.object({
    id: z.number(),
    name: InstrumentFunctionalGroupNameSchema.optional(),
    description: InstrumentFunctionalGroupDescriptionSchema.optional(),
    sortOrder: InstrumentFunctionalGroupSortOrderSchema.optional(),
});
