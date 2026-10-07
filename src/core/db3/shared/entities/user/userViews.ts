import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { Prisma } from "db";
import {
    type InstrumentPublicId,
    isPublicId,
    type UserInstrumentPublicId,
    type UserTagAssignmentPublicId,
    type UserTagPublicId,
} from "shared/publicId";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import {
    UserInstrumentNaturalOrderBy,
    UserTagAssignmentNaturalOrderBy,
} from "../../schema/prismArgs";
import { xUser, xUserInstrument } from "../../schema/user";

const userIdentitySummaryArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: {
        publicId: true,
        signInMethods: {
            select: { type: true, displayId: true },
            orderBy: [{ createdAt: "asc" }, { publicId: "asc" }],
        },
    },
});

const userIdentitySummaryViewContract = deriveViewContract(xUser, userIdentitySummaryArgs);

export const userIdentitySummaryView = defineView({
    viewID: "User_IdentitySummary",
    entity: xUser,
    selection: userIdentitySummaryViewContract.prismaSelection,
    dtoSchema: userIdentitySummaryViewContract.dtoSchema,
    hydrate: userIdentitySummaryViewContract.hydrate
});

const UserEditorInstrumentAssociationDtoSchema = z.object({
    publicId: z.custom<UserInstrumentPublicId>(isPublicId),
    userId: xUser.identitySchema.optional(),
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
    userId: xUser.identitySchema.optional(),
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
    publicId: xUser.identitySchema,
    isDeleted: z.boolean().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().nullable().optional(),
    cssClass: z.string().nullable().optional(),
    createdAt: z.date().optional(),
    isSysAdmin: z.boolean().optional(),
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
        user: { select: { publicId: true, name: true } },
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


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/entities/user/userViews.ts:1-169
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 05f3649d38e228c64a762ce5d4b2ad507326784ac67b60f5497cec5cf8c561c7
// MIGRATION_REFERENCE_BEGIN
// import { ZodToPrismaSelection } from "@/shared/prismaUtils";
// import { Prisma } from "db";
// import {
//     type InstrumentPublicId,
//     isPublicId,
//     type RolePublicId,
//     type UserInstrumentPublicId,
//     type UserTagAssignmentPublicId,
//     type UserTagPublicId,
// } from "shared/publicId";
// import { z } from "zod";
// import { defineCrudView } from "../../core/db3CrudView";
// import { defineView } from "../../core/db3View";
// import { deriveViewContract } from "../../core/db3ViewContract";
// import {
//     UserInstrumentNaturalOrderBy,
//     UserTagAssignmentNaturalOrderBy,
// } from "../../schema/prismArgs";
// import { xUser, xUserInstrument } from "../../schema/user";
//
// const userIdentitySummaryArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
//     select: {
//         publicId: true,
//         signInMethods: {
//             select: { type: true, displayId: true },
//             orderBy: [{ createdAt: "asc" }, { publicId: "asc" }],
//         },
//     },
// });
//
// const userIdentitySummaryViewContract = deriveViewContract(xUser, userIdentitySummaryArgs);
//
// export const userIdentitySummaryView = defineView({
//     viewID: "User_IdentitySummary",
//     entity: xUser,
//     selection: userIdentitySummaryViewContract.prismaSelection,
//     dtoSchema: userIdentitySummaryViewContract.dtoSchema,
//     hydrate: userIdentitySummaryViewContract.hydrate
// });
//
// const UserEditorRoleDtoSchema = z.object({
//     publicId: z.custom<RolePublicId>(isPublicId),
//     name: z.string().optional(),
//     description: z.string().optional(),
//     color: z.string().nullable().optional(),
//     sortOrder: z.number().int().optional(),
//     significance: z.string().nullable().optional(),
// });
//
// const UserEditorInstrumentAssociationDtoSchema = z.object({
//     publicId: z.custom<UserInstrumentPublicId>(isPublicId),
//     userId: xUser.identitySchema.optional(),
//     instrumentId: z.custom<InstrumentPublicId>(isPublicId).optional(),
//     isPrimary: z.boolean().optional(),
//     instrument: z.object({
//         publicId: z.custom<InstrumentPublicId>(isPublicId),
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
// const UserEditorTagAssociationDtoSchema = z.object({
//     publicId: z.custom<UserTagAssignmentPublicId>(isPublicId),
//     userId: xUser.identitySchema.optional(),
//     userTagId: z.custom<UserTagPublicId>(isPublicId).optional(),
//     userTag: z.object({
//         publicId: z.custom<UserTagPublicId>(isPublicId),
//         text: z.string().optional(),
//         description: z.string().optional(),
//         color: z.string().nullable().optional(),
//         sortOrder: z.number().int().optional(),
//         cssClass: z.string().nullable().optional(),
//         significance: z.string().nullable().optional(),
//     }).optional(),
// });
//
// const UserEditorDtoSchema = z.object({
//     publicId: xUser.identitySchema,
//     isDeleted: z.boolean().optional(),
//     name: z.string().optional(),
//     email: z.string().optional(),
//     phone: z.string().nullable().optional(),
//     cssClass: z.string().nullable().optional(),
//     createdAt: z.date().optional(),
//     isSysAdmin: z.boolean().optional(),
//     roleId: z.custom<RolePublicId>(isPublicId).nullable().optional(),
//     role: UserEditorRoleDtoSchema.nullable().optional(),
//     instruments: z.array(UserEditorInstrumentAssociationDtoSchema).optional(),
//     tags: z.array(UserEditorTagAssociationDtoSchema).optional(),
// });
//
//
//
// const userEditorBaseSelection = ZodToPrismaSelection(UserEditorDtoSchema.omit({ instruments: true }));
// const userEditorSelection = Prisma.validator<Prisma.UserDefaultArgs>()({
//     select: {
//         ...userEditorBaseSelection.select,
//         instruments: {
//             select: {
//                 publicId: true,
//                 userId: true,
//                 instrumentId: true,
//                 isPrimary: true,
//                 instrument: {
//                     select: {
//                         publicId: true,
//                         name: true,
//                         description: true,
//                         sortOrder: true,
//                         functionalGroup: {
//                             select: { publicId: true, color: true },
//                         },
//                     },
//                 },
//             },
//             orderBy: UserInstrumentNaturalOrderBy,
//         },
//         tags: {
//             ...userEditorBaseSelection.select.tags,
//             orderBy: UserTagAssignmentNaturalOrderBy,
//         },
//     },
// });
//
// export const userEditorView = defineCrudView({
//     viewID: "User_Editor",
//     entity: xUser,
//     operations: { create: true, update: true },
//     selection: userEditorSelection,
//     dtoSchema: UserEditorDtoSchema,
//     hydrate: dto => xUser.getClientModel(dto, "view"),
// });
//
// const userInstrumentEditorSelection = Prisma.validator<Prisma.UserInstrumentDefaultArgs>()({
//     select: {
//         publicId: true,
//         userId: true,
//         user: { select: { publicId: true, name: true } },
//         instrumentId: true,
//         instrument: {
//             select: {
//                 publicId: true,
//                 name: true,
//                 description: true,
//                 functionalGroup: { select: { publicId: true, color: true } },
//             },
//         },
//         isPrimary: true,
//     },
// });
//
// const userInstrumentEditorContract = deriveViewContract(
//     xUserInstrument,
//     userInstrumentEditorSelection,
// );
//
// export const userInstrumentEditorView = defineCrudView({
//     viewID: "UserInstrument_Editor",
//     entity: xUserInstrument,
//     operations: { create: true, update: true, delete: true },
//     selection: userInstrumentEditorContract.prismaSelection,
//     dtoSchema: userInstrumentEditorContract.dtoSchema,
//     hydrate: userInstrumentEditorContract.hydrate,
// });
// MIGRATION_REFERENCE_END
