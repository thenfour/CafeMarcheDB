import { serverOwnedField } from "../columnTypes/inherited";
import { Prisma } from "db";
import { MysqlEscape } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { AuxUserArgs } from "types";
import { CMDBTableFilterModel } from "../apiTypes";
import { foreignRef, foreignRefByTableId, ForeignCollectionField, GenericIntegerField, GhostField, MakeCreatedAtField, MakePKfield, MakePublicIdField, tagsRef } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { MakeCreatedByField, MakeVisiblePermissionField } from "./user";
import { GenericStringField, MakeTitleField } from "../columnTypes/genericString";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";
import { xUser } from "./user";
import { z } from "zod";
import type { WikiPagePublicId, WikiPageRevisionPublicId } from "shared/publicId";

const wikiPageAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_wiki_pages,
    PostQuery: Permission.view_wiki_pages,
    PreMutateAsOwner: Permission.edit_wiki_pages,
    PreMutate: Permission.edit_wiki_pages,
    PreInsert: Permission.edit_wiki_pages,
});

const wikiPageTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_wiki_pages,
    View: Permission.view_wiki_pages,
    EditOwn: Permission.edit_wiki_pages,
    Edit: Permission.edit_wiki_pages,
    Insert: Permission.edit_wiki_pages,
} as const;

const wikiPageAdministrationAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_wiki_pages,
    PostQuery: Permission.view_wiki_pages,
    PreMutateAsOwner: Permission.admin_wiki_pages,
    PreMutate: Permission.admin_wiki_pages,
    PreInsert: Permission.admin_wiki_pages,
});

const wikiPageRevisionAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: Permission.admin_wiki_pages,
    PreMutate: Permission.admin_wiki_pages,
    PreInsert: Permission.admin_wiki_pages,
});

const wikiPageRevisionCollectionAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_wiki_page_revisions,
    PostQuery: Permission.view_wiki_page_revisions,
    PreMutateAsOwner: Permission.admin_wiki_pages,
    PreMutate: Permission.admin_wiki_pages,
    PreInsert: Permission.admin_wiki_pages,
});

const wikiPageRevisionTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_wiki_page_revisions,
    View: Permission.view_wiki_page_revisions,
    EditOwn: Permission.admin_wiki_pages,
    Edit: Permission.admin_wiki_pages,
    Insert: Permission.admin_wiki_pages,
} as const;

const wikiPageCurrentRevisionAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_wiki_pages,
    PostQuery: Permission.view_wiki_pages,
    PreMutateAsOwner: Permission.admin_wiki_pages,
    PreMutate: Permission.admin_wiki_pages,
    PreInsert: Permission.admin_wiki_pages,
});


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

function makeWikiContentSearchField() {
    const field = new GhostField({ authMap: wikiPageAuthMap, memberName: "contentSearch" });
    // Current content must belong to the visible parent, including malformed revision pointers.
    // lsmb todo: make this type-safe; misspellings or errors / schema changes won't
    // be caught by the compiler here. see bandUser for an example where we tie raw sql to the schema.
    field.SqlGetQuickFilterElementsForToken = token => `EXISTS (
        SELECT 1 FROM WikiPageRevision wpr
        WHERE wpr.id = P.currentRevisionId AND wpr.wikiPageId = P.id
        AND wpr.content LIKE '%${MysqlEscape(token)}%'
    )`;
    return field;
}

