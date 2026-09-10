
import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { Prisma } from "db";
import { assertIsNumberArray } from "shared/arrayUtils";
import { Permission, gPublicPermissions } from "shared/permissions";
import { TAnyModel } from "shared/rootroot";
import { gIconOptions } from "shared/utils";
import { CMDBTableFilterModel, PermissionSignificance } from "../apiTypes";
import { BoolField, ForeignSingleField, GhostField, MakeColorField, MakeCreatedAtField, MakeIconField, MakeIsDeletedField, MakePKfield, MakeSignificanceField, MakeSortOrderField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../genericStringField";
import { PermissionArgs, PermissionForVisibilityArgs, PermissionNaturalOrderBy, PermissionPayload, RoleArgs, RoleNaturalOrderBy, RolePayload, RolePermissionArgs, RolePermissionAssociationPayload, RolePermissionNaturalOrderBy, RoleSignificance, UserInstrumentArgs, UserInstrumentNaturalOrderBy, UserInstrumentPayload, UserMinimumArgs, UserNaturalOrderBy, UserPayload, UserPayloadMinimum, UserSafeArgs, UserTagArgs, UserTagAssignmentArgs, UserTagAssignmentNaturalOrderBy, UserTagAssignmentPayload, UserTagNaturalOrderBy, UserTagPayload, UserTagSignificance, UserWithInstrumentsArgs } from "./prismArgs";

// for basic user fields.
// everyone can view
// only you can edit your own data
// user managers can edit others' data
export const xUserAuthMap_R_EOwn_EManagers: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.basic_trust,
    PostQuery: Permission.basic_trust,
    PreMutateAsOwner: Permission.basic_trust,
    PreMutate: Permission.manage_users,
    PreInsert: Permission.manage_users,
} as const;

// readable by everyone, editable by managers only (cannot edit own)
export const xUserAuthMap_R_EManagers: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.basic_trust,
    PostQuery: Permission.basic_trust,
    PreMutateAsOwner: Permission.manage_users,
    PreMutate: Permission.manage_users,
    PreInsert: Permission.manage_users,
} as const;

// readable by everyone, editable by admins only (cannot edit own)
export const xUserAuthMap_R_EAdmins: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.basic_trust,
    PostQuery: Permission.basic_trust,
    PreMutateAsOwner: Permission.admin_users,
    PreMutate: Permission.admin_users,
    PreInsert: Permission.admin_users,
} as const;

// Account lifecycle, role membership, and the superuser flag use dedicated
// mutations. Generic User tables may display them but never change them.
const authorizeUserSecurityFieldViewOnly = (args: db3.DB3AuthorizeAndSanitizeInput<TAnyModel>): boolean => {
    if (args.rowMode !== "view") return false;
    if (args.publicData.isSysAdmin) return true;
    return (args.publicData.permissions || gPublicPermissions).includes(Permission.basic_trust);
};

// Email is a login identifier, not an ordinary profile field. An actual
// Sysadmin may supply it when creating a maintenance account, but corrections
// to an existing account use the dedicated correctUserEmail mutation.
const authorizeUserLoginEmail = (args: db3.DB3AuthorizeAndSanitizeInput<TAnyModel>): boolean => {
    if (args.rowMode === "new") return args.publicData.isSysAdmin === true;
    return authorizeUserSecurityFieldViewOnly(args);
};

// These fields are owned by dedicated authentication/calendar flows. Keep
// them known to request validation so crafted writes fail as unauthorized
// rather than falling through as unknown fields.
const denyGenericUserAuthenticationField = (): boolean => false;

type BuiltInRoleFlag = "isRoleForNewUsers" | "isPublicRole";

// Built-in role designations are reassigned through one dedicated transaction.
// Generic creation may only create an ordinary, unassigned role.
const authorizeBuiltInRoleFlag = (flag: BuiltInRoleFlag) => (
    args: db3.DB3AuthorizeAndSanitizeInput<TAnyModel>,
): boolean => {
    if (args.rowMode === "view") return true;
    return args.rowMode === "new" && args.model?.[flag] === false;
};


export const xUserTableAuthMap_R_EManagers: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.basic_trust,
    View: Permission.basic_trust,
    EditOwn: Permission.basic_trust,
    Edit: Permission.manage_users,
    Insert: Permission.manage_users,
} as const;

