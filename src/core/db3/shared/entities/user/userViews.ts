import { Prisma } from "db";
import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { z } from "zod";
import {
    type InstrumentPublicId,
    isPublicId,
    type RolePublicId,
    type UserInstrumentPublicId,
    type UserTagAssignmentPublicId,
    type UserTagPublicId,
} from "shared/publicId";
import { defineCrudView } from "../../core/db3CrudView";
import { deriveViewContract } from "../../core/db3ViewContract";
import {
    UserInstrumentNaturalOrderBy,
    UserTagAssignmentNaturalOrderBy,
} from "../../schema/prismArgs";
import { xUser, xUserInstrument } from "../../schema/user";

const UserEditorRoleDtoSchema = z.object({
    publicId: z.custom<RolePublicId>(isPublicId),
    name: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
});

const UserEditorInstrumentAssociationDtoSchema = z.object({
    publicId: z.custom<UserInstrumentPublicId>(isPublicId),
    userId: z.number().int().optional(),
    instrumentId: z.custom<InstrumentPublicId>(isPublicId).optional(),
    isPrimary: z.boolean().optional(),
    instrument: z.object({
        publicId: z.custom<InstrumentPublicId>(isPublicId),
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
    publicId: z.custom<UserTagAssignmentPublicId>(isPublicId),
    userId: z.number().int().optional(),
    userTagId: z.custom<UserTagPublicId>(isPublicId).optional(),
    userTag: z.object({
        publicId: z.custom<UserTagPublicId>(isPublicId),
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
    roleId: z.custom<RolePublicId>(isPublicId).nullable().optional(),
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
                publicId: true,
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

const userInstrumentEditorSelection = Prisma.validator<Prisma.UserInstrumentDefaultArgs>()({
    select: {
        publicId: true,
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
});

const userInstrumentEditorContract = deriveViewContract(
    xUserInstrument,
    userInstrumentEditorSelection,
);

export const userInstrumentEditorView = defineCrudView({
    viewID: "UserInstrument_Editor",
    entity: xUserInstrument,
    operations: { create: true, update: true, delete: true },
    selection: userInstrumentEditorContract.prismaSelection,
    dtoSchema: userInstrumentEditorContract.dtoSchema,
    hydrate: userInstrumentEditorContract.hydrate,
});
