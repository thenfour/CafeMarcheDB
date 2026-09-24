import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xWikiPageTag } from "../../schema/wikiPageTag";

export const wikiPageTagEditorSelection = Prisma.validator<Prisma.WikiPageTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
    },
});

const wikiPageTagEditorContract = deriveViewContract(
    xWikiPageTag,
    wikiPageTagEditorSelection,
);

export const wikiPageTagEditorView = defineCrudView({
    viewID: "WikiPageTag_Editor",
    entity: xWikiPageTag,
    operations: { create: true, update: true, delete: true },
    selection: wikiPageTagEditorContract.prismaSelection,
    dtoSchema: wikiPageTagEditorContract.dtoSchema,
    hydrate: wikiPageTagEditorContract.hydrate,
});
