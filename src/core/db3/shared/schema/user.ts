import type { UserWithRolesPayload } from "./userPayloads";

import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { Prisma } from "db";
import { assertIsNumberArray } from "shared/arrayUtils";
import { MysqlEscape } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { TAnyModel } from "shared/rootroot";
import { gIconOptions } from "shared/utils";
import { CMDBTableFilterModel, PermissionSignificance } from "../apiTypes";
import { BoolField, ForeignSingleField, GhostField, MakeColorField, MakeCreatedAtField, MakeIconField, MakeIsDeletedField, MakePKfield, MakeSignificanceField, MakeSortOrderField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../genericStringField";
import { PermissionArgs, PermissionForVisibilityArgs, PermissionNaturalOrderBy, PermissionPayload, RoleArgs, RoleNaturalOrderBy, RolePayload, RolePermissionArgs, RolePermissionAssociationPayload, RolePermissionNaturalOrderBy, RoleSignificance, UserInstrumentArgs, UserInstrumentNaturalOrderBy, UserInstrumentPayload, UserMinimumArgs, UserNaturalOrderBy, UserPayload, UserPayloadMinimum, UserSafeArgs, UserTagArgs, UserTagAssignmentArgs, UserTagAssignmentNaturalOrderBy, UserTagAssignmentPayload, UserTagNaturalOrderBy, UserTagPayload, UserTagSignificance, UserWithInstrumentsArgs } from "./prismArgs";

// Basic profile data is self-service for the account owner and readable for
// other users only through the explicit member-profile capability.
export const xUserBasicProfileAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.login,
    PostQuery: Permission.view_users_basic_info,
    PreMutateAsOwner: Permission.login,
    PreMutate: Permission.manage_users,
    PreInsert: Permission.manage_users,
} as const;

// Tags and other manager-owned profile fields remain readable as basic profile
// data, but owning the account does not grant write access.
export const xUserBasicProfileManagerWriteAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.login,
    PostQuery: Permission.view_users_basic_info,
    PreMutateAsOwner: Permission.manage_users,
    PreMutate: Permission.manage_users,
    PreInsert: Permission.manage_users,
} as const;

// User presentation metadata follows basic-profile visibility while taxonomy
// managers retain its distinct write authority.
export const xUserPresentationMetadataAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.login,
    PostQuery: Permission.view_users_basic_info,
    PreMutateAsOwner: Permission.manage_user_taxonomy,
    PreMutate: Permission.manage_user_taxonomy,
    PreInsert: Permission.manage_user_taxonomy,
} as const;

// Taxonomy definitions must be available when an authenticated user views or
// edits their own profile; assignments still use the profile maps above.
const xUserTaxonomyDefinitionAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.login,
    PostQuery: Permission.login,
    PreMutateAsOwner: Permission.manage_user_taxonomy,
    PreMutate: Permission.manage_user_taxonomy,
    PreInsert: Permission.manage_user_taxonomy,
} as const;

// Contact information has a separate non-owner read capability. Phone remains
// self-editable; email writes are owned by dedicated account-maintenance flows.
const xUserContactInfoAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.login,
    PostQuery: Permission.view_user_contact_info,
    PreMutateAsOwner: Permission.login,
    PreMutate: Permission.manage_users,
    PreInsert: Permission.manage_users,
} as const;

const xUserEmailAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.login,
    PostQuery: Permission.view_user_contact_info,
    PreMutateAsOwner: Permission.sysadmin,
    PreMutate: Permission.sysadmin,
    PreInsert: Permission.sysadmin,
} as const;

// Operational account metadata is visible to user maintainers. Its mutation
// authority stays separate and is enforced by existing dedicated flows.
const xUserOperationalMetadataAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.manage_users,
    PostQuery: Permission.manage_users,
    PreMutateAsOwner: Permission.sysadmin,
    PreMutate: Permission.sysadmin,
    PreInsert: Permission.sysadmin,
} as const;

// Raw authentication fields remain unavailable to generic DB3 queries. These
// virtual fields centralize authorization for the coarse sign-in summary and
// sign-in-email search. Global search uses PostQuery, so only user maintainers
// can search another account's sign-in email.
const xUserSignInMetadataAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.login,
    PostQuery: Permission.manage_users,
    PreMutateAsOwner: Permission.never_grant,
    PreMutate: Permission.never_grant,
    PreInsert: Permission.never_grant,
} as const;

