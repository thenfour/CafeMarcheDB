import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import { WikiPageTagAssignmentNaturalOrderBy } from "../../schema/prismArgs";
import { xWikiPage } from "../../schema/wiki";
import { graft } from "../common/viewCommon";

const wikiPageTagAssociationTransportSelection = {
    select: {
        publicId: true,
        tagId: true,
    },
    orderBy: WikiPageTagAssignmentNaturalOrderBy,
} as const;

const wikiPageTagAssociationProjectionSelection = {
    select: {
        // Projection support; hydration uses the dashboard reference.
        tag: { select: { publicId: true } },
    },
} as const;

const retainHydratedWikiPageTags = <
    TAssociation extends { tag?: unknown },
>(associations: readonly TAssociation[] | undefined) => (
    (associations ?? []).flatMap(association => association.tag == null ? [] : [{
        ...association,
        tag: association.tag,
    }])
);

const requireWikiPageSearchFields = <TPage extends {
    slug?: string;
    visiblePermissionId?: number | null;
}>(page: TPage) => {
    if (page.slug === undefined || page.visiblePermissionId === undefined) {
        throw new Error("WikiPage_Search returned an incomplete authorized row.");
    }
    return {
        ...page,
        slug: page.slug,
        visiblePermissionId: page.visiblePermissionId,
    };
};

const wikiPageEditorTransportSelection = Prisma.validator<Prisma.WikiPageDefaultArgs>()({
    select: {
        id: true,
        tags: wikiPageTagAssociationTransportSelection,
    },
});

const wikiPageEditorSelection = Prisma.validator<Prisma.WikiPageDefaultArgs>()(
    graft(wikiPageEditorTransportSelection, {
        select: {
            // Row authorization needs these values, but they stay outside the DTO.
            createdByUserId: true,
            visiblePermissionId: true,
            tags: wikiPageTagAssociationProjectionSelection,
        },
    }),
);

const wikiPageEditorContract = deriveViewContract(
    xWikiPage,
    wikiPageEditorSelection,
    {
        transportSelection: wikiPageEditorTransportSelection,
        references: dashboardReferenceContract,
    },
);

export const wikiPageEditorView = defineCrudView({
    viewID: "WikiPage_Editor",
    entity: xWikiPage,
    operations: { update: true },
    selection: wikiPageEditorSelection,
    dtoSchema: wikiPageEditorContract.dtoSchema,
    references: wikiPageEditorContract.referenceContract,
    hydrate: (dto, references) => {
        const hydrated = wikiPageEditorContract.hydrate(dto, references);
        return {
            ...hydrated,
            tags: retainHydratedWikiPageTags(hydrated.tags),
        };
    },
});

const wikiPageSearchTransportSelection = Prisma.validator<Prisma.WikiPageDefaultArgs>()({
    select: {
        id: true,
        slug: true,
        namespace: true,
        createdAt: true,
        createdByUser: {
            select: {
                id: true,
                name: true,
            },
        },
        visiblePermissionId: true,
        tags: wikiPageTagAssociationTransportSelection,
    },
});

export const wikiPageSearchSelection = Prisma.validator<Prisma.WikiPageDefaultArgs>()(
    graft(wikiPageSearchTransportSelection, {
        select: {
            createdByUserId: true,
            tags: wikiPageTagAssociationProjectionSelection,
        },
    }),
);

const wikiPageSearchContract = deriveViewContract(
    xWikiPage,
    wikiPageSearchSelection,
    {
        transportSelection: wikiPageSearchTransportSelection,
        references: dashboardReferenceContract,
    },
);

export const wikiPageSearchView = defineView({
    viewID: "WikiPage_Search",
    entity: xWikiPage,
    selection: wikiPageSearchSelection,
    dtoSchema: wikiPageSearchContract.dtoSchema,
    references: wikiPageSearchContract.referenceContract,
    hydrate: (dto, references) => {
        const hydrated = wikiPageSearchContract.hydrate(dto, references);
        return requireWikiPageSearchFields({
            ...hydrated,
            tags: retainHydratedWikiPageTags(hydrated.tags),
        });
    },
});

export type WikiPageEditorDto = DtoOf<typeof wikiPageEditorView>;
export type WikiPageEditorClient = ClientOf<typeof wikiPageEditorView>;
export type WikiPageSearchDto = DtoOf<typeof wikiPageSearchView>;
export type WikiPageSearchClient = ClientOf<typeof wikiPageSearchView>;