////////////////////////////////////////////////////////////////
export const xWikiPage = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.WikiPageDelegate>(),
    getIdentity: (page: { publicId: WikiPagePublicId }) => page.publicId,
    getSelectionArgs: (): Prisma.WikiPageDefaultArgs => {
        return WikiPageArgs;
    },
    tableName: "WikiPage",
    bandScope: { member: "bandId", managePermission: Permission.edit_wiki_pages },
    readConsistency: "snapshot",
    deletePolicy: "hard",
    naturalOrderBy: WikiPageNaturalOrderBy,
    getRowInfo: (row: WikiPagePayload) => ({
        pk: row.publicId,
        name: row.slug,
        description: undefined,
        color: gGeneralPaletteList.findEntry(row.visiblePermission?.color || null),
        ownerUserId: row.createdByUserId,
    }),
    tableAuthMap: wikiPageTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<WikiPagePublicId>(),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName, allowNull: false, allowSearchingThisField: false,
            authMap: db3.defineAuthMap({
                PostQuery: Permission.never_grant, PostQueryAsOwner: Permission.never_grant,
                PreInsert: Permission.never_grant, PreMutate: Permission.never_grant, PreMutateAsOwner: Permission.never_grant,
            }),
        })),
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
        tags: tagsRef("WikiPageTagAssignment", "BandWikiPageTag", {
            associationForeignIDMember: "bandWikiPageTagId",
            associationForeignObjectMember: "tag",
            associationLocalObjectMember: "wikiPage",
            authMap: wikiPageAuthMap,
            // A1 defers localized tag-name text matching; identity filters and labels stay active.
            getQuickFilterWhereClause: (): false => false,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.WikiPageWhereInput | boolean => false,
        }),
        currentRevision: foreignRefByTableId("WikiPageCurrentRevision", {
            fkidMember: "currentRevisionId",
            allowNull: true,
            authMap: wikiPageCurrentRevisionAuthMap,
        }),
        revisions: memberName => new ForeignCollectionField({
            memberName,
            foreignTableID: "WikiPageRevision",
            authMap: wikiPageRevisionCollectionAuthMap,
        }),
        lockedByUser: foreignRef(() => xUser, {
            fkidMember: "lockedByUserId",
            allowNull: true,
            authMap: wikiPageAdministrationAuthMap,
        }),
        lockAcquiredAt: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
            readTransportSchema: z.date().nullable(),
        }),
        lockExpiresAt: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
            readTransportSchema: z.date().nullable(),
        }),
        lastEditPingAt: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
            readTransportSchema: z.date().nullable(),
        }),
        lockId: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
            readTransportSchema: z.string().nullable(),
        }),
        contentVersion: memberName => new GhostField({
            authMap: wikiPageAdministrationAuthMap,
            memberName,
            readTransportSchema: z.number().int(),
        }),

        contentSearch: makeWikiContentSearchField,
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

////////////////////////////////////////////////////////////////
export const xWikiPageRevision = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.WikiPageRevisionDelegate>(),
    getIdentity: (revision: { publicId: WikiPageRevisionPublicId }) => revision.publicId,
    queryParameters: {
        userId: { kind: "entityIdentity", targetTableID: "User", authorizeAs: "createdByUser" },
    } satisfies db3.DB3QueryParameterMap,
    getParameterizedWhereClause: (params: { userId?: number }, auth): Prisma.WikiPageRevisionWhereInput[] => [
        { wikiPage: xWikiPage.CalculateWhereClause({ filterModel: {}, auth, includeDeleted: false }) },
        ...(params.userId === undefined ? [] : [{ createdByUserId: params.userId }]),
    ],
    getSelectionArgs: (): Prisma.WikiPageRevisionDefaultArgs => {
        return WikiPageRevisionArgs;
    },
    tableName: "WikiPageRevision",
    bandScope: { member: "bandId", via: { relation: "wikiPage", ownerUserMember: "createdByUserId" }, managePermission: Permission.admin_wiki_pages },
    readConsistency: "snapshot",
    deletePolicy: "hard",
    naturalOrderBy: WikiPageRevisionNaturalOrderBy,
    getRowInfo: (row: WikiPageRevisionPayload) => ({
        pk: row.publicId,
        name: row.name,
        description: undefined,
        color: null,
        ownerUserId: null,
    }),
    tableAuthMap: wikiPageRevisionTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<WikiPageRevisionPublicId>(),
        name: columnName => MakeTitleField(columnName, { authMap: wikiPageRevisionAuthMap, }),
        createdByUser: () => MakeCreatedByField(),
        createdAt: () => MakeCreatedAtField({ authMap: wikiPageRevisionAuthMap }),
        content: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "markdown",
            authMap: wikiPageRevisionAuthMap,
        }),
        consolidationKey: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "plain",
            authMap: wikiPageRevisionAuthMap,
        }),
        linesAdded: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        linesRemoved: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        prevLineCount: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        lineCount: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        charsAdded: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        charsRemoved: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        sizeChars: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        prevSizeChars: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),

        wikiPage: foreignRef(() => xWikiPage, {
            fkidMember: "wikiPageId",
            authMap: wikiPageRevisionAuthMap,
        }),
    })
});

