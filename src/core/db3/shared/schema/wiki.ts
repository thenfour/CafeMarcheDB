import { Prisma } from "db";
import { MysqlEscape } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { AuxUserArgs } from "types";
import { CMDBTableFilterModel } from "../apiTypes";
import { ForeignSingleField, GhostField, MakeCreatedAtField, MakePKfield, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { MakeCreatedByField, MakeVisiblePermissionField } from "./user";
import { GenericStringField, MakeTitleField } from "../genericStringField";
import { WikiPageTagAssignmentPayload } from "./prismArgs";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";

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
        createdByUser: AuxUserArgs,
        tags: {
            include: {
                tag: true,
            }
        }
    }
});

export type WikiPagePayload = Prisma.WikiPageGetPayload<typeof WikiPageArgs>;

export const WikiPageNaturalOrderBy: Prisma.WikiPageOrderByWithRelationInput[] = [
    { slug: 'asc' },
];

////////////////////////////////////////////////////////////////
export const xWikiPage = new db3.xTable({
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.WikiPageDefaultArgs => {
        return WikiPageArgs;
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
    columns: [
        MakePKfield(),
        MakeCreatedByField(),
        MakeCreatedAtField(),
        MakeVisiblePermissionField({ authMap: xAuthMap, }),
        new GenericStringField({
            columnName: "slug",
            allowNull: false,
            format: "title",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xAuthMap,
        }),
        new GenericStringField({
            columnName: "namespace",
            allowNull: true,
            format: "plain",
            allowDiscreteCriteria: true,
            authMap: xAuthMap,
        }),
        new TagsField<WikiPageTagAssignmentPayload>({
            columnName: "tags",
            associationForeignIDMember: "tagId",
            associationForeignObjectMember: "tag",
            associationLocalIDMember: "wikiPageId",
            associationLocalObjectMember: "wikiPage",
            associationTableID: "WikiPageTagAssignment",
            foreignTableID: "WikiPageTag",
            authMap: xAuthMap,
            getQuickFilterWhereClause: (query: string): Prisma.WikiPageWhereInput => ({
                tags: {
                    some: {
                        tag: {
                            text: { contains: query }
                        }
                    }
                }
            }),
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.WikiPageWhereInput | boolean => false,
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

        // Virtual field for searching wiki page content; hackhack
        (() => {
            const contentSearchField = new GhostField({
                authMap: xAuthMap,
                memberName: "contentSearch",
            });

            // Override the SqlGetQuickFilterElementsForToken method to search currentRevision.content
            contentSearchField.SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => {
                // Return SQL that searches the current revision's content
                return `EXISTS (
                    SELECT 1 
                    FROM WikiPageRevision wpr 
                    WHERE wpr.id = P.currentRevisionId 
                    AND wpr.content LIKE '%${MysqlEscape(token)}%'
                )`;
            };

            return contentSearchField;
        })(),
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
    getSelectionArgs: (clientIntention: db3.xTableClientUsageContext): Prisma.WikiPageRevisionDefaultArgs => {
        return WikiPageRevisionArgs;
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
        MakePKfield(),
        MakeTitleField("name", { authMap: xAuthMap, }),
        MakeCreatedByField(),
        MakeCreatedAtField(),
        new GenericStringField({
            columnName: "content",
            allowNull: false,
            format: "markdown",
            authMap: xAuthMap,
        }),

        new ForeignSingleField<Prisma.WikiPageGetPayload<{}>>({
            columnName: "wikiPage",
            fkidMember: "wikiPageId",
            allowNull: false,
            foreignTableID: "WikiPage",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: xAuthMap,
        }),
    ]
});









