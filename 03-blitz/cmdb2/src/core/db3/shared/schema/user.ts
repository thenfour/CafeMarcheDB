
import { Prisma } from "db";
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { TAnyModel, gIconOptions } from "shared/utils";
import { BoolField, ForeignSingleField, GenericIntegerField, GenericStringField, MakeColorField, MakeCreatedAtField, MakeIconField, MakeMarkdownTextField, MakeSignificanceField, MakeSortOrderField, MakeTitleField, PKField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { PermissionArgs, PermissionNaturalOrderBy, PermissionPayload, RoleArgs, RoleNaturalOrderBy, RolePayload, RolePermissionArgs, RolePermissionAssociationPayload, RolePermissionNaturalOrderBy, UserArgs, UserInstrumentArgs, UserInstrumentNaturalOrderBy, UserInstrumentPayload, UserNaturalOrderBy, UserPayload, UserTagArgs, UserTagAssignmentArgs, UserTagAssignmentNaturalOrderBy, UserTagAssignmentPayload, UserTagNaturalOrderBy, UserTagPayload, UserTagSignificance } from "./prismArgs";


export const xUserMinimum = new db3.xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserInclude => {
        return UserArgs.include;
    },
    tableName: "user",
    naturalOrderBy: UserNaturalOrderBy,
    getRowInfo: (row: UserPayload) => ({
        name: row.name,
    }),
    getParameterizedWhereClause: (params: { userId?: number }, clientIntention: db3.xTableClientUsageContext): (Prisma.UserWhereInput[] | false) => {
        if (params.userId != null) {
            return [{
                id: { equals: params.userId }
            }];
        }
        return false;
    },
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
        }),
        new GenericStringField({
            columnName: "email",
            allowNull: false,
            format: "email",
        }),
        new GenericStringField({
            columnName: "phone",
            allowNull: true,
            format: "plain",
        }),
        new BoolField({
            columnName: "isSysAdmin",
            defaultValue: false,
        }),
        new GenericStringField({
            columnName: "hashedPassword",
            allowNull: true,
            format: "plain",
        }),
        new GenericStringField({
            columnName: "googleId",
            format: "plain",
            allowNull: true,
        }),
        MakeCreatedAtField("createdAt"),
    ]
});




