import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { MysqlEscape } from "shared/mysqlUtils";
import type { BandUserPublicId } from "shared/publicId";
import { defineAuthMap, defineTable, makeColumnSet, prismaModel, SqlSpecialColumnFunction } from "../../db3core";
import { BoolField, GhostField, foreignRef, MakeCreatedAtField, MakePKfield, MakePublicIdField, tagsRef } from "../../columnTypes/xTableColumnTypes";
import { GenericIntegerField } from "../../columnTypes/genericInteger";
import { serverOwnedField } from "../../columnTypes/inherited";
import { xUserMinimum, xUserContactInfoAuthMap, xUserEmailAuthMap } from "../../schema/user";
import { getEmailSignInSearchExpression } from "../../schema/userSignInMethod";
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

/** Search-only fields borrow the shared person's field policy; no contact data is stored on membership. */
function personSearchField(
    memberName: string,
    personField: typeof xUserMinimum.fields.email | typeof xUserMinimum.fields.phone,
    authMap: typeof xUserEmailAuthMap | typeof xUserContactInfoAuthMap,
): GhostField {
    const field = new GhostField({
        memberName, authMap,
    });
    // Resolve the relation after its table has initialized; its FK is declared only there.
    field.SqlGetQuickFilterElementsForToken = token => {
        const relation = xBandUser.fields.user;
        const person = relation.getForeignTableSchema();
        return `EXISTS (SELECT 1 FROM ${person.sqlTableName} SU WHERE SU.${person.pkMember} = P.${relation.fkidMember} AND SU.${personField.member} LIKE '%${MysqlEscape(token)}%')`;
    };
    return field;
}

function memberSignInEmailSearchField(memberName: string): GhostField {
    const field = new GhostField({
        memberName,
        authMap: defineAuthMap({ ...kReadOnlyAuthMap, PostQuery: Permission.sysadmin, PostQueryAsOwner: Permission.sysadmin }),
    });
    field.SqlGetQuickFilterElementsForToken = token => getEmailSignInSearchExpression(token, `P.${xBandUser.fields.user.fkidMember}`);
    return field;
}

function memberPersonField(memberName: string) {
    const field = foreignRef(() => xUserMinimum, {
        fkidMember: "userId", specialFunction: SqlSpecialColumnFunction.ownerUser, authMap: kReadOnlyAuthMap,
        requireVisibleTarget: true, sortBy: "name",
        getQuickFilterWhereClause: (query): Prisma.BandUserWhereInput => ({ user: { name: { contains: query } } }),
    })(memberName);
    field.SqlGetQuickFilterElementsForToken = token => {
        const person = field.getForeignTableSchema();
        return `EXISTS (SELECT 1 FROM ${person.sqlTableName} SU WHERE SU.${person.pkMember} = P.${field.fkidMember} AND SU.${xUserMinimum.fields.name.member} LIKE '%${MysqlEscape(token)}%')`;
    };
    return field;
}

export const xBandUser = defineTable({
    tableName: "bandUser",
    tableUniqueName: "BandUser",
    prismaModel: prismaModel<Prisma.BandUserDelegate>(),
    getIdentity: (row: { publicId: BandUserPublicId }) => row.publicId,
    bandScope: { member: "bandId", managePermission: Permission.manage_users },
    readConsistency: "snapshot", deletePolicy: "disabled",
    viewDeletedPermission: Permission.recover_users,
    searchCapabilities: { includeDeleted: true },
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
        membershipIds: { kind: "stringArray", authorizeAs: "publicId" },
        membershipStatus: { kind: "string", authorizeAs: "isDeleted" },
        tagId: { kind: "entityIdentity", targetTableID: "BandUserTag", authorizeAs: "bandUserTagAssignments" },
        instrumentId: { kind: "entityIdentity", targetTableID: "BandInstrument", authorizeAs: "bandUserInstruments" },
        roleId: { kind: "entityIdentity", targetTableID: "BandRole", authorizeAs: "bandRole", nullable: true },
    },
    getParameterizedWhereClause: (params: {
        personPublicId?: string; personPublicIds?: string[];
        membershipIds?: string[];
        tagId?: number; instrumentId?: number; roleId?: number | null; membershipStatus?: string;
    }, auth): Prisma.BandUserWhereInput[] => {
        const status = params.membershipStatus === undefined ? undefined : z.enum(["active", "inactive"]).parse(params.membershipStatus);
        if (status === "inactive") {
            auth.requirePermission(Permission.recover_users);
        }
        // Deleted-row authorization still requires includeDeleted; shared people must remain active.
        const clauses: Prisma.BandUserWhereInput[] = [{
            // LSMB todo: this is a design problem.
            // 1. this table def should not be responsible for enforcing user entity policies.
            // 2. table defs are not meant to enforce this anyway; db3 has built-in routines for visibility / auth.
            // code like this gives the false impression that if the user entity changes policies,
            // everywhere it's used needs to be updated. those policies should be described on the user entity only,
            // and enforced through db3.
            user: {
                isDeleted: false,
                mergedIntoUserId: null,
            }
        }];
        if (status !== undefined) {
            clauses.push({ isDeleted: status === "inactive" });
        }
        if (params.personPublicId !== undefined) {
            // Keep person URLs; the predicate still starts from authorized memberships.
            clauses.push({ user: { publicId: xUserMinimum.parseIdentity(params.personPublicId) } });
        }
        if (params.personPublicIds !== undefined) {
            // An empty participant list must not turn into a whole-band directory query.
            clauses.push({ user: { publicId: { in: params.personPublicIds.map(id => xUserMinimum.parseIdentity(id)) } } });
        }
        if (params.membershipIds !== undefined) {
            clauses.push({ publicId: { in: params.membershipIds.map(id => xBandUser.parseIdentity(id)) } });
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
        user: memberPersonField,
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

        // synthetic fields to aide search functionality.
        // lsmb todo: evaluate whether this is a design risk. fields in this list are meant to directly
        // represent db schema fields.
        emailSearch: memberName => personSearchField(memberName, xUserMinimum.fields.email, xUserEmailAuthMap),
        phoneSearch: memberName => personSearchField(memberName, xUserMinimum.fields.phone, xUserContactInfoAuthMap),
        signInEmailSearch: memberSignInEmailSearchField,
    }),
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandUser: typeof xBandUser;
    }
}
