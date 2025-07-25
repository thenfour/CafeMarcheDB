import { Prisma } from "db";
import { Permission } from "shared/permissions";
import {
    WikiPageTagArgs, WikiPageTagNaturalOrderBy, WikiPageTagPayload,
    WikiPageTagAssignmentArgs, WikiPageTagAssignmentNaturalOrderBy, WikiPageTagAssignmentPayload
} from "./prismArgs";
import { ForeignSingleField, GhostField, MakeColorField, MakePKfield, MakeSignificanceField, MakeSortOrderField } from "../db3basicFields";
import { DB3AuthContextPermissionMap, DB3AuthTablePermissionMap, xTable, xTableClientUsageContext } from "../db3core";
import { MakeDescriptionField, MakeTitleField } from "../genericStringField";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";

////////////////////////////////////////////////////////////////
export enum WikiPageTagSignificance {
    Tutorial = "Tutorial",
    Policy = "Policy",
    Project = "Project",
};

const authMap: DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.visibility_logged_in_users,
    PostQuery: Permission.visibility_logged_in_users,
    PreMutateAsOwner: Permission.visibility_logged_in_users,
    PreMutate: Permission.visibility_logged_in_users,
    PreInsert: Permission.visibility_logged_in_users,
} as const;

const xTableAuthMap: DB3AuthTablePermissionMap = {
    ViewOwn: Permission.visibility_logged_in_users,
    View: Permission.visibility_logged_in_users,
    EditOwn: Permission.visibility_logged_in_users,
    Edit: Permission.visibility_logged_in_users,
    Insert: Permission.visibility_logged_in_users,
} as const;

//////////////////////////////////////////////////////////////
export const xWikiPageTag = new xTable({
    getSelectionArgs: (clientIntention: xTableClientUsageContext): Prisma.WikiPageTagDefaultArgs => {
        return WikiPageTagArgs;
    },
    tableName: "WikiPageTag",
    tableAuthMap: xTableAuthMap,
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
        MakeTitleField("text", { authMap }),
        MakeDescriptionField({ authMap }),
        MakeColorField({ authMap }),
        MakeSortOrderField({ authMap }),
        MakeSignificanceField("significance", WikiPageTagSignificance, { authMap }),
        new GhostField({ memberName: "wikiPages", authMap }),
    ]
});

//////////////////////////////////////////////////////////////
export const xWikiPageTagAssignment = new xTable({
    tableName: "WikiPageTagAssignment",
    naturalOrderBy: WikiPageTagAssignmentNaturalOrderBy,
    tableAuthMap: xTableAuthMap,
    getSelectionArgs: (clientIntention: xTableClientUsageContext): Prisma.WikiPageTagAssignmentDefaultArgs => {
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
            authMap,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});
