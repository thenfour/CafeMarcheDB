import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type { WikiPageTagAssignmentPublicId } from "shared/publicId";
import { gGeneralPaletteList } from "src/core/components/color/palette";
import { WikiPageTagAssignmentArgs, WikiPageTagAssignmentNaturalOrderBy, type WikiPageTagAssignmentPayload } from "./prismArgs";
import { foreignRef, foreignRefByTableId, MakePKfield, MakePublicIdField } from "../columnTypes/xTableColumnTypes";
import { GetTableById, DB3FieldReadAuth, defineAuthMap, defineTable, makeColumnSet, prismaModel } from "../db3core";
import { localizedText } from "../columnTypes/localizedString";
import { catalogColor } from "../columnTypes/bandCatalog";
import { xBandWikiPageTag } from "../entities/wikiPageTag/wikiPageTagViews";

const assignmentAuthMap = defineAuthMap({
    PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
    PostQuery: DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: Permission.edit_wiki_pages,
    PreMutate: Permission.edit_wiki_pages,
    PreInsert: Permission.edit_wiki_pages,
});

export const xWikiPageTagAssignment = defineTable({
    prismaModel: prismaModel<Prisma.WikiPageTagAssignmentDelegate>(),
    getIdentity: (row: { publicId: WikiPageTagAssignmentPublicId }) => row.publicId,
    tableName: "WikiPageTagAssignment",
    bandScope: { member: "bandId", via: { relation: "wikiPage", ownerUserMember: "createdByUserId" }, managePermission: Permission.edit_wiki_pages },
    readConsistency: "snapshot",
    queryParameters: {},
    getParameterizedWhereClause: (_params, auth) => [{ wikiPage: GetTableById("WikiPage").CalculateWhereClause({ filterModel: {}, auth }) }],
    deletePolicy: "hard",
    naturalOrderBy: WikiPageTagAssignmentNaturalOrderBy,
    tableAuthMap: {
        ViewOwn: Permission.view_wiki_pages,
        View: Permission.view_wiki_pages,
        EditOwn: Permission.edit_wiki_pages,
        Edit: Permission.edit_wiki_pages,
        Insert: Permission.edit_wiki_pages,
    },
    getSelectionArgs: () => WikiPageTagAssignmentArgs,
    getRowInfo: (row: WikiPageTagAssignmentPayload) => ({
        pk: row.publicId,
        name: localizedText(row.tag?.name) ?? "",
        description: localizedText(row.tag?.description) ?? "",
        color: catalogColor(row.tag?.color, gGeneralPaletteList),
        ownerUserId: null,
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<WikiPageTagAssignmentPublicId>(),
        wikiPage: foreignRefByTableId("WikiPage", { fkidMember: "wikiPageId", authMap: assignmentAuthMap }),
        tag: foreignRef(() => xBandWikiPageTag, { fkidMember: "bandWikiPageTagId", authMap: assignmentAuthMap }),
    }),
});

declare module "../db3core" {
    interface DB3TableTypeRegistry {
        WikiPageTagAssignment: typeof xWikiPageTagAssignment;
    }
}
