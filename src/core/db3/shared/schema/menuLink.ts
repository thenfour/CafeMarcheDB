import { BandPermission, kGlobalVisibilityPermissionPolicy } from "src/auth/shared/bandPermissionPolicy";

import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type { MenuLinkPublicId } from "shared/publicId";
import { gIconOptions } from "shared/utils";
import { DynamicMenuLinkRealm, DynamicMenuLinkType } from "../../../../../shared/dynMenuTypes";
import { GenericStringField } from "../columnTypes/genericString";
import { serverOwnedField } from "../columnTypes/inherited";
import { LocalizedStringField, localizedText } from "../columnTypes/localizedString";
import { ConstEnumStringField, GenericIntegerField, MakeCreatedAtField, MakeIconField, MakePKfield, MakePublicIdField, MakeSortOrderField } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { UserMinimalSelect } from "./prismArgs";
import { MakeCreatedByField, MakeVisiblePermissionField } from "./user";

const xAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: BandPermission.customize_menu,
    PreMutate: BandPermission.customize_menu,
    PreInsert: BandPermission.customize_menu,
});

const xTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.public,
    View: Permission.public,
    EditOwn: BandPermission.customize_menu,
    Edit: BandPermission.customize_menu,
    Insert: BandPermission.customize_menu,
} as const;


export const MenuLinkArgs = Prisma.validator<Prisma.MenuLinkDefaultArgs>()({
    include: {
        caption: true,
        createdByUser: { select: UserMinimalSelect },
        visiblePermission: true, // for creating new items, the payload should include this object.
    }
});

export type MenuLinkPayload = Prisma.MenuLinkGetPayload<typeof MenuLinkArgs>;

export const MenuLinkNaturalOrderBy = { sortOrder: "asc" } satisfies Prisma.MenuLinkOrderByWithRelationInput;

////////////////////////////////////////////////////////////////
export const xMenuLink = db3.defineTable({
    globalVisibilityPermission: kGlobalVisibilityPermissionPolicy,
    prismaModel: db3.prismaModel<Prisma.MenuLinkDelegate>(),
    getIdentity: (link: { publicId: MenuLinkPublicId }) => link.publicId,
    getSelectionArgs: (): Prisma.MenuLinkDefaultArgs => {
        return MenuLinkArgs;
    },
    tableName: "MenuLink",
    bandScope: { member: "bandId", managePermission: BandPermission.customize_menu },
    queryStrategy: "resolved",
    deletePolicy: "hard",
    naturalOrderBy: MenuLinkNaturalOrderBy,
    getRowInfo: (row: MenuLinkPayload) => ({
        pk: row.publicId,
        name: localizedText(row.caption) ?? "",
        description: undefined,
        color: null,
        iconName: row.iconName,
        ownerUserId: row.createdByUserId,
    }),
    tableAuthMap: xTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<MenuLinkPublicId>(),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName, allowNull: false, allowSearchingThisField: false,
            authMap: db3.defineAuthMap({
                PostQuery: Permission.never_grant, PostQueryAsOwner: Permission.never_grant,
                PreInsert: Permission.never_grant, PreMutate: Permission.never_grant, PreMutateAsOwner: Permission.never_grant,
            }),
        })),
        iconName: columnName => MakeIconField(columnName, gIconOptions, { authMap: xAuthMap, }),
        sortOrder: () => MakeSortOrderField({ authMap: xAuthMap, }),
        createdAt: () => MakeCreatedAtField({}),
        createdByUser: () => MakeCreatedByField(),
        visiblePermission: () => MakeVisiblePermissionField({ authMap: xAuthMap }),
        caption: columnName => new LocalizedStringField({
            columnName, stringIdentityMember: "captionId", stringFormat: "PlainText", writeScope: "band", authMap: xAuthMap,
        }),

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


