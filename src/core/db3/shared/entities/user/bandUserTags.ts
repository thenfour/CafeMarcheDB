import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import type { BandUserTagAssignmentPublicId } from "shared/publicId";
import { defineCommand } from "../../core/db3Command";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { defineTable, makeColumnSet, prismaModel } from "../../db3core";
import { foreignRef, MakePKfield, MakePublicIdField } from "../../columnTypes/xTableColumnTypes";
import { kReadOnlyAuthMap } from "../common/entityCommon";
import { xBandUser, activeBandMembershipWhere } from "./bandUser";
import { xBandUserTag } from "./bandUserTagViews";

// Assignment writes use the membership command; owners can read but cannot change invitation groups.
export const xBandUserTagAssignment = defineTable({
    tableName: "bandUserTagAssignment",
    tableUniqueName: "BandUserTagAssignment",
    prismaModel: prismaModel<Prisma.BandUserTagAssignmentDelegate>(),
    getIdentity: (row: {
        publicId: BandUserTagAssignmentPublicId
    }) => row.publicId,
    bandScope: {
        member: "bandId",
        via: {
            relation: "bandUser",
            ownerUserMember: "userId"
        },
        managePermission: Permission.manage_users
    },
    readConsistency: "snapshot",
    deletePolicy: "disabled",
    tableAuthMap: {
        View: Permission.view_users_basic_info,
        ViewOwn: Permission.login,
        Edit: Permission.never_grant,
        EditOwn: Permission.never_grant,
        Insert: Permission.never_grant,
    },
    queryParameters: {},
    getParameterizedWhereClause: (_params, auth): Prisma.BandUserTagAssignmentWhereInput[] => [{
        bandUser: activeBandMembershipWhere(), bandUserTag: { bandId: auth.requireBand().id },
    }],
    naturalOrderBy: { publicId: "asc" },
    getSelectionArgs: () => ({
        select: {
            publicId: true,
            bandUserTagId: true,
            bandUserTag: {
                select: { publicId: true }
            }
        }
    }),
    getRowInfo: row => ({
        pk: row.publicId,
        name: "",
        ownerUserId: row.bandUser?.userId ?? null
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<BandUserTagAssignmentPublicId>(),
        bandUserTag: foreignRef(() => xBandUserTag, { fkidMember: "bandUserTagId", authMap: kReadOnlyAuthMap }),
        bandUser: foreignRef(() => xBandUser, { fkidMember: "bandUserId", authMap: kReadOnlyAuthMap }),
    }),
});

export const bandUserTagsSelection = Prisma.validator<Prisma.BandUserDefaultArgs>()({
    select: {
        publicId: true,
        userId: true,
        user: {
            select: { publicId: true, name: true }
        },
        bandUserTagAssignments: {
            select: {
                publicId: true,
                bandUserTagId: true,
                bandUserTag: { select: { publicId: true } }
            },
            orderBy: { publicId: "asc" },
        },
    },
});
const contract = deriveViewContract(xBandUser, bandUserTagsSelection);
export const bandUserTagsView = defineView({
    viewID: "BandUser_Tags", entity: xBandUser,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
});
export type BandUserTagsDto = DtoOf<typeof bandUserTagsView>;

const commandSchema = z.object({
    membershipId: xBandUser.identitySchema,
    tagIds: z.array(xBandUserTag.identitySchema).max(64).refine(ids => new Set(ids).size === ids.length, "Duplicate tags"),
}).strict();
export type BandUserTagsEdit = z.infer<typeof commandSchema>;
export const bandUserTagsCommand = defineCommand({
    commandID: "BandUser_SetTags",
    entity: xBandUser,
    dtoSchema: commandSchema,
    resultSchema: z.object({ membershipId: xBandUser.identitySchema }).strict(),
    serialize: (edit: BandUserTagsEdit) => commandSchema.parse(edit),
    invalidation: {
        mode: "caller",
        entityIDs: ["BandUser", "BandUserTagAssignment"],
    },
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandUserTagAssignment: typeof xBandUserTagAssignment;
    }
}
