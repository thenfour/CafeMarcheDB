
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { gIconOptions } from "shared/utils";
import { DynamicMenuLinkRealm, DynamicMenuLinkType } from "../../../../../shared/dynMenuTypes";
import { ConstEnumStringField, MakeCreatedAtField, MakeIconField, MakePKfield, MakeSortOrderField } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { GenericStringField, MakeTitleField } from "../columnTypes/genericString";
import { UserMinimalSelect } from "./prismArgs";
import { MakeCreatedByField, MakeVisiblePermissionField } from "./user";

const xAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.public,
    PostQuery: Permission.public,
    PreMutateAsOwner: Permission.customize_menu,
    PreMutate: Permission.customize_menu,
    PreInsert: Permission.customize_menu,
} as const;

const xTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.public,
    View: Permission.public,
    EditOwn: Permission.customize_menu,
    Edit: Permission.customize_menu,
    Insert: Permission.customize_menu,
} as const;


const MenuLinkArgs = Prisma.validator<Prisma.MenuLinkDefaultArgs>()({
    include: {
        createdByUser: { select: UserMinimalSelect },
        visiblePermission: true, // for creating new items, the payload should include this object.
    }
});

export type MenuLinkPayload = Prisma.MenuLinkGetPayload<typeof MenuLinkArgs>;

export const MenuLinkNaturalOrderBy: Prisma.MenuLinkOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
];

////////////////////////////////////////////////////////////////
export const xMenuLink = db3.defineTable({
    getSelectionArgs: (): Prisma.MenuLinkDefaultArgs => {
        return MenuLinkArgs;
    },
    tableName: "MenuLink",
    deletePolicy: "hard",
    sortOrderPolicy: { groupingColumn: null, scope: "explicitRowIds" },
    naturalOrderBy: MenuLinkNaturalOrderBy,
    getRowInfo: (row: MenuLinkPayload) => ({
        pk: row.id,
        name: row.caption,
        description: undefined,
        color: null,
        iconName: row.iconName,
        ownerUserId: row.createdByUserId,
    }),
    tableAuthMap: xTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        iconName: columnName => MakeIconField(columnName, gIconOptions, { authMap: xAuthMap, }),
        sortOrder: () => MakeSortOrderField({ authMap: xAuthMap, }),
        createdAt: () => MakeCreatedAtField({}),
        createdByUser: () => MakeCreatedByField(),
        visiblePermission: () => MakeVisiblePermissionField({ authMap: xAuthMap }),
        caption: columnName => MakeTitleField(columnName, { authMap: xAuthMap, }),

        realm: columnName => new ConstEnumStringField({
            columnName,
            allowNull: true,
            defaultValue: DynamicMenuLinkRealm.General,
            options: DynamicMenuLinkRealm,
            authMap: xAuthMap,
        }),
        groupName: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "raw",
            authMap: xAuthMap,
        }),
        groupCssClass: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "raw",
            authMap: xAuthMap,
        }),
        itemCssClass: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "raw",
            authMap: xAuthMap,
        }),
        linkType: columnName => new ConstEnumStringField({
            columnName,
            allowNull: false,
            defaultValue: DynamicMenuLinkType.ExternalURL,
            options: DynamicMenuLinkType,
            authMap: xAuthMap,
        }),
        externalURI: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "uri",
            authMap: xAuthMap,
        }),
        applicationPage: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "plain",
            authMap: xAuthMap,
        }),
        wikiSlug: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "raw",
            authMap: xAuthMap,
        }),
    })
});


