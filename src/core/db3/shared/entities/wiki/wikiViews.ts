import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DbPayloadOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import { WikiPageTagAssignmentNaturalOrderBy } from "../../schema/prismArgs";
import { xWikiPage } from "../../schema/wiki";
import { graft } from "../common/viewCommon";
import type { PermissionPublicId } from "shared/publicId";

const wikiPageTagAssociationTransportSelection = {
    select: {
        publicId: true,
        tagId: true,
    },
    orderBy: WikiPageTagAssignmentNaturalOrderBy,
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
    visiblePermissionId?: PermissionPublicId | null;
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

const wikiPageEditorRequestedSelection = Prisma.validator<Prisma.WikiPageDefaultArgs>()(
    graft(wikiPageEditorTransportSelection, {
        select: {
            // Row authorization needs these values, but they stay outside the DTO.
            createdByUserId: true,
            visiblePermissionId: true,
        },
    }),
);

const wikiPageEditorContract = deriveViewContract(
    xWikiPage,
    wikiPageEditorRequestedSelection,
    {
        transportSelection: wikiPageEditorTransportSelection,
        references: dashboardReferenceContract,
    },
);

const wikiPageEditorSelection = wikiPageEditorContract.prismaSelection;

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

const wikiPageSearchRequestedSelection = Prisma.validator<Prisma.WikiPageDefaultArgs>()(
    graft(wikiPageSearchTransportSelection, {
        select: {
            createdByUserId: true,
        },
    }),
);

const wikiPageSearchContract = deriveViewContract(
    xWikiPage,
    wikiPageSearchRequestedSelection,
    {
        transportSelection: wikiPageSearchTransportSelection,
        references: dashboardReferenceContract,
    },
);

export const wikiPageSearchSelection = wikiPageSearchContract.prismaSelection;

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

export const wikiPageApiRevisionSelection = Prisma.validator<Prisma.WikiPageRevisionDefaultArgs>()({
    select: {
        id: true,
        name: true,
        content: true,
        createdAt: true,
        createdByUser: {
            select: {
                id: true,
                name: true,
            },
        },
    },
});

const wikiPageApiTransportSelection = Prisma.validator<Prisma.WikiPageDefaultArgs>()({
    select: {
        contentVersion: true,
        slug: true,
        namespace: true,
        visiblePermissionId: true,
        id: true,
        lockId: true,
        lockAcquiredAt: true,
        lockExpiresAt: true,
        lastEditPingAt: true,
        lockedByUser: {
            select: {
                id: true,
                name: true,
            },
        },
        currentRevision: wikiPageApiRevisionSelection,
    },
});

const wikiPageApiContract = deriveViewContract(
    xWikiPage,
    wikiPageApiTransportSelection,
);

export const wikiPageApiSelection = wikiPageApiContract.prismaSelection;

export const wikiPageApiView = defineView({
    viewID: "WikiPage_Api",
    entity: xWikiPage,
    selection: wikiPageApiSelection,
    dtoSchema: wikiPageApiContract.dtoSchema,
    references: wikiPageApiContract.referenceContract,
    hydrate: wikiPageApiContract.hydrate,
});

export type WikiPageEditorDto = DtoOf<typeof wikiPageEditorView>;
export type WikiPageEditorClient = ClientOf<typeof wikiPageEditorView>;
export type WikiPageSearchDto = DtoOf<typeof wikiPageSearchView>;
export type WikiPageSearchClient = ClientOf<typeof wikiPageSearchView>;
export type WikiPageApiDbPayload = DbPayloadOf<typeof wikiPageApiView>;
export type WikiPageApiClient = ClientOf<typeof wikiPageApiView>;