const xUserTableAuthMap_R_EManagers_ActualSysadminInsert: db3.DB3AuthTablePermissionMap = {
    ...xUserTableAuthMap_R_EManagers,
    // User creation is self-signup or actual-Sysadmin maintenance. Because
    // actual Sysadmins bypass table permission checks, never_grant closes this
    // generic insert path to every delegated role, including Band Admin.
    Insert: Permission.never_grant,
} as const;

export const xUserTableAuthMap_R_EAdmins: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.basic_trust,
    View: Permission.basic_trust,
    EditOwn: Permission.basic_trust,
    Edit: Permission.admin_users,
    Insert: Permission.admin_users,
} as const;

export const xPermissionTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.sysadmin,
    View: Permission.sysadmin,
    EditOwn: Permission.sysadmin,
    Edit: Permission.sysadmin,
    Insert: Permission.sysadmin,
} as const;

const xVisibilityPermissionTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.basic_trust,
    View: Permission.basic_trust,
    EditOwn: Permission.sysadmin,
    Edit: Permission.sysadmin,
    Insert: Permission.sysadmin,
} as const;


export const xUserMinimum = new db3.xTable({
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.UserDefaultArgs => {
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
    tableAuthMap: xUserTableAuthMap_R_EManagers_ActualSysadminInsert,

    // note: self-sign-up is not part of this; it doesn't use db3 auth.
    // 
    // col:              QueryOwn       Query           MutateOwn       Mutate            insert***
    // 			-----------------------------------------------------------------------------------------------------------------
    // id             |  basic_trust    basic_trust     #               #                 #             |   xUserAuthMap_R_EOwn_EManagers                                  
    // name           |  basic_trust    basic_trust     basic_trust     manage_users      basic_trust   |   xUserAuthMap_R_EOwn_EManagers
    // email          |  basic_trust    basic_trust     #               #                 sysadmin      |   dedicated correction after insert
    // phone          |  basic_trust    basic_trust     basic_trust     manage_users      basic_trust   |   xUserAuthMap_R_EOwn_EManagers
    // auth fields    |  #              #               #               #                 #             |   dedicated auth/calendar flows only

    // isDeleted      |  basic_trust    basic_trust     manage_users    manage_users*     basic_trust*  |   xUserAuthMap_Manage
    // createdAt      |  basic_trust    basic_trust     user_admin      user_admin*       basic_trust*  |   xUserAuthMap_Admin
    // role           |  basic_trust    basic_trust     user_admin      user_admin*       basic_trust*  |   xUserAuthMap_Admin
    // isSysAdmin     |  basic_trust    basic_trust     user_admin      user_admin*       basic_trust*  |   xUserAuthMap_Admin

    // * when inserting, you need certain permissions to set certain values. custom processing would be ideal.

    getParameterizedWhereClause: (params: { userId?: number }, clientIntention: db3.xTableClientUsageContext): (Prisma.UserWhereInput[] | false) => {
        if (params.userId != null) {
            return [{
                id: { equals: params.userId }
            }];
        }
        return false;
    },
    columns: [
        MakePKfield(),
        MakeCreatedAtField(),
        MakeIsDeletedField({ _customAuth: authorizeUserSecurityFieldViewOnly }),

        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xUserAuthMap_R_EOwn_EManagers,
        }),
        new GenericStringField({
            columnName: "email",
            allowNull: false,
            format: "email",
            _customAuth: authorizeUserLoginEmail,
        }),
        new GenericStringField({
            columnName: "phone",
            allowNull: true,
            format: "plain",
            authMap: xUserAuthMap_R_EOwn_EManagers,
        }),
        new BoolField({
            columnName: "isSysAdmin",
            defaultValue: false,
            _customAuth: authorizeUserSecurityFieldViewOnly,
            allowNull: false,
        }),
        new GhostField({ memberName: "hashedPassword", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "googleId", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "accessToken", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "uid", _customAuth: denyGenericUserAuthenticationField }),
    ]
});




export const xPermissionBaseArgs: db3.TableDesc = {
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.PermissionDefaultArgs => {
        return PermissionArgs;
    },
    tableName: "Permission",
    deletePolicy: "disabled",
    requiresActualSysadmin: true,
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
            authMap: xUserAuthMap_R_EOwn_EManagers,
        }),
        MakeDescriptionField({ authMap: xUserAuthMap_R_EOwn_EManagers }),
        MakeSortOrderField({ authMap: xUserAuthMap_R_EOwn_EManagers }),
        new BoolField({
            columnName: "isVisibility",
            defaultValue: false,
            authMap: xUserAuthMap_R_EOwn_EManagers,
            allowNull: false,
        }),
        MakeSignificanceField("significance", PermissionSignificance, { authMap: xUserAuthMap_R_EOwn_EManagers }),
        MakeColorField({ authMap: xUserAuthMap_R_EOwn_EManagers }),
        MakeIconField("iconName", gIconOptions, { authMap: xUserAuthMap_R_EOwn_EManagers }),
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
            authMap: xUserAuthMap_R_EOwn_EManagers,
        }),

    ]
};

