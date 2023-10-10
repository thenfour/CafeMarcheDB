
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { BoolField, DateTimeField, ForeignSingleField, ForeignSingleFieldArgs, GenericIntegerField, GenericStringField, MakeColorField, MakeCreatedAtField, MakeIconField, PKField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { gGeneralPaletteList } from "shared/color";
import { InstrumentArgs, UserArgs, UserInstrumentArgs, UserInstrumentNaturalOrderBy, UserInstrumentPayload, UserNaturalOrderBy, UserPayload, xInstrument } from "./instrument";
import { TAnyModel, gIconOptions } from "shared/utils";


export const xUserMinimum = new db3.xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserInclude => {
        return UserArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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
            columnName: "compactName",
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
            columnName: "isActive",
            defaultValue: false,
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





const PermissionArgs = Prisma.validator<Prisma.PermissionArgs>()({
    include: {
        roles: true,
    }
});
export type PermissionPayloadMinimum = Prisma.PermissionGetPayload<{}>;
export type PermissionPayload = Prisma.PermissionGetPayload<typeof PermissionArgs>;

export const PermissionNaturalOrderBy: Prisma.PermissionOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { name: 'asc' },
    { id: 'asc' },
];

export const xPermissionBaseArgs: db3.TableDesc = {
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.PermissionInclude => {
        return PermissionArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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

const RolePermissionArgs = Prisma.validator<Prisma.RolePermissionArgs>()({
    include: {
        permission: true,
        role: true,
    }
});

export type RolePermissionAssociationPayload = Prisma.RolePermissionGetPayload<typeof RolePermissionArgs>;

const RolePermissionNaturalOrderBy: Prisma.RolePermissionOrderByWithRelationInput[] = [
    { permission: { sortOrder: 'desc' } },
    { permission: { name: 'asc' } },
    { permission: { id: 'asc' } },
];

// this schema is required for tags selection dlg.
export const xRolePermissionAssociation = new db3.xTable({
    tableName: "RolePermission",
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.RolePermissionInclude => {
        return RolePermissionArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    naturalOrderBy: RolePermissionNaturalOrderBy,
    getRowInfo: (row: RolePermissionAssociationPayload) => ({
        name: row.permission.name,
        description: row.permission.description || "",
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<RolePermissionAssociationPayload>({
            columnName: "permission",
            fkMember: "permissionId",
            allowNull: false,
            foreignTableSpec: xPermission,
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                functionalGroup: {
                    name: { contains: query }
                }
            }),
        }),
    ]
});

////////////////////////////////////////////////////////////////
const RoleArgs = Prisma.validator<Prisma.RoleArgs>()({
    include: {
        permissions: {
            include: {
                permission: true,
            },
            orderBy: RolePermissionNaturalOrderBy,
        },
    }
});

export type RolePayload = Prisma.RoleGetPayload<typeof RoleArgs>;

const RoleNaturalOrderBy: Prisma.RoleOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { name: 'asc' },
    { id: 'asc' },
];

export const xRole = new db3.xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.RoleInclude => {
        return RoleArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
        new TagsField<RolePermissionAssociationPayload>({
            columnName: "permissions",
            associationTableSpec: xRolePermissionAssociation,
            associationForeignIDMember: "permissionId",
            associationForeignObjectMember: "permission",
            associationLocalIDMember: "roleId",
            associationLocalObjectMember: "role",
            foreignTableSpec: xPermission,
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
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    naturalOrderBy: UserInstrumentNaturalOrderBy,
    getRowInfo: (row: UserInstrumentPayload) => {
        return {
            name: row.instrument.name,
            description: row.instrument.description,
            color: gGeneralPaletteList.findEntry(row.instrument.functionalGroup.color),
        };
    }
    ,
    columns: [
        new PKField({ columnName: "id" }),
        new BoolField({ columnName: "isPrimary", defaultValue: false }),
        new ForeignSingleField<Prisma.UserInstrumentGetPayload<{}>>({ // tags field should include the foreign object (tag object)
            columnName: "instrument",
            fkMember: "instrumentId",
            allowNull: false,
            foreignTableSpec: xInstrument,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.UserGetPayload<{}>>({ // tags field should include the foreign object (tag object)
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableSpec: xUserMinimum,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        // don't include local object because of dependencies / redundancy issues
    ]
});







////////////////////////////////////////////////////////////////

export const xUser = new db3.xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.UserInclude => {
        return UserArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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
        if (clientIntention.intention === "user") {
            ret.push({ isDeleted: false });
        }
        return ret;
    },
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
        }),
        new GenericStringField({
            columnName: "compactName",
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
            columnName: "isActive",
            defaultValue: false,
        }),
        new BoolField({
            columnName: "isSysAdmin",
            defaultValue: false,
        }),
        new ForeignSingleField<Prisma.RoleGetPayload<{}>>({
            columnName: "role",
            allowNull: false,
            fkMember: "roleId",
            foreignTableSpec: xRole,
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
            associationTableSpec: xUserInstrument,
            foreignTableSpec: xInstrument,
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.InstrumentWhereInput | boolean => false,
            getQuickFilterWhereClause: (query: string) => false,
        }),]
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
            foreignTableSpec: xUser,
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
            foreignTableSpec: xPermissionForVisibility,
            allowNull: true,
            getQuickFilterWhereClause: () => false,
        });
    }
};


////////////////////////////////////////////////////////////////
// server API...
