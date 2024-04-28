
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { BoolField, ConstEnumStringField, ForeignSingleField, GenericStringField, GhostField, MakeCreatedAtField, MakeTitleField, PKField } from "../db3basicFields";
import * as db3 from "../db3core";
import { CreatedByUserField, VisiblePermissionField } from "./user";
import { gGeneralPaletteList } from "shared/color";

const xAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.visibility_logged_in_users,
    PostQuery: Permission.visibility_logged_in_users,
    PreMutateAsOwner: Permission.visibility_logged_in_users,
    PreMutate: Permission.visibility_logged_in_users,
    PreInsert: Permission.visibility_logged_in_users,
} as const;

const xTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.visibility_logged_in_users,
    View: Permission.visibility_logged_in_users,
    EditOwn: Permission.visibility_logged_in_users,
    Edit: Permission.visibility_logged_in_users,
    Insert: Permission.visibility_logged_in_users,
} as const;


////////////////////////////////////////////////////////////////
const WikiPageArgs = Prisma.validator<Prisma.WikiPageDefaultArgs>()({
    include: {
        visiblePermission: true,
    }
});

export type WikiPagePayload = Prisma.WikiPageGetPayload<typeof WikiPageArgs>;

export const WikiPageNaturalOrderBy: Prisma.WikiPageOrderByWithRelationInput[] = [
    { slug: 'asc' },
];

////////////////////////////////////////////////////////////////
export const xWikiPage = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.WikiPageInclude => {
        return WikiPageArgs.include;
    },
    tableName: "wikiPage",
    naturalOrderBy: WikiPageNaturalOrderBy,
    getRowInfo: (row: WikiPagePayload) => ({
        name: row.slug,
        description: undefined,
        color: gGeneralPaletteList.findEntry(row.visiblePermission?.color || null),
        ownerUserId: null,
    }),
    tableAuthMap: xTableAuthMap,
    visibilitySpec: {
        visiblePermissionIDColumnName: "visiblePermissionId",
        ownerUserIDColumnName: undefined,
    },
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "slug",
            allowNull: false,
            format: "title",
            authMap: xAuthMap,
        }),

        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
            authMap: xAuthMap,
        }),

    ]
});









////////////////////////////////////////////////////////////////
const WikiPageRevisionArgs = Prisma.validator<Prisma.WikiPageRevisionDefaultArgs>()({
    include: {
        wikiPage: {
            include: {
                visiblePermission: true,
            }
        },
        createdByUser: true,
    }
});

export type WikiPageRevisionPayload = Prisma.WikiPageRevisionGetPayload<typeof WikiPageRevisionArgs>;

export const WikiPageRevisionNaturalOrderBy: Prisma.WikiPageRevisionOrderByWithRelationInput[] = [
    { createdAt: "desc" },
];

export interface WikiPageRevisionTableParams {
    wikiPageSlug: string,
};

////////////////////////////////////////////////////////////////
export const xWikiPageRevision = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.WikiPageRevisionInclude => {
        return WikiPageRevisionArgs.include;
    },
    tableName: "wikiPageRevision",
    naturalOrderBy: WikiPageRevisionNaturalOrderBy,
    getRowInfo: (row: WikiPageRevisionPayload) => ({
        name: row.name,
        description: undefined,
        color: null,
        ownerUserId: null,
    }),
    tableAuthMap: xTableAuthMap,
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("name", { authMap: xAuthMap, }),
        new GenericStringField({
            columnName: "content",
            allowNull: false,
            format: "markdown",
            authMap: xAuthMap,
        }),
        new CreatedByUserField({
            columnName: "createdByUser",
            fkMember: "createdByUserId",
            authMap: xAuthMap,
        }),
        MakeCreatedAtField("createdAt", { authMap: xAuthMap, }),

        new ForeignSingleField<Prisma.WikiPageGetPayload<{}>>({
            columnName: "wikiPage",
            fkMember: "wikiPageId",
            allowNull: false,
            foreignTableID: "WikiPage",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xAuthMap,
        }),
    ]
});