// Permission and role tables are Sysadmin-only at table level. The visibility
// selector variant deliberately exposes their display metadata after login.
const xPermissionMetadataAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.login,
    PostQuery: Permission.login,
    PreMutateAsOwner: Permission.sysadmin,
    PreMutate: Permission.sysadmin,
    PreInsert: Permission.sysadmin,
} as const;

// These fields are owned by dedicated authentication/calendar flows. Keep
// them known to request validation so crafted writes fail as unauthorized
// rather than falling through as unknown fields.
const denyGenericUserAuthenticationField = (): boolean => false;

type BuiltInRoleFlag = "isRoleForNewUsers" | "isPublicRole" | "isSysAdminRole";

// Built-in role designations are reassigned through one dedicated transaction.
// Generic creation may only create an ordinary, unassigned role.
const authorizeBuiltInRoleFlag = (flag: BuiltInRoleFlag) => (
    args: db3.DB3AuthorizeAndSanitizeInput<TAnyModel>,
): boolean => {
    if (args.rowMode === "view") return true;
    return args.rowMode === "new" && args.model?.[flag] === false;
};


export const xUserTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.login,
    View: Permission.view_users_basic_info,
    EditOwn: Permission.login,
    Edit: Permission.manage_users,
    Insert: Permission.manage_users,
} as const;

const xUserTableAuthMap_SysadminInsert: db3.DB3AuthTablePermissionMap = {
    ...xUserTableAuthMap,
    // User creation is self-signup or Sysadmin maintenance.
    Insert: Permission.sysadmin,
} as const;

export const xUserTaxonomyTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.login,
    View: Permission.login,
    EditOwn: Permission.manage_user_taxonomy,
    Edit: Permission.manage_user_taxonomy,
    Insert: Permission.manage_user_taxonomy,
} as const;

export const xPermissionTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.sysadmin,
    View: Permission.sysadmin,
    EditOwn: Permission.sysadmin,
    Edit: Permission.sysadmin,
    Insert: Permission.sysadmin,
} as const;

const xVisibilityPermissionTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.login,
    View: Permission.login,
    EditOwn: Permission.sysadmin,
    Edit: Permission.sysadmin,
    Insert: Permission.sysadmin,
} as const;


export const xUserMinimum = new db3.xTable({
    getSelectionArgs: (): Prisma.UserDefaultArgs => {
        return UserMinimumArgs;
    },
    tableName: "User",
    deletePolicy: "disabled", // deletion is performed through a dedicated mutation.
    queryParameters: {
        userId: { kind: "integer", authorizeAs: "id" },
    },
    naturalOrderBy: UserNaturalOrderBy,
    getRowInfo: (row: UserPayloadMinimum) => ({
        pk: row.id,
        name: row.name,
        ownerUserId: row.id,
    }),
    tableAuthMap: xUserTableAuthMap_SysadminInsert,

    // note: self-sign-up is not part of this; it doesn't use db3 auth.
    // 
    // col:              QueryOwn       Query                   MutateOwn       Mutate            insert***
    // 			-----------------------------------------------------------------------------------------------------------------
    // id             |  login          view_users_basic_info   #               #                 #             |   PK + table map
    // name           |  login          view_users_basic_info   login           manage_users      sysadmin*     |   xUserBasicProfileAuthMap
    // email          |  login          view_user_contact_info  sysadmin        sysadmin          sysadmin*     |   dedicated correction after insert
    // phone          |  login          view_user_contact_info  login           manage_users      sysadmin*     |   xUserContactInfoAuthMap
    // auth fields    |  #              #               #               #                 #             |   dedicated auth/calendar flows only

    // isDeleted      |  manage_users   manage_users            sysadmin        sysadmin          sysadmin*     |   xUserOperationalMetadataAuthMap
    // createdAt      |  manage_users   manage_users            #               #                 sysadmin*     |   xUserOperationalMetadataAuthMap
    // role           |  manage_users   manage_users            sysadmin        sysadmin          sysadmin*     |   xUserOperationalMetadataAuthMap
    // isSysAdmin     |  manage_users   manage_users            sysadmin        sysadmin          sysadmin*     |   xUserOperationalMetadataAuthMap

    // * The table-level insert grant is sysadmin; self-sign-up uses its dedicated flow.

    getParameterizedWhereClause: (params: { userId?: number }): (Prisma.UserWhereInput[] | false) => {
        if (params.userId != null) {
            return [{
                id: { equals: params.userId }
            }];
        }
        return false;
    },
    columns: [
        MakePKfield({ isRowOwner: true }),
        MakeCreatedAtField({ authMap: xUserOperationalMetadataAuthMap }),
        MakeIsDeletedField({ authMap: xUserOperationalMetadataAuthMap }),

        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "title",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xUserBasicProfileAuthMap,
        }),
        new GenericStringField({
            columnName: "email",
            allowNull: false,
            format: "email",
            //_customAuth: authorizeUserLoginEmail,
            authMap: xUserEmailAuthMap,
        }),
        new GenericStringField({
            columnName: "phone",
            allowNull: true,
            format: "plain",
            authMap: xUserContactInfoAuthMap,
        }),
        new BoolField({
            columnName: "isSysAdmin",
            defaultValue: false,
            authMap: xUserOperationalMetadataAuthMap,
            allowNull: false,
        }),
        new GhostField({ memberName: "hashedPassword", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "signInMethods", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "mergedIntoUserId", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "mergedAt", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "calendarFeedToken", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "accessToken", _customAuth: denyGenericUserAuthenticationField }), // rejected legacy field name
        new GhostField({ memberName: "uid", _customAuth: denyGenericUserAuthenticationField }),
    ]
});




