
import { Prisma } from "db";
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { AuxUserArgs } from "types";
import { ForeignSingleField, GenericStringField, GhostField, MakeCreatedAtField, MakeTitleField, PKField } from "../db3basicFields";
import * as db3 from "../db3core";
import { CreatedByUserField, VisiblePermissionField } from "./user";

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
    tableName: "WikiPage",
    naturalOrderBy: WikiPageNaturalOrderBy,
    getRowInfo: (row: WikiPagePayload) => ({
        pk: row.id,
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
        new GhostField({
            authMap: xAuthMap,
            memberName: "namespace",
        }),
        new GhostField({
            authMap: xAuthMap,
            memberName: "currentRevisionId",
        }),
        new GhostField({
            authMap: xAuthMap,
            memberName: "lockedByUserId",
        }),
        new GhostField({
            authMap: xAuthMap,
            memberName: "lockAcquiredAt",
        }),
        new GhostField({
            authMap: xAuthMap,
            memberName: "lockExpiresAt",
        }),
        new GhostField({
            authMap: xAuthMap,
            memberName: "lastEditPingAt",
        }),
        new GhostField({
            authMap: xAuthMap,
            memberName: "lockId",
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
        wikiPage: true,
        createdByUser: AuxUserArgs,
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
    tableName: "WikiPageRevision",
    naturalOrderBy: WikiPageRevisionNaturalOrderBy,
    getRowInfo: (row: WikiPageRevisionPayload) => ({
        pk: row.id,
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









