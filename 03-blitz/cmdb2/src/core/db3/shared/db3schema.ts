// note: many-to-many associations we treat mostly as "tags".
// both sides of the relationship are NOT equal; for example the association model will specify the tags field but not the local field,
// because we don't show the data from the tags perspective. we show it from the local perspective therefore we don't need that data, and specifying it would encounter circular references etc.

// another example of the imbalanced relationship:
// the "name" of an association model will be the tag. not the local object.

import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPalette } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, InstrumentTagSignificance, KeysOf, TAnyModel } from "shared/utils";
import { xTable } from "./db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, BoolField, PKField, TagsField } from "./db3basicFields";


////////////////////////////////////////////////////////////////
const InstrumentFunctionalGroupInclude: Prisma.InstrumentFunctionalGroupInclude = {
    instruments: true,
};

export type InstrumentFunctionalGroupLocalModel = Prisma.InstrumentFunctionalGroupGetPayload<{}>;
export type InstrumentFunctionalGroupForeignModel = Prisma.InstrumentFunctionalGroupGetPayload<{}>;

export const xInstrumentFunctionalGroup = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentFunctionalGroupInclude,
    tableName: "instrumentFunctionalGroup",
    getRowInfo: (row: InstrumentFunctionalGroupLocalModel) => ({
        name: row.name,
        description: row.description,
        color: gGeneralPalette.findColorPaletteEntry(row.color),
    }),
    createInsertModelFromString: (input: string): Partial<InstrumentFunctionalGroupLocalModel> => ({
        description: "auto-created from selection dlg",
        name: input,
        sortOrder: 0,
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
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPalette,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
    ]
});

const InstrumentTagInclude: Prisma.InstrumentTagInclude = {
    instruments: true,
};

export type InstrumentTagPayload = Prisma.InstrumentTagGetPayload<{}>;

export const xInstrumentTag = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentTagInclude,
    tableName: "instrumentTag",
    getRowInfo: (row: InstrumentTagPayload) => ({
        name: row.text,
        description: row.description,
        color: gGeneralPalette.findColorPaletteEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "text",
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
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPalette,
        }),
        new ConstEnumStringField({
            columnName: "significance",
            allowNull: true,
            defaultValue: null,
            options: InstrumentTagSignificance,
        }),
    ]
});

export type InstrumentTagForeignModel = Prisma.InstrumentTagGetPayload<{}>;

export type InstrumentTagAssociationModel = Prisma.InstrumentTagAssociationGetPayload<{
    include: {
        instrument: true,
        tag: true,
    }
}>;

// not sure this is needed or used at all.
const InstrumentTagAssociationInclude: Prisma.InstrumentTagAssociationInclude = {
    instrument: true,
    tag: true,
};

export const xInstrumentTagAssociation = new xTable({
    tableName: "InstrumentTagAssociation",
    editPermission: Permission.associate_instrument_tags,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentTagAssociationInclude,
    getRowInfo: (row: InstrumentTagAssociationModel) => ({
        name: row.tag.text, // generally don't use this directly.
        description: row.tag.description,
        color: gGeneralPalette.findColorPaletteEntry(row.tag.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        // do not add the `instrument` column here; this is used only as an association FROM the instrument table; excluding it
        // 1. enforces this purpose (minor)
        // 2. avoids a circular reference to xInstrument (major)
        new ForeignSingleField<Prisma.InstrumentTagGetPayload<{}>>({
            columnName: "tag",
            fkMember: "tagId",
            allowNull: false,
            foreignTableSpec: xInstrumentTag,
            // getChipCaption: (value) => value.text,
            // getChipDescription: (value) => value.description,
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                functionalGroup: {
                    name: { contains: query }
                }
            }),
        }),
    ]
});

const InstrumentInclude: Prisma.InstrumentInclude = {
    functionalGroup: true,
    instrumentTags: {
        include: {
            tag: true,
        }
    }
};

export type InstrumentPayload = Prisma.InstrumentGetPayload<{
    include: {
        functionalGroup: true,
        instrumentTags: {
            include: {
                tag: true,
            }
        }
    }
}>;