export const xPermissionBaseArgs: db3.TableDesc = {
    getSelectionArgs: (): Prisma.PermissionDefaultArgs => {
        return PermissionArgs;
    },
    tableName: "Permission",
    deletePolicy: "disabled",
    naturalOrderBy: PermissionNaturalOrderBy,
    tableAuthMap: xPermissionTableAuthMap,
    getRowInfo: (row: PermissionPayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description || "",
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xPermissionMetadataAuthMap,
        }),
        MakeDescriptionField({ authMap: xPermissionMetadataAuthMap }),
        MakeSortOrderField({ authMap: xPermissionMetadataAuthMap }),
        new BoolField({
            columnName: "isVisibility",
            defaultValue: false,
            authMap: xPermissionMetadataAuthMap,
            allowNull: false,
        }),
        MakeSignificanceField("significance", PermissionSignificance, { authMap: xPermissionMetadataAuthMap }),
        MakeColorField({ authMap: xPermissionMetadataAuthMap }),
        MakeIconField("iconName", gIconOptions, { authMap: xPermissionMetadataAuthMap }),
        new TagsField<RolePermissionAssociationPayload>({
            columnName: "roles",
            associationForeignIDMember: "roleId",
            associationForeignObjectMember: "role",
            associationLocalIDMember: "permissionId",
            associationLocalObjectMember: "permission",
            associationTableID: "RolePermission",
            foreignTableID: "Role",
            getCustomFilterWhereClause: (query: CMDBTableFilterModel) => false,
            getQuickFilterWhereClause: (query: string): Prisma.PermissionWhereInput | boolean => false,
            authMap: xPermissionMetadataAuthMap,
        }),

    ]
};

export const xPermission = new db3.xTable(xPermissionBaseArgs);

export const xPermissionForVisibility = new db3.xTable({
    ...xPermissionBaseArgs,
    tableUniqueName: "xPermissionForVisibility",
    tableAuthMap: xVisibilityPermissionTableAuthMap,
    getSelectionArgs: () => PermissionForVisibilityArgs,
    queryParameters: {},
    getParameterizedWhereClause: (params: { userId?: number }, publicData: db3.DB3Authorization): Prisma.PermissionWhereInput[] => {
        return [
            {
                isVisibility: {
                    equals: true
                }
            },
            {
                // when you are selecting a visibility permission it makes no sense to include visibilities you can't see yourself.
                id: { in: publicData.effectivePermissions.ids }
            }
        ];
    },
});


// if we think of role-permission as tags relationship,
// then roles are the local object, and permissions are the foreign tags object.

