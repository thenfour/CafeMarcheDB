
import { Prisma } from "db";
import { assertIsNumberArray } from "shared/arrayUtils";
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { TableAccessor } from "shared/rootroot";
import { gIconOptions } from "shared/utils";
import { CMDBTableFilterModel, PermissionSignificance, TAnyModel } from "../apiTypes";
import { BoolField, ForeignSingleField, GhostField, MakeColorField, MakeCreatedAtField, MakeIconField, MakeIsDeletedField, MakePKfield, MakeSignificanceField, MakeSortOrderField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { EnrichedInstrument, PermissionArgs, PermissionNaturalOrderBy, PermissionPayload, RoleArgs, RoleNaturalOrderBy, RolePayload, RolePermissionArgs, RolePermissionAssociationPayload, RolePermissionNaturalOrderBy, RoleSignificance, UserArgs, UserInstrumentArgs, UserInstrumentNaturalOrderBy, UserInstrumentPayload, UserMinimumPayload, UserNaturalOrderBy, UserPayload, UserTagArgs, UserTagAssignmentArgs, UserTagAssignmentNaturalOrderBy, UserTagAssignmentPayload, UserTagNaturalOrderBy, UserTagPayload, UserTagSignificance, UserWithInstrumentsArgs } from "./prismArgs";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../genericStringField";

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


export const xUserTableAuthMap_R_EManagers: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.basic_trust,
    View: Permission.basic_trust,
    EditOwn: Permission.basic_trust,
    Edit: Permission.manage_users,
    Insert: Permission.manage_users,
} as const;

export const xUserTableAuthMap_R_EAdmins: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.basic_trust,
    View: Permission.basic_trust,
    EditOwn: Permission.basic_trust,
    Edit: Permission.admin_users,
    Insert: Permission.admin_users,
} as const;

export const xPermissionTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.basic_trust,
    View: Permission.basic_trust,
    EditOwn: Permission.admin_users,
    Edit: Permission.admin_users,
    Insert: Permission.admin_users,
} as const;


export const xUserMinimum = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserInclude => {
        return UserArgs.include;
    },
    tableName: "User",
    naturalOrderBy: UserNaturalOrderBy,
    getRowInfo: (row: UserMinimumPayload) => ({
        pk: row.id,
        name: row.name,
        ownerUserId: row.id,
    }),
    tableAuthMap: xUserTableAuthMap_R_EManagers,

    // note: self-sign-up is not part of this; it doesn't use db3 auth.
    // 
    // col:              QueryOwn       Query           MutateOwn       Mutate            insert***
    // 			-----------------------------------------------------------------------------------------------------------------
    // id             |  basic_trust    basic_trust     #               #                 #             |   xUserAuthMap_R_EOwn_EManagers                                  
    // name           |  basic_trust    basic_trust     basic_trust     manage_users      basic_trust   |   xUserAuthMap_R_EOwn_EManagers
    // email          |  basic_trust    basic_trust     basic_trust     manage_users      basic_trust   |   xUserAuthMap_R_EOwn_EManagers
    // phone          |  basic_trust    basic_trust     basic_trust     manage_users      basic_trust   |   xUserAuthMap_R_EOwn_EManagers
    // hashedPassword |  basic_trust    basic_trust     basic_trust     manage_users      basic_trust   |   xUserAuthMap_R_EOwn_EManagers
    // googleId       |  basic_trust    basic_trust     basic_trust     manage_users      basic_trust   |   xUserAuthMap_R_EOwn_EManagers

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
        MakeIsDeletedField({ authMap: xUserAuthMap_R_EOwn_EManagers }),

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
            authMap: xUserAuthMap_R_EOwn_EManagers,
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
            authMap: xUserAuthMap_R_EAdmins,
            allowNull: false,
        }),
        new GenericStringField({
            columnName: "hashedPassword",
            allowNull: true,
            format: "plain",
            authMap: xUserAuthMap_R_EOwn_EManagers,
        }),
        new GenericStringField({
            columnName: "googleId",
            format: "plain",
            allowNull: true,
            authMap: xUserAuthMap_R_EOwn_EManagers,
        }),
        new GhostField({ memberName: "hashedPassword", authMap: xUserAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "accessToken", authMap: xUserAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "uid", authMap: xUserAuthMap_R_EOwn_EManagers }),
    ]
});