/** Current content is readable with its page; revision history has a separate grant. */
// TODO: there should be a SINGLE table def for this table, and differences here should be expressed
// via views.
export const xWikiPageCurrentRevision = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.WikiPageRevisionDelegate>(),
    getIdentity: (revision: { publicId: WikiPageRevisionPublicId }) => revision.publicId,
    tableName: "WikiPageRevision",
    tableUniqueName: "WikiPageCurrentRevision",
    queryParameters: {},
    bandScope: { member: "bandId", via: { relation: "wikiPage", ownerUserMember: "createdByUserId" }, managePermission: Permission.admin_wiki_pages },
    readConsistency: "snapshot",
    deletePolicy: "disabled",
    getSelectionArgs: () => Prisma.validator<Prisma.WikiPageRevisionDefaultArgs>()({
        select: { publicId: true, name: true, content: true, createdAt: true },
    }),
    getParameterizedWhereClause: (_params: {}, auth): Prisma.WikiPageRevisionWhereInput[] => [{
        pageAsCurrent: xWikiPage.CalculateWhereClause({ filterModel: {}, auth, includeDeleted: false }),
        wikiPage: xWikiPage.CalculateWhereClause({ filterModel: {}, auth, includeDeleted: false }),
    }],
    tableAuthMap: {
        View: Permission.view_wiki_pages, ViewOwn: Permission.view_wiki_pages,
        Insert: Permission.never_grant, Edit: Permission.never_grant, EditOwn: Permission.never_grant,
    },
    getRowInfo: (row: { publicId: WikiPageRevisionPublicId; name: string }) => ({ pk: row.publicId, name: row.name, ownerUserId: null }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<WikiPageRevisionPublicId>(),
        name: columnName => MakeTitleField(columnName, { authMap: wikiPageRevisionAuthMap }),
        content: columnName => new GenericStringField({ columnName, allowNull: false, format: "markdown", authMap: wikiPageRevisionAuthMap }),
        createdAt: () => MakeCreatedAtField({ authMap: wikiPageRevisionAuthMap }),
        createdByUser: () => MakeCreatedByField(),
        consolidationKey: columnName => new GenericStringField({ columnName, allowNull: true, format: "plain", authMap: wikiPageRevisionAuthMap }),
        linesAdded: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        linesRemoved: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        prevLineCount: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        lineCount: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        charsAdded: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        charsRemoved: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        sizeChars: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        prevSizeChars: columnName => new GenericIntegerField({ columnName, allowNull: true, authMap: wikiPageRevisionAuthMap }),
        wikiPage: foreignRefByTableId("WikiPage", {
            fkidMember: "wikiPageId",
            authMap: db3.defineAuthMap({
                PostQuery: Permission.never_grant, PostQueryAsOwner: Permission.never_grant,
                PreInsert: Permission.never_grant, PreMutate: Permission.never_grant, PreMutateAsOwner: Permission.never_grant,
            }),
        }),
    }),
});

// statically-typed registration
// allows retaining type information even when looking up a table by
// static string table id.
declare module "../db3core" {
    interface DB3TableTypeRegistry {
        WikiPage: typeof xWikiPage;
        WikiPageRevision: typeof xWikiPageRevision;
        WikiPageCurrentRevision: typeof xWikiPageCurrentRevision;
    }
}
