import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isPermission, type Permission } from "shared/permissions";
import { defineCommand } from "../../core/db3Command";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xBandUser } from "./bandUser";
import { xBandRole } from "./bandRoleViews";

export const bandUserRolesSelection = Prisma.validator<Prisma.BandUserDefaultArgs>()({
    select: {
        publicId: true,
        userId: true,
        user: {
            select: {
                publicId: true,
                name: true
            }
        },
        bandRoleId: true,
        bandRole: {
            select: { publicId: true }
        },
    },
});

const contract = deriveViewContract(xBandUser, bandUserRolesSelection);

export const bandUserRolesView = defineView({
    viewID: "BandUser_Roles",
    entity: xBandUser,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
});

export type BandUserRolesDto = DtoOf<typeof bandUserRolesView>;

const commandSchema = z.object({
    membershipId: xBandUser.identitySchema,
    roleId: xBandRole.identitySchema.nullable(),
    acknowledgeContinuityRisk: z.boolean(),
}).strict();

const resultIdentity = { membershipId: xBandUser.identitySchema, roleId: xBandRole.identitySchema.nullable() };

export type BandUserRoleEdit = z.infer<typeof commandSchema>;

export const bandUserRoleCommand = defineCommand({
    commandID: "BandUser_AssignRole",
    entity: xBandUser,
    dtoSchema: commandSchema,
    resultSchema: z.discriminatedUnion("status", [
        z.object({
            ...resultIdentity, status: z.literal("saved"),
        }).strict(),
        z.object({
            ...resultIdentity, status: z.literal("confirmationRequired"),
            permissions: z.array(z.custom<Permission>(isPermission)).min(1),
        }).strict(),
    ]),
    serialize: (edit: BandUserRoleEdit) => commandSchema.parse(edit),
    invalidation: {
        mode: "caller",
        entityIDs: ["BandUser"],
    },
});
