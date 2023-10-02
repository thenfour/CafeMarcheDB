
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { BoolField, DateTimeField, ForeignSingleField, GenericIntegerField, GenericStringField, MakeColorField, MakeCreatedAtField, MakeIconField, PKField, TagsField } from "../db3basicFields";
import { xTable } from "../db3core";
import { gGeneralPaletteList } from "shared/color";
import { InstrumentArgs, UserArgs, UserInstrumentArgs, UserInstrumentNaturalOrderBy, UserInstrumentPayload, UserNaturalOrderBy, UserPayload, xInstrument } from "./instrument";
import { TAnyModel, gIconOptions } from "shared/utils";


export const xUserMinimum = new xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    localInclude: UserArgs.include,
    tableName: "user",
    naturalOrderBy: UserNaturalOrderBy,
    getRowInfo: (row: UserPayload) => ({
        name: row.name,
    }),
    getParameterizedWhereClause: (params: { userId?: number }): (Prisma.UserWhereInput[] | false) => {
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





const PermissionLocalInclude: Prisma.PermissionInclude = {
    roles: {
        include: {
            permission: true,
        }
    },
};
export type PermissionPayload = Prisma.PermissionGetPayload<{
    include: {
        roles: {
            include: {
                permission: true,
            }
        },
    }
}>;
export const PermissionNaturalOrderBy: Prisma.PermissionOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { name: 'asc' },
    { id: 'asc' },
];

export const xPermission = new xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    localInclude: PermissionLocalInclude,
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
    // renderCell: (params) => {
    //     const dbname = params.row.name;
    //     if (Object.values(Permission).find(p => p === dbname)) {
    //         return (<Tooltip title="This permission is understood by internal code; all permissions should have this state."><Chip size="small" color="primary" label="Ok" variant="outlined" /></Tooltip>);
    //     } else {
    //         return (<Tooltip title="This permission is unknown by internal code. It won't be used by anything unless code changes are made. Is it obsolete? Typo in the name?"><Chip size="small" color="error" label="Unknown" variant="outlined" /></Tooltip>);
    //     }
    // }
});


// if we think of role-permission as tags relationship,
// then roles are the local object, and permissions are the foreign tags object.

const RolePermissionInclude: Prisma.RolePermissionInclude = {
    permission: true,
    role: true,
};

export type RolePermissionAssociationModel = Prisma.RolePermissionGetPayload<{
    include: {
        permission: true,
        role: true,
    }
}>;

const RolePermissionNaturalOrderBy: Prisma.RolePermissionOrderByWithRelationInput[] = [
    { permission: { sortOrder: 'desc' } },
    { permission: { name: 'asc' } },
    { permission: { id: 'asc' } },
];

// this schema is required for tags selection dlg.
export const xRolePermissionAssociation = new xTable({
    tableName: "RolePermission",
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    localInclude: RolePermissionInclude,
    naturalOrderBy: RolePermissionNaturalOrderBy,
    getRowInfo: (row: RolePermissionAssociationModel) => ({
        name: row.permission.name,
        description: row.permission.description || "",
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<RolePermissionAssociationModel>({
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
const RoleLocalInclude: Prisma.RoleInclude = {
    permissions: {
        include: {
            permission: true,
        },
        orderBy: RolePermissionNaturalOrderBy,
    },
};

//export type RolePermissionForeignModel = Prisma.InstrumentTagGetPayload<{}>;
export type RolePayload = Prisma.RoleGetPayload<{
    include: {
        permissions: {
            include: {
                permission: true,
            },
        },
    }
}>;

const RoleNaturalOrderBy: Prisma.RoleOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { name: 'asc' },
    { id: 'asc' },
];

export const xRole = new xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    localInclude: RoleLocalInclude,
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
        new TagsField<RolePermissionAssociationModel>({
            columnName: "permissions",
            associationTableSpec: xRolePermissionAssociation,
            associationForeignIDMember: "permissionId",
            associationForeignObjectMember: "permission",
            associationLocalIDMember: "roleId",
            associationLocalObjectMember: "role",
            foreignTableSpec: xPermission,
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





export const xUserInstrument = new xTable({
    tableName: "UserInstrument",
    editPermission: Permission.login,
    viewPermission: Permission.login,
    localInclude: UserInstrumentArgs.include,
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
// export type UserMinimumPayload = Prisma.UserGetPayload<{}>;

// export const UserArgs = Prisma.validator<Prisma.UserArgs>()({
//     include: {
//         role: true,
//         instruments: UserInstrumentArgs,
//     }
// });

// export type UserPayload = Prisma.UserGetPayload<typeof UserArgs>;

// export const UserNaturalOrderBy: Prisma.UserOrderByWithRelationInput[] = [
//     { name: 'asc' },
//     { id: 'asc' },
//];

export const xUser = new xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    localInclude: UserArgs.include,
    tableName: "user",
    naturalOrderBy: UserNaturalOrderBy,
    getRowInfo: (row: UserPayload) => ({
        name: row.name,
    }),
    getParameterizedWhereClause: (params: { userId?: number }): (Prisma.UserWhereInput[] | false) => {
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
            getQuickFilterWhereClause: (query: string) => false,
        }),]
});



////////////////////////////////////////////////////////////////
// server API...
