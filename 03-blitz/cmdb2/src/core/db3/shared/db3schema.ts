// note: many-to-many associations we treat mostly as "tags".
// both sides of the relationship are NOT equal; for example the association model will specify the tags field but not the local field,
// because we don't show the data from the tags perspective. we show it from the local perspective therefore we don't need that data, and specifying it would encounter circular references etc.

// another example of the imbalanced relationship:
// the "name" of an association model will be the tag. not the local object.

import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { GenericStringField, PKField } from "./db3basicFields";
import { xTable } from "./db3core";


export type SettingPayload = Prisma.SettingGetPayload<{}>;
export const SettingNaturalOrderBy: Prisma.SettingOrderByWithRelationInput[] = [
    { name: 'asc' },
    { id: 'asc' },
];

export const xSetting = new xTable({
    editPermission: Permission.admin_settings,
    viewPermission: Permission.admin_settings,
    getInclude: (clientIntention) => null,
    tableName: "setting",
    naturalOrderBy: SettingNaturalOrderBy,
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

