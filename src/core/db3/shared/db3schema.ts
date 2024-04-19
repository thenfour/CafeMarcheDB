// note: many-to-many associations we treat mostly as "tags".
// both sides of the relationship are NOT equal; for example the association model will specify the tags field but not the local field,
// because we don't show the data from the tags perspective. we show it from the local perspective therefore we don't need that data, and specifying it would encounter circular references etc.

// another example of the imbalanced relationship:
// the "name" of an association model will be the tag. not the local object.

import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { GenericStringField, PKField } from "./db3basicFields";
import { DB3AuthContextPermissionMap, DB3AuthTablePermissionMap, xTable, xTableClientUsageContext } from "./db3core";
import { TAnyModel } from "shared/utils";


export const xSettingsAuthMap: DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.basic_trust,
    PostQuery: Permission.basic_trust,
    PreMutateAsOwner: Permission.content_admin,
    PreMutate: Permission.content_admin,
    PreInsert: Permission.content_admin,
};

export const xSettingsTableAuthMap: DB3AuthTablePermissionMap = {
    ViewOwn: Permission.basic_trust,
    View: Permission.basic_trust,
    EditOwn: Permission.content_admin,
    Edit: Permission.content_admin,
    Insert: Permission.content_admin,
};


export type SettingPayload = Prisma.SettingGetPayload<{}>;
export const SettingNaturalOrderBy: Prisma.SettingOrderByWithRelationInput[] = [
    { name: 'asc' },
    { id: 'asc' },
];

export const xSetting = new xTable({
    getInclude: (clientIntention) => ({}),
    tableName: "Setting",
    tableAuthMap: xSettingsTableAuthMap,
    naturalOrderBy: SettingNaturalOrderBy,
    getRowInfo: (row: SettingPayload) => ({
        name: row.name,
        ownerUserId: null,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            allowNull: false,
            format: "plain",
            authMap: xSettingsAuthMap,
        }),
        new GenericStringField({
            columnName: "value",
            allowNull: false,
            format: "plain",
            authMap: xSettingsAuthMap,
        }),
    ]
});