// this schema is required for tags selection dlg.
export const xRolePermissionAssociation = new db3.xTable({
    tableName: "RolePermission",
    deletePolicy: "disabled",
    getSelectionArgs: (): Prisma.RolePermissionDefaultArgs => {
        return RolePermissionArgs;
    },
    tableAuthMap: xPermissionTableAuthMap,
    naturalOrderBy: RolePermissionNaturalOrderBy,
    getRowInfo: (row: RolePermissionAssociationPayload) => ({
        pk: row.id,
        name: row.permission?.name || "",
        description: row.permission?.description || "",
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        new ForeignSingleField<PermissionPayload>({
            columnName: "permission",
            fkidMember: "permissionId",
            allowNull: false,
            foreignTableID: "Permission",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xPermissionMetadataAuthMap,
        }),
        new ForeignSingleField<RolePayload>({
            columnName: "role",
            fkidMember: "roleId",
            allowNull: false,
            foreignTableID: "Role",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xPermissionMetadataAuthMap,
        }),
    ]
});

////////////////////////////////////////////////////////////////

export const xRole = new db3.xTable({
    getSelectionArgs: (): Prisma.RoleDefaultArgs => {
        return RoleArgs;
    },
    tableName: "Role",
    deletePolicy: "disabled",
    tableAuthMap: xPermissionTableAuthMap,
    naturalOrderBy: RoleNaturalOrderBy,
    createInsertModelFromString: (input: string): Prisma.RoleCreateInput => {
        return {
            name: input,
            description: "auto-created",
            sortOrder: 0,
        };
    },
    getRowInfo: (row: RolePayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description || "",
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xPermissionMetadataAuthMap,
        }),
        MakeDescriptionField({ authMap: xPermissionMetadataAuthMap }),
        new BoolField({
            columnName: "isRoleForNewUsers",
            defaultValue: false,
            _customAuth: authorizeBuiltInRoleFlag("isRoleForNewUsers"),
            allowNull: false,
        }),
        new BoolField({
            columnName: "isPublicRole",
            defaultValue: false,
            _customAuth: authorizeBuiltInRoleFlag("isPublicRole"),
            allowNull: false,
        }),
        new BoolField({
            columnName: "isSysAdminRole",
            defaultValue: false,
            _customAuth: authorizeBuiltInRoleFlag("isSysAdminRole"),
            allowNull: false,
        }),
        MakeSortOrderField({ authMap: xPermissionMetadataAuthMap }),
        MakeColorField({ authMap: xPermissionMetadataAuthMap }),
        MakeSignificanceField("significance", RoleSignificance, { authMap: xPermissionMetadataAuthMap }),
        new TagsField<RolePermissionAssociationPayload>({
            columnName: "permissions",
            associationForeignIDMember: "permissionId",
            associationForeignObjectMember: "permission",
            associationLocalIDMember: "roleId",
            associationLocalObjectMember: "role",
            associationTableID: "RolePermission",
            foreignTableID: "Permission",
            authMap: xPermissionMetadataAuthMap,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.InstrumentWhereInput | boolean => false,
            getQuickFilterWhereClause: (query: string): Prisma.RoleWhereInput => ({
                permissions: {
                    some: {
                        permission: {
                            name: { contains: query }
                        }
                    }
                }
            }),
        }),
    ]
});