export const xPermissionBaseArgs: db3.TableDesc = {
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.PermissionInclude => {
        return PermissionArgs.include;
    },
    tableName: "Permission",
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
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.RolePermissionInclude => {
        return RolePermissionArgs.include;
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
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.RoleInclude => {
        return RoleArgs.include;
    },
    tableName: "Role",
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
            authMap: xUserAuthMap_R_EAdmins,
            allowNull: false,
        }),
        new BoolField({
            columnName: "isPublicRole",
            defaultValue: false,
            authMap: xUserAuthMap_R_EAdmins,
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
    tableAuthMap: xUserTableAuthMap_R_EManagers,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserInstrumentInclude => {
        return UserInstrumentArgs.include;
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
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserTagInclude => {
        return UserTagArgs.include;
    },
    tableName: "UserTag",
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
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserTagInclude => {
        return UserTagForEventSearchArgs.include;
    },
});


















export const xUserTagAssignment = new db3.xTable({
    tableName: "UserTagAssignment",
    naturalOrderBy: UserTagAssignmentNaturalOrderBy,
    tableAuthMap: xUserTableAuthMap_R_EManagers,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserTagAssignmentInclude => {
        return UserTagAssignmentArgs.include;
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
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserInclude => {
        return UserArgs.include;
    },
    tableName: "User",
    tableAuthMap: xUserTableAuthMap_R_EManagers,
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
        MakeIsDeletedField({ authMap: xUserAuthMap_R_EOwn_EManagers }),
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
            authMap: xUserAuthMap_R_EOwn_EManagers,
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
            authMap: xUserAuthMap_R_EAdmins,
            allowNull: false,
        }),
        new ForeignSingleField<Prisma.RoleGetPayload<{}>>({
            columnName: "role",
            allowNull: false,
            fkidMember: "roleId",
            foreignTableID: "Role",
            authMap: xUserAuthMap_R_EAdmins,
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

        new GhostField({ memberName: "googleId", authMap: xUserAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "hashedPassword", authMap: xUserAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "accessToken", authMap: xUserAuthMap_R_EOwn_EManagers }),
        new GhostField({ memberName: "uid", authMap: xUserAuthMap_R_EOwn_EManagers }),
    ]
};

export const xUser = new db3.xTable(userBaseArgs);


export const xUserWithInstrument = new db3.xTable({
    ...userBaseArgs,
    tableUniqueName: "xUserWithInstrument",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserInclude => {
        return UserWithInstrumentsArgs.include;
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


////////////////////////////////////////////////////////////////
// server API...

export type EnrichUserInput = Partial<Prisma.UserGetPayload<{
    include: {
        tags: true,
        instruments: true,
    }
}>>;
export type EnrichedUser<T extends EnrichUserInput> = Omit<T,
    'tags'
    | 'instruments'
> & Prisma.UserGetPayload<{
    select: {
        role: true,
        tags: {
            include: {
                userTag: true,
            }
        },
        instruments: {
            include: {
                instrument: {
                    include: {
                        functionalGroup: true,
                    }
                }
            }
        }
    },
}>;


// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichUser<T extends EnrichUserInput>(
    item: T,
    roles: TableAccessor<Prisma.RoleGetPayload<{}>>,
    userTags: TableAccessor<Prisma.UserTagGetPayload<{}>>,
    instruments: TableAccessor<EnrichedInstrument<Prisma.InstrumentGetPayload<{}>>>
): EnrichedUser<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    const ret = {
        ...item,
        role: roles.getById(item.roleId),

        tags: (item.tags || []).map((assoc) => {
            const ret: Prisma.UserTagAssignmentGetPayload<{ include: { userTag: true } }> = {
                ...assoc,
                userTag: userTags.getById(assoc.userTagId)! // enrich!
            };
            return ret;
        }).sort((a, b) => a.userTag.sortOrder - b.userTag.sortOrder), // respect ordering

        instruments: (item.instruments || []).map((assoc) => {
            const ret: Prisma.UserInstrumentGetPayload<{ include: { instrument: { include: { functionalGroup: true } } } }> = {
                ...assoc,
                instrument: instruments.getById(assoc.instrumentId)! // enrich!
            };
            return ret;
        }).sort((a, b) => a.instrument.sortOrder - b.instrument.sortOrder), // respect ordering
    };

    return ret;
}

export type EnrichedVerboseUser = EnrichedUser<UserPayload>;
