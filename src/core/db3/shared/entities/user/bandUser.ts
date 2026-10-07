import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import type { BandUserPublicId } from "shared/publicId";
import { defineAuthMap, defineTable, makeColumnSet, prismaModel, SqlSpecialColumnFunction } from "../../db3core";
import { BoolField, foreignRef, MakeCreatedAtField, MakePKfield, MakePublicIdField, tagsRef } from "../../columnTypes/xTableColumnTypes";
import { GenericIntegerField } from "../../columnTypes/genericInteger";
import { serverOwnedField } from "../../columnTypes/inherited";
import { xUserMinimum } from "../../schema/user";
import { kReadOnlyAuthMap } from "../common/entityCommon";
import { xBandRole } from "./bandRoleViews";

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
    viewDeletedPermission: Permission.recover_users,
    tableAuthMap: {
        View: Permission.view_users_basic_info,
        ViewOwn: Permission.login,
        Edit: Permission.manage_users,
        EditOwn: Permission.login,
        Insert: Permission.never_grant,
    },
    queryParameters: {
        personPublicId: {
            kind: "string",
            authorizeAs: "user",
        },
        personPublicIds: { kind: "stringArray", authorizeAs: "user" },
        membershipStatus: { kind: "string", authorizeAs: "isDeleted" },
        tagId: { kind: "entityIdentity", targetTableID: "BandUserTag", authorizeAs: "bandUserTagAssignments" },
        instrumentId: { kind: "entityIdentity", targetTableID: "BandInstrument", authorizeAs: "bandUserInstruments" },
        roleId: { kind: "entityIdentity", targetTableID: "BandRole", authorizeAs: "bandRole", nullable: true },
    },
    getParameterizedWhereClause: (params: {
        personPublicId?: string; personPublicIds?: string[];
        tagId?: number; instrumentId?: number; roleId?: number | null; membershipStatus?: string;
    }, auth): Prisma.BandUserWhereInput[] => {
        const status = z.enum(["active", "inactive"]).parse(params.membershipStatus ?? "active");
        if (status === "inactive") {
            auth.requirePermission(Permission.recover_users);
        }
        // Deleted-row authorization still requires includeDeleted; shared people must remain active.
        const clauses: Prisma.BandUserWhereInput[] = [{
            ...activeBandMembershipWhere(), isDeleted: status === "inactive",
        }];
        if (params.personPublicId !== undefined) {
            // Keep person URLs; the predicate still starts from authorized memberships.
            clauses.push({ user: { publicId: xUserMinimum.parseIdentity(params.personPublicId) } });
        }
        if (params.personPublicIds !== undefined) {
            // An empty participant list must not turn into a whole-band directory query.
            clauses.push({ user: { publicId: { in: params.personPublicIds.map(id => xUserMinimum.parseIdentity(id)) } } });
        }
        if (params.tagId !== undefined) {
            clauses.push({ bandUserTagAssignments: { some: { bandUserTagId: params.tagId } } });
        }
        if (params.instrumentId !== undefined) {
            clauses.push({ bandUserInstruments: { some: { bandInstrumentId: params.instrumentId } } });
        }
        if (params.roleId !== undefined) {
            clauses.push({ bandRoleId: params.roleId });
        }
        return clauses;
    },
    naturalOrderBy: [{ user: { name: "asc" } }, { publicId: "asc" }],
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
        createdAt: () => MakeCreatedAtField({
            authMap: defineAuthMap({
                ...kReadOnlyAuthMap, PostQuery: Permission.manage_users, PostQueryAsOwner: Permission.manage_users,
            })
        }),
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
            sortBy: "name",
            getQuickFilterWhereClause: (query): Prisma.BandUserWhereInput => ({ user: { name: { contains: query } } }),
        }),
        bandRole: foreignRef(() => xBandRole, {
            fkidMember: "bandRoleId",
            allowNull: true,
            authMap: kReadOnlyAuthMap,
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