export const xUserInstrument = new db3.xTable({
    tableName: "UserInstrument",
    deletePolicy: "hard",
    tableAuthMap: xUserTableAuthMap,
    getSelectionArgs: (): Prisma.UserInstrumentDefaultArgs => {
        return UserInstrumentArgs;
    },
    naturalOrderBy: UserInstrumentNaturalOrderBy,
    getRowInfo: (row: UserInstrumentPayload) => {
        return {
            pk: row.id,
            name: row.instrument?.name || "",
            description: row.instrument?.description || "",
            color: gGeneralPaletteList.findEntry(row.instrument?.functionalGroup?.color || null),
            ownerUserId: row.userId,
        };
    },
    columns: [
        MakePKfield(),
        new BoolField({ columnName: "isPrimary", defaultValue: false, authMap: xUserBasicProfileAuthMap, allowNull: false }),
        new ForeignSingleField<Prisma.UserInstrumentGetPayload<{}>>({ // tags field should include the foreign object (tag object)
            columnName: "instrument",
            fkidMember: "instrumentId",
            allowNull: false,
            foreignTableID: "Instrument",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xUserBasicProfileAuthMap,
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({ // tags field should include the foreign object (tag object)
            columnName: "user",
            fkidMember: "userId",
            allowNull: false,
            foreignTableID: "user",
            specialFunction: db3.SqlSpecialColumnFunction.ownerUser,
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xUserBasicProfileAuthMap,
        }),
        // don't include local object because of dependencies / redundancy issues
    ]
});








////////////////////////////////////////////////////////////////


export interface UserTagTableParams {
    userTagId?: number;
    ids?: number[];
};


const userTagBaseArgs: db3.TableDesc =
{
    getSelectionArgs: (): Prisma.UserTagDefaultArgs => {
        return UserTagArgs;
    },
    tableName: "UserTag",
    deletePolicy: "hard",
    queryParameters: {
        userTagId: { kind: "integer", authorizeAs: "id" },
        ids: { kind: "integerArray", authorizeAs: "id" },
    },
    tableAuthMap: xUserTaxonomyTableAuthMap,
    naturalOrderBy: UserTagNaturalOrderBy,
    getParameterizedWhereClause: (params: UserTagTableParams): (Prisma.UserTagWhereInput[] | false) => {
        const ret: Prisma.UserTagWhereInput[] = [];

        if (params.userTagId != null) {
            ret.push({ id: params.userTagId, });
        }
        if (params.ids !== undefined) {
            assertIsNumberArray(params.ids);
            if (params.ids.length > 0) {
                const t: Prisma.UserTagWhereInput = {
                    id: { in: params.ids }
                };
                ret.push(t);
            }
        }
        return ret;
    },
    createInsertModelFromString: (input: string): Prisma.UserTagCreateInput => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
            significance: null,
        };
    },
    getRowInfo: (row: UserTagPayload) => ({
        pk: row.id,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        MakeTitleField("text", { authMap: xUserTaxonomyDefinitionAuthMap }),
        MakeDescriptionField({ authMap: xUserTaxonomyDefinitionAuthMap }),
        MakeSortOrderField({ authMap: xUserTaxonomyDefinitionAuthMap }),
        MakeColorField({ authMap: xUserTaxonomyDefinitionAuthMap }),
        new GenericStringField({
            columnName: "cssClass",
            allowNull: true,
            format: "raw",
            authMap: xUserTaxonomyDefinitionAuthMap,
        }),
        MakeSignificanceField("significance", UserTagSignificance, { authMap: xUserTaxonomyDefinitionAuthMap }),
        new GhostField({ memberName: "userAssignments", authMap: xUserTaxonomyDefinitionAuthMap }),
    ]
};

export const xUserTag = new db3.xTable(userTagBaseArgs);






export const UserTagForEventSearchArgs = Prisma.validator<Prisma.UserTagDefaultArgs>()({
    include: {
        userAssignments: true,
    }
});

export type EventResponses_ExpectedUserTag = Prisma.UserTagGetPayload<{
    select: {
        id: true,
        userAssignments: {
            select: {
                userId,
            }
        }
    }
}>;

export const xUserTagForEventSearch = new db3.xTable({
    ...userTagBaseArgs,
    tableUniqueName: "xUserTagForEventSearch",
    getSelectionArgs: (): Prisma.UserTagDefaultArgs => {
        return UserTagForEventSearchArgs;
    },
});


















export const xUserTagAssignment = new db3.xTable({
    tableName: "UserTagAssignment",
    deletePolicy: "hard",
    naturalOrderBy: UserTagAssignmentNaturalOrderBy,
    tableAuthMap: {
        ...xUserTableAuthMap,
        EditOwn: Permission.manage_users,
    },
    getSelectionArgs: (): Prisma.UserTagAssignmentDefaultArgs => {
        return UserTagAssignmentArgs;
    },
    getRowInfo: (row: UserTagAssignmentPayload) => {
        return {
            pk: row.id,
            name: row.userTag?.text || "",
            description: row.userTag?.description || "",
            color: gGeneralPaletteList.findEntry(row.userTag?.color || null),
            ownerUserId: row.userId,
        };
    }
    ,
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.UserTagGetPayload<{}>>({
            columnName: "userTag",
            fkidMember: "userTagId",
            allowNull: false,
            foreignTableID: "UserTag",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xUserBasicProfileManagerWriteAuthMap,
        }),
        new GhostField({
            memberName: "userId",
            specialFunction: db3.SqlSpecialColumnFunction.ownerUser,
            authMap: xUserBasicProfileManagerWriteAuthMap,
        }),
    ]
});




