import { Prisma } from "db";
import { z } from "zod";
import { defineCreateUpdateView } from "../../core/db3CrudView";
import {
    UserInstrumentNaturalOrderBy,
    UserTagAssignmentNaturalOrderBy,
} from "../../schema/prismArgs";
import { userEntity } from "./userEntities";

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
    instrumentId: z.number().int().optional(),
    isPrimary: z.boolean().optional(),
    instrument: z.object({
        id: z.number().int(),
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



const userEditorSelection = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: {
        id: true,
        isDeleted: true,
        name: true,
        email: true,
        phone: true,
        cssClass: true,
        createdAt: true,
        isSysAdmin: true,
        roleId: true,
        role: {
            select: {
                id: true,
                name: true,
                description: true,
                color: true,
                sortOrder: true,
                significance: true,
            },
        },
        instruments: {
            select: {
                id: true,
                userId: true,
                instrumentId: true,
                isPrimary: true,
                instrument: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        sortOrder: true,
                        functionalGroup: {
                            select: {
                                publicId: true,
                                color: true,
                            },
                        },
                    },
                },
            },
            orderBy: UserInstrumentNaturalOrderBy,
        },
        tags: {
            select: {
                id: true,
                userId: true,
                userTagId: true,
                userTag: {
                    select: {
                        id: true,
                        text: true,
                        description: true,
                        color: true,
                        sortOrder: true,
                        cssClass: true,
                        significance: true,
                    },
                },
            },
            orderBy: UserTagAssignmentNaturalOrderBy,
        },
    },
});

export const userEditorView = defineCreateUpdateView({
    viewID: "User_Editor",
    entity: userEntity,
    selection: userEditorSelection,
    dtoSchema: UserEditorDtoSchema,
    hydrate: dto => dto,
});
