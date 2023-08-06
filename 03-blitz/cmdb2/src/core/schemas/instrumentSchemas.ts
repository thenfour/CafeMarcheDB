import db, { Prisma } from "db";
import { CoerceToNumberOrNull, ValidateInt } from "shared/utils";
import { z } from "zod"

// name              String
// sortOrder         Int
// functionalGroupId Int
// instrumentTags    InstrumentTagAssociation[]

export const InstrumentNameSchema = z.string().min(1);

export const InsertInstrumentSchema = z.object({
    name: InstrumentNameSchema,
    sortOrder: z.number(),
    functionalGroupId: z.number(),
    tagIds: z.array(z.number()).optional(),
});

export const UpdateInstrumentSchema = z.object({
    id: z.number(),
    name: InstrumentNameSchema.optional(),
    sortOrder: z.number().optional(),
    functionalGroupId: z.number().optional(),
    tagIds: z.array(z.number()).optional(),
});


// model InstrumentTag {
//     id           Int                        @id @default(autoincrement())
//     text         String
//     color        String?
//     significance String? // "uses electricity" for example?
//     instruments  InstrumentTagAssociation[]
//   }

//   model InstrumentTagAssociation {
//     id           Int           @id @default(autoincrement())
//     instrumentId Int
//     instrument   Instrument    @relation(fields: [instrumentId], references: [id], onDelete: Cascade) // cascade delete association
//     tagId        Int
//     tag          InstrumentTag @relation(fields: [tagId], references: [id], onDelete: Cascade) // cascade delete association

//     @@unique([instrumentId, tagId]) // 
//   }

// Custom transformation function
const emptyStringToNull = (data: unknown): unknown => {
    if (typeof data === "string" && data.trim() === "") {
        return null;
    }
    return data;
};


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
