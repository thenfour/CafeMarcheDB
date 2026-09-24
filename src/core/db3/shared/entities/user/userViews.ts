import { Prisma } from "db";
import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import {
    UserInstrumentNaturalOrderBy,
    UserTagAssignmentNaturalOrderBy,
} from "../../schema/prismArgs";
import { xUser, xUserInstrument } from "../../schema/user";

const UserEditorRoleDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
});

const UserEditorInstrumentAssociationDtoSchema = z.object({
    id: z.number().int(),
    userId: z.number().int().optional(),
    instrumentId: z.string().optional(),
    isPrimary: z.boolean().optional(),
    instrument: z.object({
        publicId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().int().optional(),
        functionalGroup: z.object({
            publicId: z.string().optional(),
            color: z.string().nullable().optional(),
        }).optional(),
    }).optional(),
});

const UserEditorTagAssociationDtoSchema = z.object({
    id: z.number().int(),
    userId: z.number().int().optional(),
    userTagId: z.number().int().optional(),
    userTag: z.object({
        id: z.number().int(),
        text: z.string().optional(),
        description: z.string().optional(),
        color: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
        cssClass: z.string().nullable().optional(),
        significance: z.string().nullable().optional(),
    }).optional(),
});

const UserEditorDtoSchema = z.object({
    id: z.number().int(),
    isDeleted: z.boolean().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().nullable().optional(),
    cssClass: z.string().nullable().optional(),
    createdAt: z.date().optional(),
    isSysAdmin: z.boolean().optional(),
    roleId: z.number().int().nullable().optional(),
    role: UserEditorRoleDtoSchema.nullable().optional(),
    instruments: z.array(UserEditorInstrumentAssociationDtoSchema).optional(),
    tags: z.array(UserEditorTagAssociationDtoSchema).optional(),
});



const userEditorBaseSelection = ZodToPrismaSelection(UserEditorDtoSchema.omit({ instruments: true }));
const userEditorSelection = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: {
        ...userEditorBaseSelection.select,
        instruments: {
            select: {
                id: true,
                userId: true,
                instrumentId: true,
                isPrimary: true,
                instrument: {
                    select: {
                        publicId: true,
                        name: true,
                        description: true,
                        sortOrder: true,
                        functionalGroup: {
                            select: { publicId: true, color: true },
                        },
                    },
                },
            },
            orderBy: UserInstrumentNaturalOrderBy,
        },
        tags: {
            ...userEditorBaseSelection.select.tags,
            orderBy: UserTagAssignmentNaturalOrderBy,
        },
    },
});

export const userEditorView = defineCrudView({
    viewID: "User_Editor",
    entity: xUser,
    operations: { create: true, update: true },
    selection: userEditorSelection,
    dtoSchema: UserEditorDtoSchema,
    hydrate: dto => xUser.getClientModel(dto, "view"),
});

const UserInstrumentEditorDtoSchema = z.object({
    id: z.number().int(),
    userId: z.number().int().optional(),
    user: z.object({
        id: z.number().int(),
        name: z.string().optional(),
    }).optional(),
    instrumentId: z.string().optional(),
    instrument: z.object({
        publicId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        functionalGroup: z.object({
            publicId: z.string().optional(),
            color: z.string().nullable().optional(),
        }).optional(),
    }).optional(),
    isPrimary: z.boolean().optional(),
});

export const userInstrumentEditorView = defineCrudView({
    viewID: "UserInstrument_Editor",
    entity: xUserInstrument,
    operations: { create: true, update: true, delete: true },
    selection: Prisma.validator<Prisma.UserInstrumentDefaultArgs>()({
        select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true } },
            instrumentId: true,
            instrument: {
                select: {
                    publicId: true,
                    name: true,
                    description: true,
                    functionalGroup: { select: { publicId: true, color: true } },
                },
            },
            isPrimary: true,
        },
    }),
    dtoSchema: UserInstrumentEditorDtoSchema,
    hydrate: dto => xUserInstrument.getClientModel(dto, "view"),
});
