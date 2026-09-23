import { Prisma } from "db";
import { Permission } from "shared/permissions";
import {
    WikiPageTagArgs, WikiPageTagNaturalOrderBy, WikiPageTagPayload,
    WikiPageTagAssignmentArgs, WikiPageTagAssignmentNaturalOrderBy, WikiPageTagAssignmentPayload
} from "./prismArgs";
import { foreignRef, GhostField, MakeColorField, MakePKfield, MakeSignificanceField, MakeSortOrderField } from "../columnTypes/xTableColumnTypes";
import { DB3AuthTablePermissionMap, defineAuthMap, defineTable, makeColumnSet, prismaModel } from "../db3core";
import { MakeDescriptionField, MakeTitleField } from "../columnTypes/genericString";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";

////////////////////////////////////////////////////////////////
export enum WikiPageTagSignificance {
    Tutorial = "Tutorial",
    Policy = "Policy",
    Project = "Project",
};

const wikiPageTagAuthMap = defineAuthMap({
    PostQueryAsOwner: Permission.view_wiki_pages,
    PostQuery: Permission.view_wiki_pages,
    PreMutateAsOwner: Permission.admin_wiki_pages,
    PreMutate: Permission.admin_wiki_pages,
    PreInsert: Permission.admin_wiki_pages,
});

const wikiPageTagTableAuthMap: DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_wiki_pages,
    View: Permission.view_wiki_pages,
    EditOwn: Permission.admin_wiki_pages,
    Edit: Permission.admin_wiki_pages,
    Insert: Permission.admin_wiki_pages,
} as const;

const wikiPageTagAssignmentAuthMap = defineAuthMap({
    PostQueryAsOwner: Permission.view_wiki_pages,
    PostQuery: Permission.view_wiki_pages,
    PreMutateAsOwner: Permission.edit_wiki_pages,
    PreMutate: Permission.edit_wiki_pages,
    PreInsert: Permission.edit_wiki_pages,
});

const wikiPageTagAssignmentTableAuthMap: DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_wiki_pages,
    View: Permission.view_wiki_pages,
    EditOwn: Permission.edit_wiki_pages,
    Edit: Permission.edit_wiki_pages,
    Insert: Permission.edit_wiki_pages,
} as const;

//////////////////////////////////////////////////////////////
export const xWikiPageTag = defineTable({
    prismaModel: prismaModel<Prisma.WikiPageTagDelegate>(),
    getIdentity: (tag: Prisma.WikiPageTagGetPayload<{}>) => tag.id,
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
    fields: makeColumnSet({
        id: () => MakePKfield(),
        text: columnName => MakeTitleField(columnName, { authMap: wikiPageTagAuthMap }),
        description: () => MakeDescriptionField({ authMap: wikiPageTagAuthMap }),
        color: () => MakeColorField({ authMap: wikiPageTagAuthMap }),
        sortOrder: () => MakeSortOrderField({ authMap: wikiPageTagAuthMap }),
        significance: columnName => MakeSignificanceField(columnName, WikiPageTagSignificance, { authMap: wikiPageTagAuthMap }),
        wikiPages: memberName => new GhostField({ memberName, authMap: wikiPageTagAuthMap }),
    })
});

//////////////////////////////////////////////////////////////
export const xWikiPageTagAssignment = defineTable({
    prismaModel: prismaModel<Prisma.WikiPageTagAssignmentDelegate>(),
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
    fields: makeColumnSet({
        id: () => MakePKfield(),
        tag: foreignRef(() => xWikiPageTag, {
            fkidMember: "tagId",
            authMap: wikiPageTagAssignmentAuthMap,
        }),
    })
});