export const xInstrument = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentInclude,
    tableName: "instrument",
    getRowInfo: (row: InstrumentPayload) => ({
        name: row.name,
        description: row.description,
        color: gGeneralPalette.findColorPaletteEntry(row.functionalGroup.color),
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
        new ForeignSingleField<InstrumentFunctionalGroupForeignModel>({
            columnName: "functionalGroup",
            fkMember: "functionalGroupId",
            foreignTableSpec: xInstrumentFunctionalGroup,
            allowNull: false,
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                functionalGroup: {
                    name: { contains: query }
                }
            }),
        }),
        new TagsField<InstrumentTagAssociationModel>({
            columnName: "instrumentTags",
            associationForeignIDMember: "tagId",
            associationForeignObjectMember: "tag",
            associationLocalIDMember: "instrumentId",
            associationLocalObjectMember: "instrument",
            associationTableSpec: xInstrumentTagAssociation,
            foreignTableSpec: xInstrumentTag,
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                instrumentTags: {
                    some: {
                        tag: {
                            text: {
                                contains: query
                            }
                        }
                    }
                }
            }),
        }),
    ]
});


//   model RolePermission {
//     id           Int        @id @default(autoincrement())
//     roleId       Int
//     permissionId Int
//     role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade) // cascade delete association
//     permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade) // cascade delete association

//     // you could also cluster the keys but this is just simpler
//     //   @@id([roleId, permissionId])
//     @@unique([roleId, permissionId]) // 
//   }

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

export const xPermission = new xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    localInclude: PermissionLocalInclude,
    tableName: "permission",
    getRowInfo: (row: PermissionPayload) => ({
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

// this schema is required for tags selection dlg.
export const xRolePermissionAssociation = new xTable({
    tableName: "RolePermission",
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    localInclude: RolePermissionInclude,
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
            // getChipCaption: (value) => value.permission.name,
            // getChipDescription: (value) => value.permission.description || "",
            getQuickFilterWhereClause: (query: string): Prisma.InstrumentWhereInput => ({
                functionalGroup: {
                    name: { contains: query }
                }
            }),
        }),
    ]
});




const RoleLocalInclude: Prisma.RoleInclude = {
    permissions: {
        include: {
            permission: true,
        }
    },
};

//export type RolePermissionForeignModel = Prisma.InstrumentTagGetPayload<{}>;
export type RolePayload = Prisma.RoleGetPayload<{
    include: {
        permissions: {
            include: {
                permission: true,
            }
        },
    }
}>;

export const xRole = new xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    localInclude: RoleLocalInclude,
    tableName: "role",
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
            // getChipCaption: (value) => {
            //     return value.permission.name;
            // },
            // getChipDescription: (value) => (value.permission.description || ""),
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


export const UserLocalInclude: Prisma.UserInclude = {
    role: true,
};

export type UserPayload = Prisma.UserGetPayload<{
    include: {
        role: true,
    }
}>;

export const xUser = new xTable({
    editPermission: Permission.admin_auth,
    viewPermission: Permission.admin_auth,
    localInclude: UserLocalInclude,
    tableName: "user",
    getRowInfo: (row: UserPayload) => ({
        name: row.name,
    }),
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
        new ForeignSingleField<Prisma.RoleGetPayload<{}>>({
            columnName: "role",
            allowNull: false,
            fkMember: "roleId",
            foreignTableSpec: xRole,
            // getChipCaption: (value) => value.name,
            // getChipDescription: (value) => value.description || "",
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
    ]
});

export type SettingPayload = Prisma.SettingGetPayload<{}>;

export const xSetting = new xTable({
    editPermission: Permission.admin_settings,
    viewPermission: Permission.admin_settings,
    localInclude: null,
    tableName: "setting",
    getRowInfo: (row: SettingPayload) => ({
        name: row.name
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
        }),
        new GenericStringField({
            columnName: "value",
            allowNull: false,
            format: "plain",
        }),
    ]
});

