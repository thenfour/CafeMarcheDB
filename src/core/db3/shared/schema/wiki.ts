import { Prisma } from "db";
import { MysqlEscape } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { AuxUserArgs } from "types";
import { CMDBTableFilterModel } from "../apiTypes";
import { ForeignSingleField, GhostField, MakeCreatedAtField, MakePKfield, TagsField } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { MakeCreatedByField, MakeVisiblePermissionField } from "./user";
import { GenericStringField, MakeTitleField } from "../columnTypes/genericString";
import { WikiPageTagAssignmentPayload } from "./prismArgs";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";

const wikiPageAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_wiki_pages,
    PostQuery: Permission.view_wiki_pages,
    PreMutateAsOwner: Permission.edit_wiki_pages,
    PreMutate: Permission.edit_wiki_pages,
    PreInsert: Permission.edit_wiki_pages,
} as const;

const wikiPageTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_wiki_pages,
    View: Permission.view_wiki_pages,
    EditOwn: Permission.edit_wiki_pages,
    Edit: Permission.edit_wiki_pages,
    Insert: Permission.edit_wiki_pages,
} as const;

const wikiPageAdministrationAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_wiki_pages,
    PostQuery: Permission.view_wiki_pages,
    PreMutateAsOwner: Permission.admin_wiki_pages,
    PreMutate: Permission.admin_wiki_pages,
    PreInsert: Permission.admin_wiki_pages,
} as const;

const wikiPageRevisionAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_wiki_page_revisions,
    PostQuery: Permission.view_wiki_page_revisions,
    PreMutateAsOwner: Permission.admin_wiki_pages,
    PreMutate: Permission.admin_wiki_pages,
    PreInsert: Permission.admin_wiki_pages,
} as const;

const wikiPageRevisionTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_wiki_page_revisions,
    View: Permission.view_wiki_page_revisions,
    EditOwn: Permission.admin_wiki_pages,
    Edit: Permission.admin_wiki_pages,
    Insert: Permission.admin_wiki_pages,
} as const;

const wikiPageCurrentRevisionAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_wiki_page_revisions,
    PostQuery: Permission.view_wiki_page_revisions,
    PreMutateAsOwner: Permission.admin_wiki_pages,
    PreMutate: Permission.admin_wiki_pages,
    PreInsert: Permission.admin_wiki_pages,
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
export const xWikiPage = db3.defineTable({
    getSelectionArgs: (): Prisma.WikiPageDefaultArgs => {
        return WikiPageArgs;
    },
    tableName: "WikiPage",
    deletePolicy: "hard",
    naturalOrderBy: WikiPageNaturalOrderBy,
    getRowInfo: (row: WikiPagePayload) => ({
        pk: row.id,
        name: row.slug,
        description: undefined,
        color: gGeneralPaletteList.findEntry(row.visiblePermission?.color || null),
        ownerUserId: null,
    }),
    tableAuthMap: wikiPageTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        createdByUser: () => MakeCreatedByField(),
        createdAt: () => MakeCreatedAtField(),
        visiblePermission: () => MakeVisiblePermissionField({ authMap: wikiPageAuthMap, }),
        slug: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "title",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: wikiPageAuthMap,
        }),
        namespace: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "plain",
            allowDiscreteCriteria: true,
            authMap: wikiPageAuthMap,
        }),
        tags: columnName => new TagsField<WikiPageTagAssignmentPayload>({
            columnName,
            associationForeignIDMember: "tagId",
            associationForeignObjectMember: "tag",
            associationLocalIDMember: "wikiPageId",
            associationLocalObjectMember: "wikiPage",
            associationTableID: "WikiPageTagAssignment",
            foreignTableID: "WikiPageTag",
            authMap: wikiPageAuthMap,
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
        currentRevision: columnName => new ForeignSingleField<Prisma.WikiPageRevisionGetPayload<{}>>({
            columnName,
            fkidMember: "currentRevisionId",
            allowNull: true,
            foreignTableID: "WikiPageRevision",
            authMap: wikiPageCurrentRevisionAuthMap,
            getQuickFilterWhereClause: () => false,
        }),
        lockedByUserId: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
        }),
        lockAcquiredAt: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
        }),
        lockExpiresAt: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
        }),
        lastEditPingAt: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
        }),
        lockId: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
        }),
        contentVersion: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
        }),

        // Virtual field for searching wiki page content; hackhack
        contentSearch: () => (() => {
            const contentSearchField = new GhostField({
                authMap: wikiPageAdministrationAuthMap,
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
    })
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
export const xWikiPageRevision = db3.defineTable({
    getSelectionArgs: (): Prisma.WikiPageRevisionDefaultArgs => {
        return WikiPageRevisionArgs;
    },
    tableName: "WikiPageRevision",
    deletePolicy: "hard",
    naturalOrderBy: WikiPageRevisionNaturalOrderBy,
    getRowInfo: (row: WikiPageRevisionPayload) => ({
        pk: row.id,
        name: row.name,
        description: undefined,
        color: null,
        ownerUserId: null,
    }),
    tableAuthMap: wikiPageRevisionTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        name: columnName => MakeTitleField(columnName, { authMap: wikiPageRevisionAuthMap, }),
        createdByUser: () => MakeCreatedByField(),
        createdAt: () => MakeCreatedAtField(),
        content: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "markdown",
            authMap: wikiPageRevisionAuthMap,
        }),

        wikiPage: columnName => new ForeignSingleField<Prisma.WikiPageGetPayload<{}>>({
            columnName,
            fkidMember: "wikiPageId",
            allowNull: false,
            foreignTableID: "WikiPage",
            getQuickFilterWhereClause: (query: string) => false,
            authMap: wikiPageRevisionAuthMap,
        }),
    })
});









