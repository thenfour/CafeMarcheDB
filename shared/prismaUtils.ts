
// converts the above zod schema recursively into a Prisma selection object,
// such that we can derive the selection by:

// const UserEditorInstrumentAssociationDtoSchema = z.object({
//     id: z.number().int(),
//     userId: z.number().int().optional(),
//     instrumentId: z.number().int().optional(),
//     isPrimary: z.boolean().optional(),
//     instrument: z.object({
//         id: z.number().int(),
//         name: z.string().optional(),
//         description: z.string().optional(),
//         sortOrder: z.number().int().optional(),
//         functionalGroup: z.object({
//             publicId: z.string().optional(),
//             color: z.string().nullable().optional(),
//         }).optional(),
//     }).optional(),
// });
//
// const userEditorSelection = Prisma.validator<Prisma.UserDefaultArgs>()(ZodToPrismaSelection(UserEditorDtoSchema));

import { z } from "zod";

// todo: make the returned type correct
export const ZodToPrismaSelection = (schema: z.ZodTypeAny) => {
    // assert that this is a ZodObject
    if (!(schema instanceof z.ZodObject)) {
        throw new Error("ZodToPrismaSelection only supports ZodObject schemas");
    }
    // ... todo
};