export const xPermissionBaseArgs: db3.TableDesc = {
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.PermissionInclude => {
        return PermissionArgs.include;
    },
    tableName: "permission",
    naturalOrderBy: PermissionNaturalOrderBy,
    getRowInfo: (row: PermissionPayload) => ({
        name: row.name,
        description: row.description || "",
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
        }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
        new BoolField({
            columnName: "isVisibility",
            defaultValue: false,
        }),
        MakeColorField("color"),
        MakeIconField("iconName", gIconOptions),
        new TagsField<RolePermissionAssociationPayload>({
            columnName: "roles",
            associationForeignIDMember: "roleId",
            associationForeignObjectMember: "role",
            associationLocalIDMember: "permissionId",
            associationLocalObjectMember: "permission",
            associationTableID: "RolePermission",
            foreignTableID: "Role",
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel) => false,
            getQuickFilterWhereClause: (query: string): Prisma.PermissionWhereInput | boolean => false,
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
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.RolePermissionInclude => {
        return RolePermissionArgs.include;
    },
    naturalOrderBy: RolePermissionNaturalOrderBy,
    getRowInfo: (row: RolePermissionAssociationPayload) => ({
        name: row.permission.name,
        description: row.permission.description || "",
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<PermissionPayload>({
            columnName: "permission",
            fkMember: "permissionId",
            allowNull: false,
            foreignTableID: "Permission",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<RolePayload>({
            columnName: "role",
            fkMember: "roleId",
            allowNull: false,
            foreignTableID: "Role",
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});

////////////////////////////////////////////////////////////////

export const xRole = new db3.xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.RoleInclude => {
        return RoleArgs.include;
    },
    tableName: "role",
    naturalOrderBy: RoleNaturalOrderBy,
    createInsertModelFromString: (input: string): Prisma.RoleCreateInput => {
        return {
            name: input,
            description: "auto-created",
            sortOrder: 0,
        };
    },
    getRowInfo: (row: RolePayload) => ({
        name: row.name,
        description: row.description || "",
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
        }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
        }),
        new BoolField({
            columnName: "isRoleForNewUsers",
            defaultValue: false,
        }),
        new BoolField({
            columnName: "isPublicRole",
            defaultValue: false,
        }),

        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
        new TagsField<RolePermissionAssociationPayload>({
            columnName: "permissions",
            associationForeignIDMember: "permissionId",
            associationForeignObjectMember: "permission",
            associationLocalIDMember: "roleId",
            associationLocalObjectMember: "role",
            associationTableID: "RolePermission",
            foreignTableID: "Permission",
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.InstrumentWhereInput | boolean => false,
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
    editPermission: Permission.login,
    viewPermission: Permission.login,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserInstrumentInclude => {
        return UserInstrumentArgs.include;
    },
    naturalOrderBy: UserInstrumentNaturalOrderBy,
    getRowInfo: (row: UserInstrumentPayload) => {
        return {
            name: row.instrument.name,
            description: row.instrument.description,
            color: gGeneralPaletteList.findEntry(row.instrument.functionalGroup.color),
        };
    },
    columns: [
        new PKField({ columnName: "id" }),
        new BoolField({ columnName: "isPrimary", defaultValue: false }),
        new ForeignSingleField<Prisma.UserInstrumentGetPayload<{}>>({ // tags field should include the foreign object (tag object)
            columnName: "instrument",
            fkMember: "instrumentId",
            allowNull: false,
            foreignTableID: "Instrument",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({ // tags field should include the foreign object (tag object)
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableID: "UserMinimum",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        // don't include local object because of dependencies / redundancy issues
    ]
});








////////////////////////////////////////////////////////////////

export const xUserTag = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserTagInclude => {
        return UserTagArgs.include;
    },
    tableName: "UserTag",
    naturalOrderBy: UserTagNaturalOrderBy,
    getParameterizedWhereClause: (params: { userTagId?: number }, clientIntention: db3.xTableClientUsageContext): (Prisma.UserWhereInput[] | false) => {
        if (params.userTagId != null) {
            return [{
                id: { equals: params.userTagId }
            }];
        }
        return false;
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
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text"),
        MakeMarkdownTextField("description"),
        MakeSortOrderField("sortOrder"),
        MakeColorField("color"),
        MakeSignificanceField("significance", UserTagSignificance),
    ]
});


export const xUserTagAssignment = new db3.xTable({
    tableName: "UserTagAssignment",
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: UserTagAssignmentNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserTagAssignmentInclude => {
        return UserTagAssignmentArgs.include;
    },
    getRowInfo: (row: UserTagAssignmentPayload) => {
        return {
            name: row.userTag.text,
            description: row.userTag.description,
            color: gGeneralPaletteList.findEntry(row.userTag.color),
        };
    }
    ,
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.UserTagGetPayload<{}>>({
            columnName: "userTag",
            fkMember: "userTagId",
            allowNull: false,
            foreignTableID: "UserTag",
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});





////////////////////////////////////////////////////////////////

export const xUser = new db3.xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserInclude => {
        return UserArgs.include;
    },
    tableName: "user",
    naturalOrderBy: UserNaturalOrderBy,
    getRowInfo: (row: UserPayload) => ({
        name: row.name,
    }),
    getParameterizedWhereClause: (params: { userId?: number }, clientIntention: db3.xTableClientUsageContext): Prisma.UserWhereInput[] => {
        const ret: Prisma.UserWhereInput[] = [];
        if (params.userId != null) {
            ret.push({ id: { equals: params.userId } });
        }
        return ret;
    },
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
        }),
        new GenericStringField({
            columnName: "email",
            allowNull: false,
            format: "email",
        }),
        new GenericStringField({
            columnName: "phone",
            allowNull: true,
            format: "plain",
        }),
        // new BoolField({
        //     columnName: "isActive",
        //     defaultValue: false,
        // }),
        new BoolField({
            columnName: "isSysAdmin",
            defaultValue: false,
        }),
        new ForeignSingleField<Prisma.RoleGetPayload<{}>>({
            columnName: "role",
            allowNull: false,
            fkMember: "roleId",
            foreignTableID: "Role",
            getQuickFilterWhereClause: (query: string): Prisma.RoleWhereInput => ({
                OR: [
                    { name: { contains: query } },
                    { description: { contains: query } },
                ]
            }),
        }),
        new GenericStringField({
            columnName: "hashedPassword",
            allowNull: true,
            format: "plain",
        }),
        new GenericStringField({
            columnName: "googleId",
            format: "plain",
            allowNull: true,
        }),
        MakeCreatedAtField("createdAt"),
        new TagsField<UserInstrumentPayload>({
            columnName: "instruments",
            associationForeignIDMember: "instrumentId",
            associationForeignObjectMember: "instrument",
            associationLocalIDMember: "userId",
            associationLocalObjectMember: "user",
            associationTableID: "UserInstrument",
            foreignTableID: "Instrument",
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.InstrumentWhereInput | boolean => false,
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
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.UserWhereInput | boolean => {
                // see events tagIds on how to filter by this field.
                return false;
            },
        }), // column: tags

    ]
});




// let's create a "created by" field which is a specialization of ForeignSingle, specialized to User payload
// automatically populated with current user on creation (see ApplyToNewRow)
export interface CreatedByUserFieldArgs {
    columnName?: string; // "instrumentType"
    fkMember?: string; // "instrumentTypeId"
};

export class CreatedByUserField extends ForeignSingleField<UserPayload> {
    constructor(args: CreatedByUserFieldArgs) {
        super({
            columnName: args.columnName || "createdByUser",
            fkMember: args.fkMember || "createdByUserId",
            foreignTableID: "User",
            allowNull: true,
            getQuickFilterWhereClause: () => false,
        });
    }
    ApplyToNewRow = (args: TAnyModel, clientIntention: db3.xTableClientUsageContext) => {
        args[this.member] = clientIntention.currentUser;
    };
};


// let's create a "visiblePermission" column which is ForeignSingle for a permission, but only for "visibility" permissions.
// in theory this will apply a filter over permissions for isVisibility = TRUE; however that is already done in a different way.
export interface VisiblePermissionFieldArgs {
    columnName?: string; // "visiblePermission"
    fkMember?: string; // "visiblePermissionId"
};

export class VisiblePermissionField extends ForeignSingleField<PermissionPayload> {
    constructor(args: VisiblePermissionFieldArgs) {
        super({
            columnName: args.columnName || "visiblePermission",
            fkMember: args.fkMember || "visiblePermissionId",
            foreignTableID: "xPermissionForVisibility",
            allowNull: true,
            getQuickFilterWhereClause: () => false,
        });
    }
};


////////////////////////////////////////////////////////////////
// server API...