////////////////////////////////////////////////////////////////
const MakeUserSignInEmailSearchField = () => {
    const field = new GhostField({
        memberName: "signInEmailSearch",
        authMap: xUserSignInMetadataAuthMap,
    });

    // compile-time type safety for the sql filter.
    const STATIC_CHECK: Prisma.UserSignInMethodScalarWhereInput = {
        type: { equals: 'email' },
        identifier: { contains: '' },
        userId: { equals: 0 },
    };

    field.SqlGetQuickFilterElementsForToken = (token: string): string => `EXISTS (
        SELECT 1
        FROM UserSignInMethod signInMethod
        WHERE signInMethod.userId = P.id
          AND signInMethod.type = 'email'
          AND signInMethod.identifier LIKE '%${MysqlEscape(token)}%'
    )`;
    return field;
};

////////////////////////////////////////////////////////////////
export interface UserTablParams {
    userId?: number;
    userIds?: number[];
};

const userBaseArgs: db3.TableDesc = {
    getSelectionArgs: (): Prisma.UserDefaultArgs => {
        return UserSafeArgs;
    },
    tableName: "User",
    deletePolicy: "disabled",
    viewDeletedPermission: Permission.recover_users,
    searchCapabilities: { includeDeleted: true },
    queryParameters: {
        userId: { kind: "integer", authorizeAs: "id" },
        userIds: { kind: "integerArray", authorizeAs: "id" },
    },
    tableAuthMap: xUserTableAuthMap_SysadminInsert,
    naturalOrderBy: UserNaturalOrderBy,
    getRowInfo: (row: UserPayload) => ({
        pk: row.id,
        name: row.name,
        ownerUserId: row.id,
    }),
    getParameterizedWhereClause: (params: UserTablParams): Prisma.UserWhereInput[] => {
        const ret: Prisma.UserWhereInput[] = [];
        if (params.userId != null) {
            ret.push({ id: { equals: params.userId } });
        }
        if (params.userIds !== undefined) {
            assertIsNumberArray(params.userIds);
            if (params.userIds.length > 0) {
                const t: Prisma.UserWhereInput = {
                    id: { in: params.userIds }
                };
                ret.push(t);
            }
        }
        return ret;
    },
    columns: [
        MakePKfield({ isRowOwner: true }),
        MakeIsDeletedField({ authMap: xUserOperationalMetadataAuthMap }),
        MakeCreatedAtField({ authMap: xUserOperationalMetadataAuthMap }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "title",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xUserBasicProfileAuthMap,
        }),
        new GenericStringField({
            columnName: "email",
            allowNull: false,
            format: "email",
            authMap: xUserEmailAuthMap,
        }),
        new GenericStringField({
            columnName: "phone",
            allowNull: true,
            format: "plain",
            authMap: xUserContactInfoAuthMap,
        }),
        new GenericStringField({
            columnName: "cssClass",
            allowNull: true,
            format: "raw",
            authMap: xUserPresentationMetadataAuthMap,
        }),
        new BoolField({
            columnName: "isSysAdmin",
            defaultValue: false,
            authMap: xUserOperationalMetadataAuthMap,
            allowNull: false,
        }),
        new ForeignSingleField<Prisma.RoleGetPayload<{}>>({
            columnName: "role",
            allowNull: true,
            fkidMember: "roleId",
            foreignTableID: "Role",
            authMap: xUserOperationalMetadataAuthMap,
            getQuickFilterWhereClause: (query: string): Prisma.RoleWhereInput => ({
                OR: [
                    { name: { contains: query } },
                    //{ description: { contains: query } },
                ]
            }),
        }),
        new TagsField<UserInstrumentPayload>({
            columnName: "instruments",
            associationForeignIDMember: "instrumentId",
            associationForeignObjectMember: "instrument",
            associationLocalIDMember: "userId",
            associationLocalObjectMember: "user",
            associationTableID: "UserInstrument",
            foreignTableID: "Instrument",
            authMap: xUserBasicProfileAuthMap,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.InstrumentWhereInput | boolean => false,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new TagsField<UserTagAssignmentPayload>({
            columnName: "tags",
            associationForeignIDMember: "userTagId",
            associationForeignObjectMember: "userTag",
            associationLocalIDMember: "userId",
            associationLocalObjectMember: "user",
            associationTableID: "UserTagAssignment",
            foreignTableID: "UserTag",
            authMap: xUserBasicProfileManagerWriteAuthMap, // tags affect invitations, so owners may view but only managers may edit them.
            getQuickFilterWhereClause: (query: string): Prisma.UserWhereInput => ({
                tags: {
                    some: {
                        userTag: {
                            text: {
                                contains: query
                            }
                        }
                    }
                }
            }),
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.UserWhereInput | boolean => {
                // see events tagIds on how to filter by this field.
                return false;
            },
        }), // column: tags

        new GhostField({ memberName: "signInMethods", _customAuth: denyGenericUserAuthenticationField }),

        // this is not a real db column but allows us to attach auth maps to arbitrary
        // queries like getUserExtraInfo
        new GhostField({ memberName: "signInMethodSummary", authMap: xUserSignInMetadataAuthMap }),

        MakeUserSignInEmailSearchField(),
        new GhostField({ memberName: "mergedIntoUserId", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "mergedAt", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "hashedPassword", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "calendarFeedToken", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "accessToken", _customAuth: denyGenericUserAuthenticationField }), // rejected legacy field name
        new GhostField({ memberName: "uid", _customAuth: denyGenericUserAuthenticationField }),
    ]
};

export const xUser = new db3.xTable(userBaseArgs);


export const xUserWithInstrument = new db3.xTable({
    ...userBaseArgs,
    tableUniqueName: "xUserWithInstrument",
    getSelectionArgs: (): Prisma.UserDefaultArgs => {
        return UserWithInstrumentsArgs;
    },
});



// let's create a "created by" field which is a specialization of ForeignSingle, specialized to User payload
// automatically populated with current user on creation (see ApplyToNewRow)
export type CreatedByUserFieldArgs = {
    columnName?: string; // "instrumentType"
    fkidMember?: string; // "instrumentTypeId"
    specialFunction?: db3.SqlSpecialColumnFunction;
    authMap?: db3.DB3AuthContextPermissionMap;
    _customAuth?: (args: db3.DB3AuthorizeAndSanitizeInput<TAnyModel>) => boolean;
};

export class CreatedByUserField extends ForeignSingleField<UserPayload> {
    constructor(args: CreatedByUserFieldArgs) {
        super({
            columnName: args.columnName || "createdByUser",
            fkidMember: args.fkidMember || "createdByUserId",
            foreignTableID: "User",
            allowNull: true,
            specialFunction: args.specialFunction || db3.SqlSpecialColumnFunction.createdByUser,
            getQuickFilterWhereClause: () => false,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });
    }
    ApplyToNewRow = (args: TAnyModel, currentUser: UserWithRolesPayload | null) => {
        args[this.member] = currentUser;
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: db3.DB3RowMode, currentUser?: UserWithRolesPayload | null) => {
        if (mode === "new") {
            dbModel[this.member] = currentUser;
            return;
        }
        if (dbModel[this.member] === undefined) return;
        clientModel[this.member] = dbModel[this.member];
    }
};

export const MakeCreatedByField = (args?: CreatedByUserFieldArgs) => (
    new CreatedByUserField(args || {})
);

export const MakeUpdatedByField = (args?: CreatedByUserFieldArgs) => (
    new CreatedByUserField({
        specialFunction: db3.SqlSpecialColumnFunction.updatedByUser,
        columnName: "updatedByUser",
        fkidMember: "updatedByUserId",
        ...args || {},
    })
);


// let's create a "visiblePermission" column which is ForeignSingle for a permission, but only for "visibility" permissions.
// in theory this will apply a filter over permissions for isVisibility = TRUE; however that is already done in a different way.
export type VisiblePermissionFieldArgs = {
    columnName?: string; // "visiblePermission"
    fkMember?: string; // "visiblePermissionId"
} & db3.DB3AuthSpec;

export class VisiblePermissionField extends ForeignSingleField<PermissionPayload> {
    constructor(args: VisiblePermissionFieldArgs) {
        super({
            columnName: args.columnName || "visiblePermission",
            fkidMember: args.fkMember || "visiblePermissionId",
            foreignTableID: "xPermissionForVisibility",
            specialFunction: db3.SqlSpecialColumnFunction.visiblePermission,
            allowNull: true,
            getQuickFilterWhereClause: () => false,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });
    }
};

export const MakeVisiblePermissionField = (args: db3.DB3AuthSpec) => (
    new VisiblePermissionField(args)
);
