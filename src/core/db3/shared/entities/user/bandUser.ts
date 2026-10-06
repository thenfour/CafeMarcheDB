import { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import type { BandUserPublicId } from "shared/publicId";
import { defineAuthMap, defineTable, makeColumnSet, prismaModel, SqlSpecialColumnFunction } from "../../db3core";
import { BoolField, foreignRef, MakePKfield, MakePublicIdField, tagsRef } from "../../columnTypes/xTableColumnTypes";
import { GenericIntegerField } from "../../columnTypes/genericInteger";
import { serverOwnedField } from "../../columnTypes/inherited";
import { xUserMinimum } from "../../schema/user";
import { kReadOnlyAuthMap } from "../common/entityCommon";

/** Active membership also requires an active, unmerged shared person. */
export function activeBandMembershipWhere(): Prisma.BandUserWhereInput {
    return { isDeleted: false, user: { isDeleted: false, mergedIntoUserId: null } };
}

const instrumentAssignments = defineAuthMap({
    ...kReadOnlyAuthMap,
    PreMutate: Permission.manage_users,
    PreMutateAsOwner: Permission.login,
});
const managerAssignments = defineAuthMap({
    ...kReadOnlyAuthMap,
    PreMutate: Permission.manage_users,
    PreMutateAsOwner: Permission.manage_users,
});

// Membership creation, roles and deactivation belong to dedicated administration flows.
export const xBandUser = defineTable({
    tableName: "bandUser",
    tableUniqueName: "BandUser",
    prismaModel: prismaModel<Prisma.BandUserDelegate>(),
    getIdentity: (row: { publicId: BandUserPublicId }) => row.publicId,
    bandScope: { member: "bandId", managePermission: Permission.manage_users },
    readConsistency: "snapshot", deletePolicy: "disabled",
    tableAuthMap: {
        View: Permission.view_users_basic_info,
        ViewOwn: Permission.login,
        Edit: Permission.manage_users,
        EditOwn: Permission.login,
        Insert: Permission.never_grant,
    },
    queryParameters: {},
    getParameterizedWhereClause: (): Prisma.BandUserWhereInput[] => [activeBandMembershipWhere()],
    naturalOrderBy: { publicId: "asc" },
    getSelectionArgs: () => ({
        select: {
            publicId: true,
            userId: true,
            user: { select: { publicId: true, name: true } }
        }
    }),
    getRowInfo: row => ({
        pk: row.publicId,
        name: row.user?.name ?? "",
        ownerUserId: row.userId
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<BandUserPublicId>(),
        isDeleted: columnName => new BoolField({
            columnName, allowNull: false, defaultValue: false,
            specialFunction: SqlSpecialColumnFunction.isDeleted, authMap: kReadOnlyAuthMap
        }),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName,
            allowNull: false,
            allowSearchingThisField: false,
            authMap: defineAuthMap({
                ...kReadOnlyAuthMap,
                PostQuery: Permission.never_grant,
                PostQueryAsOwner: Permission.never_grant
            })
        })),
        user: foreignRef(() => xUserMinimum, {
            fkidMember: "userId", specialFunction: SqlSpecialColumnFunction.ownerUser, authMap: kReadOnlyAuthMap,
        }),
        bandUserInstruments: tagsRef("BandUserInstrument", "BandInstrument", {
            associationLocalObjectMember: "bandUser",
            associationForeignObjectMember: "bandInstrument",
            readVisibility: "association",
            authMap: instrumentAssignments,
            getQuickFilterWhereClause: () => false,
            getCustomFilterWhereClause: () => false,
        }),
        bandUserTagAssignments: tagsRef("BandUserTagAssignment", "BandUserTag", {
            associationLocalObjectMember: "bandUser",
            associationForeignObjectMember: "bandUserTag",
            readVisibility: "association",
            authMap: managerAssignments,
            getQuickFilterWhereClause: () => false,
            getCustomFilterWhereClause: () => false,
        }),
    }),
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandUser: typeof xBandUser;
    }
}
