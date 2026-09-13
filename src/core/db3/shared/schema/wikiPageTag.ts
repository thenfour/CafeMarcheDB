import { Prisma } from "db";
import { Permission } from "shared/permissions";
import {
    WikiPageTagArgs, WikiPageTagNaturalOrderBy, WikiPageTagPayload,
    WikiPageTagAssignmentArgs, WikiPageTagAssignmentNaturalOrderBy, WikiPageTagAssignmentPayload
} from "./prismArgs";
import { ForeignSingleField, GhostField, MakeColorField, MakePKfield, MakeSignificanceField, MakeSortOrderField } from "../db3basicFields";
import { DB3AuthContextPermissionMap, DB3AuthTablePermissionMap, xTable } from "../db3core";
import { MakeDescriptionField, MakeTitleField } from "../genericStringField";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";

////////////////////////////////////////////////////////////////
export enum WikiPageTagSignificance {
    Tutorial = "Tutorial",
    Policy = "Policy",
    Project = "Project",
};

const wikiPageTagAuthMap: DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_wiki_pages,
    PostQuery: Permission.view_wiki_pages,
    PreMutateAsOwner: Permission.admin_wiki_pages,
    PreMutate: Permission.admin_wiki_pages,
    PreInsert: Permission.admin_wiki_pages,
} as const;

const wikiPageTagTableAuthMap: DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_wiki_pages,
    View: Permission.view_wiki_pages,
    EditOwn: Permission.admin_wiki_pages,
    Edit: Permission.admin_wiki_pages,
    Insert: Permission.admin_wiki_pages,
} as const;

const wikiPageTagAssignmentAuthMap: DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_wiki_pages,
    PostQuery: Permission.view_wiki_pages,
    PreMutateAsOwner: Permission.edit_wiki_pages,
    PreMutate: Permission.edit_wiki_pages,
    PreInsert: Permission.edit_wiki_pages,
} as const;

const wikiPageTagAssignmentTableAuthMap: DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_wiki_pages,
    View: Permission.view_wiki_pages,
    EditOwn: Permission.edit_wiki_pages,
    Edit: Permission.edit_wiki_pages,
    Insert: Permission.edit_wiki_pages,
} as const;

//////////////////////////////////////////////////////////////
export const xWikiPageTag = new xTable({
    getSelectionArgs: (): Prisma.WikiPageTagDefaultArgs => {
        return WikiPageTagArgs;
    },
    tableName: "WikiPageTag",
    deletePolicy: "hard",
    tableAuthMap: wikiPageTagTableAuthMap,
    naturalOrderBy: WikiPageTagNaturalOrderBy,
    createInsertModelFromString: (input: string): Prisma.WikiPageTagCreateInput => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
            significance: null,
        };
    },
    getRowInfo: (row: WikiPageTagPayload) => ({
        pk: row.id,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        MakeTitleField("text", { authMap: wikiPageTagAuthMap }),
        MakeDescriptionField({ authMap: wikiPageTagAuthMap }),
        MakeColorField({ authMap: wikiPageTagAuthMap }),
        MakeSortOrderField({ authMap: wikiPageTagAuthMap }),
        MakeSignificanceField("significance", WikiPageTagSignificance, { authMap: wikiPageTagAuthMap }),
        new GhostField({ memberName: "wikiPages", authMap: wikiPageTagAuthMap }),
    ]
});

//////////////////////////////////////////////////////////////
export const xWikiPageTagAssignment = new xTable({
    tableName: "WikiPageTagAssignment",
    deletePolicy: "hard",
    naturalOrderBy: WikiPageTagAssignmentNaturalOrderBy,
    tableAuthMap: wikiPageTagAssignmentTableAuthMap,
    getSelectionArgs: (): Prisma.WikiPageTagAssignmentDefaultArgs => {
        return WikiPageTagAssignmentArgs;
    },
    getRowInfo: (row: WikiPageTagAssignmentPayload) => {
        return {
            pk: row.id,
            name: row.tag?.text || "",
            description: row.tag?.description || "",
            color: gGeneralPaletteList.findEntry(row.tag?.color || null),
            ownerUserId: null,
        };
    },
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.WikiPageTagGetPayload<{}>>({
            columnName: "tag",
            fkidMember: "tagId",
            allowNull: false,
            foreignTableID: "WikiPageTag",
            authMap: wikiPageTagAssignmentAuthMap,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});