export const xPermission = new db3.xTable(xPermissionBaseArgs);

export const xPermissionForVisibility = new db3.xTable({
    ...xPermissionBaseArgs,
    tableUniqueName: "xPermissionForVisibility",
    tableAuthMap: xVisibilityPermissionTableAuthMap,
    requiresActualSysadmin: false,
    requiresActualSysadminForMutation: true,
    getSelectionArgs: () => PermissionForVisibilityArgs,
    queryParameters: {},
    getParameterizedWhereClause: (params: { userId?: number }, clientIntention: db3.xTableClientUsageContext): Prisma.PermissionWhereInput[] => {
        return [
            {
                isVisibility: {
                    equals: true
                }
            },
            {
                // when you are selecting a visibility permission it makes no sense to include visibilities you can't see yourself.
                roles: {
                    some: {
                        roleId: clientIntention.currentUser!.roleId!,
                    }
                }
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
    requiresActualSysadmin: true,
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.RolePermissionDefaultArgs => {
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
            authMap: xUserAuthMap_R_EAdmins,
        }),
        new ForeignSingleField<RolePayload>({
            columnName: "role",
            fkidMember: "roleId",
            allowNull: false,
            foreignTableID: "Role",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xUserAuthMap_R_EAdmins,
        }),
    ]
});

////////////////////////////////////////////////////////////////

export const xRole = new db3.xTable({
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.RoleDefaultArgs => {
        return RoleArgs;
    },
    tableName: "Role",
    deletePolicy: "disabled",
    requiresActualSysadmin: true,
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
            authMap: xUserAuthMap_R_EAdmins,
        }),
        MakeDescriptionField({ authMap: xUserAuthMap_R_EAdmins }),
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
        MakeSortOrderField({ authMap: xUserAuthMap_R_EAdmins }),
        MakeColorField({ authMap: xUserAuthMap_R_EOwn_EManagers }),
        MakeSignificanceField("significance", RoleSignificance, { authMap: xUserAuthMap_R_EAdmins }),
        new TagsField<RolePermissionAssociationPayload>({
            columnName: "permissions",
            associationForeignIDMember: "permissionId",
            associationForeignObjectMember: "permission",
            associationLocalIDMember: "roleId",
            associationLocalObjectMember: "role",
            associationTableID: "RolePermission",
            foreignTableID: "Permission",
            authMap: xUserAuthMap_R_EAdmins,
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
    tableAuthMap: xUserTableAuthMap_R_EManagers,
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.UserInstrumentDefaultArgs => {
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
        new BoolField({ columnName: "isPrimary", defaultValue: false, authMap: xUserAuthMap_R_EOwn_EManagers, allowNull: false }),
        new ForeignSingleField<Prisma.UserInstrumentGetPayload<{}>>({ // tags field should include the foreign object (tag object)
            columnName: "instrument",
            fkidMember: "instrumentId",
            allowNull: false,
            foreignTableID: "Instrument",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xUserAuthMap_R_EOwn_EManagers,
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({ // tags field should include the foreign object (tag object)
            columnName: "user",
            fkidMember: "userId",
            allowNull: false,
            foreignTableID: "user",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xUserAuthMap_R_EOwn_EManagers,
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
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.UserTagDefaultArgs => {
        return UserTagArgs;
    },
    tableName: "UserTag",
    deletePolicy: "hard",
    queryParameters: {
        userTagId: { kind: "integer", authorizeAs: "id" },
        ids: { kind: "integerArray", authorizeAs: "id" },
    },
    tableAuthMap: xUserTableAuthMap_R_EManagers,
    naturalOrderBy: UserTagNaturalOrderBy,
    getParameterizedWhereClause: (params: UserTagTableParams, clientIntention: db3.xTableClientUsageContext): (Prisma.UserTagWhereInput[] | false) => {
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
        MakeTitleField("text", { authMap: xUserAuthMap_R_EOwn_EManagers }),
        MakeDescriptionField({ authMap: xUserAuthMap_R_EOwn_EManagers }),
        MakeSortOrderField({ authMap: xUserAuthMap_R_EOwn_EManagers }),
        MakeColorField({ authMap: xUserAuthMap_R_EOwn_EManagers }),
        new GenericStringField({
            columnName: "cssClass",
            allowNull: true,
            format: "raw",
            authMap: xUserAuthMap_R_EAdmins,
        }),
        MakeSignificanceField("significance", UserTagSignificance, { authMap: xUserAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "userAssignments", authMap: xUserAuthMap_R_EOwn_EManagers }),
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
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.UserTagDefaultArgs => {
        return UserTagForEventSearchArgs;
    },
});


















export const xUserTagAssignment = new db3.xTable({
    tableName: "UserTagAssignment",
    deletePolicy: "hard",
    naturalOrderBy: UserTagAssignmentNaturalOrderBy,
    tableAuthMap: xUserTableAuthMap_R_EManagers,
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.UserTagAssignmentDefaultArgs => {
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
            authMap: xUserAuthMap_R_EOwn_EManagers,
        }),
    ]
});





////////////////////////////////////////////////////////////////
export interface UserTablParams {
    userId?: number;
    userIds?: number[];
};

const userBaseArgs: db3.TableDesc = {
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.UserDefaultArgs => {
        return UserSafeArgs;
    },
    tableName: "User",
    deletePolicy: "disabled",
    queryParameters: {
        userId: { kind: "integer", authorizeAs: "id" },
        userIds: { kind: "integerArray", authorizeAs: "id" },
    },
    tableAuthMap: xUserTableAuthMap_R_EManagers_ActualSysadminInsert,
    naturalOrderBy: UserNaturalOrderBy,
    getRowInfo: (row: UserPayload) => ({
        pk: row.id,
        name: row.name,
        ownerUserId: row.id,
    }),
    getParameterizedWhereClause: (params: UserTablParams, clientIntention: db3.xTableClientUsageContext): Prisma.UserWhereInput[] => {
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
        MakePKfield(),
        MakeIsDeletedField({ _customAuth: authorizeUserSecurityFieldViewOnly }),
        MakeCreatedAtField(),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xUserAuthMap_R_EOwn_EManagers,
        }),
        new GenericStringField({
            columnName: "email",
            allowNull: false,
            format: "email",
            _customAuth: authorizeUserLoginEmail,
        }),
        new GenericStringField({
            columnName: "phone",
            allowNull: true,
            format: "plain",
            authMap: xUserAuthMap_R_EOwn_EManagers,
        }),
        new GenericStringField({
            columnName: "cssClass",
            allowNull: true,
            format: "raw",
            authMap: xUserAuthMap_R_EAdmins,
        }),
        new BoolField({
            columnName: "isSysAdmin",
            defaultValue: false,
            _customAuth: authorizeUserSecurityFieldViewOnly,
            allowNull: false,
        }),
        new ForeignSingleField<Prisma.RoleGetPayload<{}>>({
            columnName: "role",
            allowNull: true,
            fkidMember: "roleId",
            foreignTableID: "Role",
            _customAuth: authorizeUserSecurityFieldViewOnly,
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
            authMap: xUserAuthMap_R_EOwn_EManagers,
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
            authMap: xUserAuthMap_R_EManagers, // don't allow editing your own tags; they're used for things like invites etc so only for managers.
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

        new GhostField({ memberName: "googleId", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "hashedPassword", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "accessToken", _customAuth: denyGenericUserAuthenticationField }),
        new GhostField({ memberName: "uid", _customAuth: denyGenericUserAuthenticationField }),
    ]
};

export const xUser = new db3.xTable(userBaseArgs);


export const xUserWithInstrument = new db3.xTable({
    ...userBaseArgs,
    tableUniqueName: "xUserWithInstrument",
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.UserDefaultArgs => {
        return UserWithInstrumentsArgs;
    },
});



// let's create a "created by" field which is a specialization of ForeignSingle, specialized to User payload
// automatically populated with current user on creation (see ApplyToNewRow)
export type CreatedByUserFieldArgs = {
    columnName?: string; // "instrumentType"
    fkidMember?: string; // "instrumentTypeId"
    specialFunction?: db3.SqlSpecialColumnFunction;
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
    ApplyToNewRow = (args: TAnyModel, clientIntention: db3.xTableClientUsageContext) => {
        args[this.member] = clientIntention.currentUser;
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: db3.DB3RowMode, clientIntention: db3.xTableClientUsageContext) => {
        if (mode === "new") {
            dbModel[this.member] = clientIntention.currentUser;
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

