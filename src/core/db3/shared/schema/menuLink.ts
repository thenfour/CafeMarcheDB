
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { gIconOptions } from "shared/utils";
import { ConstEnumStringField, GenericIntegerField, GenericStringField, MakeCreatedAtField, MakeIconField, PKField } from "../db3basicFields";
import * as db3 from "../db3core";
import { CreatedByUserField, VisiblePermissionField } from "./user";
import { DynamicMenuLinkApplicationPage, DynamicMenuLinkRealm, DynamicMenuLinkType } from "../../../../../shared/dynMenuTypes";
import { UserMinimalSelect } from "./prismArgs";

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
        //visiblePermission: true,
        createdByUser: { select: UserMinimalSelect },
    }
});

export type MenuLinkPayload = Prisma.MenuLinkGetPayload<typeof MenuLinkArgs>;

export const MenuLinkNaturalOrderBy: Prisma.MenuLinkOrderByWithRelationInput[] = [
    { sortOrder: 'asc' },
];

////////////////////////////////////////////////////////////////
export const xMenuLink = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.MenuLinkInclude => {
        return MenuLinkArgs.include;
    },
    tableName: "MenuLink",
    naturalOrderBy: MenuLinkNaturalOrderBy,
    getRowInfo: (row: MenuLinkPayload) => ({
        pk: row.id,
        name: row.caption,
        description: undefined,
        color: null,
        iconName: row.iconName,
        ownerUserId: row.createdByUserId,
    }),
    visibilitySpec: {
        ownerUserIDColumnName: "createdByUserId",
        visiblePermissionIDColumnName: "visiblePermissionId",
    },
    tableAuthMap: xTableAuthMap,
    columns: [
        new PKField({ columnName: "id" }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
            allowSearchingThisField: false,
            authMap: xAuthMap,
        }),
        new ConstEnumStringField({
            columnName: "realm",
            allowNull: true,
            defaultValue: DynamicMenuLinkRealm.General,
            options: DynamicMenuLinkRealm,
            authMap: xAuthMap,
        }),
        new GenericStringField({
            columnName: "groupName",
            allowNull: false,
            format: "raw",
            authMap: xAuthMap,
        }),
        new GenericStringField({
            columnName: "groupCssClass",
            allowNull: false,
            format: "raw",
            authMap: xAuthMap,
        }),
        new GenericStringField({
            columnName: "itemCssClass",
            allowNull: false,
            format: "raw",
            authMap: xAuthMap,
        }),
        new ConstEnumStringField({
            columnName: "linkType",
            allowNull: false,
            defaultValue: DynamicMenuLinkType.ExternalURL,
            options: DynamicMenuLinkType,
            authMap: xAuthMap,
        }),
        new GenericStringField({
            columnName: "externalURI",
            allowNull: true,
            format: "uri",
            authMap: xAuthMap,
        }),
        new ConstEnumStringField({
            columnName: "applicationPage",
            allowNull: true,
            defaultValue: DynamicMenuLinkApplicationPage.BackstageHome,
            options: DynamicMenuLinkApplicationPage,
            authMap: xAuthMap,
        }),
        new GenericStringField({
            columnName: "wikiSlug",
            allowNull: true,
            format: "raw",
            authMap: xAuthMap,
        }),
        MakeIconField("iconName", gIconOptions, { authMap: xAuthMap, }),
        new GenericStringField({
            columnName: "caption",
            allowNull: false,
            format: "title",
            authMap: xAuthMap,
        }),
        MakeCreatedAtField("createdAt", { authMap: xAuthMap, }),
        new CreatedByUserField({
            columnName: "createdByUser",
            fkMember: "createdByUserId",
            authMap: xAuthMap,
        }),
        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
            authMap: xAuthMap,
        }),

    ]
});


