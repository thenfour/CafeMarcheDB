import { Prisma } from "db";

import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { PermissionForVisibilityArgs, SongTagAssociationNaturalOrderBy, type SongTagClientPayload } from "../../schema/prismArgs";
import {
    fileCardSelection,
    fileCardTransportSelection,
} from "../file/fileViews";
import { xSongCredit, xSong } from "../../schema/song";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import { graft } from "../common/viewCommon";
import { bandSongTagSelection as songTagEditorSelection } from "./bandSongTagViews";

// Catalog editors and dashboard references share the band-owned definition.
export { bandSongTagView as songTagEditorView } from "./bandSongTagViews";
export { songTagEditorSelection };

// todo: in theory this should compare in an app locale aware way.
function compareResolvedSongTags(a: { tag: SongTagClientPayload }, b: { tag: SongTagClientPayload }): number {
    return a.tag.sortOrder - b.tag.sortOrder
        || a.tag.name.localeCompare(b.tag.name)
        || a.tag.publicId.localeCompare(b.tag.publicId);
}

export { songCreditTypeEditorSelection, songCreditTypeEditorView } from "./songCreditTypes";

const songReferenceSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
    select: {
        publicId: true,
        name: true
    }
});
const songReferenceContract = deriveViewContract(xSong, songReferenceSelection);
export const songReferenceView = defineView({
    viewID: "Song_Reference",
    entity: xSong,
    selection: songReferenceContract.prismaSelection,
    dtoSchema: songReferenceContract.dtoSchema,
    hydrate: songReferenceContract.hydrate,
});

export const songCreditEditorSelection = Prisma.validator<Prisma.SongCreditDefaultArgs>()({
    select: {
        publicId: true,
        comment: true,
        year: true,
        userId: true,
        user: {
            select: {
                publicId: true,
                name: true,
            },
        },
        songId: true,
        song: {
            select: {
                publicId: true,
                name: true,
                description: true,
            },
        },
        typeId: true,
    },
});

const songCreditEditorContract = deriveViewContract(
    xSongCredit,
    songCreditEditorSelection,
    { references: dashboardReferenceContract },
);

export const songCreditUserSelection = Prisma.validator<Prisma.SongCreditDefaultArgs>()({
    select: {
        publicId: true,
        userId: true,
        songId: true,
        typeId: true,
        year: true,
        comment: true,
    },
});

const songCreditUserContract = deriveViewContract(
    xSongCredit,
    songCreditUserSelection,
    { references: dashboardReferenceContract },
);

// Profile rows include their visible Song; the catalog supplies localized credit types.
const memberSongCreditContract = deriveViewContract(
    xSongCredit,
    Prisma.validator<Prisma.SongCreditDefaultArgs>()({
        select: {
            ...songCreditUserSelection.select,
            song: {
                select: {
                    publicId: true,
                    name: true,
                    introducedYear: true
                }
            }
        },
    }),
    { references: dashboardReferenceContract });

export const memberSongCreditView = defineView({
    viewID: "SongCredit_MemberProfile", entity: xSongCredit,
    selection: memberSongCreditContract.prismaSelection, dtoSchema: memberSongCreditContract.dtoSchema,
    references: memberSongCreditContract.referenceContract, hydrate: memberSongCreditContract.hydrate,
});

export const songEditorSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        aliases: true,
        description: true,
        startBPM: true,
        endBPM: true,
        introducedYear: true,
        lengthSeconds: true,
        pinnedRecordingId: true,
        isDeleted: true,
        createdByUserId: true,
        createdByUser: {
            select: {
                publicId: true,
                name: true,
                cssClass: true,
            },
        },
        visiblePermissionId: true,
        visiblePermission: PermissionForVisibilityArgs,
        tags: {
            select: {
                publicId: true,
                songId: true,
                bandSongTagId: true,
                tag: songTagEditorSelection,
            },
            orderBy: SongTagAssociationNaturalOrderBy,
        },
    },
});

const songEditorContract = deriveViewContract(xSong, songEditorSelection);

export const songCreditEditorView = defineCrudView({
    viewID: "SongCredit_Editor",
    entity: xSongCredit,
    operations: { create: true, update: true, delete: true },
    selection: songCreditEditorContract.prismaSelection,
    dtoSchema: songCreditEditorContract.dtoSchema,
    references: songCreditEditorContract.referenceContract,
    hydrate: songCreditEditorContract.hydrate,
});

export const songCreditUserView = defineView({
    viewID: "SongCredit_UserCredits",
    entity: xSongCredit,
    selection: songCreditUserContract.prismaSelection,
    dtoSchema: songCreditUserContract.dtoSchema,
    references: songCreditUserContract.referenceContract,
    hydrate: songCreditUserContract.hydrate,
});

export const songEditorView = defineCrudView({
    viewID: "Song_Editor",
    entity: xSong,
    operations: { create: true, update: true, delete: true },
    selection: songEditorContract.prismaSelection,
    dtoSchema: songEditorContract.dtoSchema,
    hydrate: songEditorContract.hydrate,
});

const songSearchTransportSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        aliases: true,
        startBPM: true,
        endBPM: true,
        introducedYear: true,
        lengthSeconds: true,
        visiblePermissionId: true,
        tags: {
            select: {
                publicId: true,
                bandSongTagId: true,
            },
        },
        taggedFiles: {
            select: {
                publicId: true,
                file: {
                    select: {
                        publicId: true,
                        tags: {
                            select: {
                                publicId: true,
                                bandFileTagId: true,
                            },
                        },
                    },
                },
            },
        },
        credits: {
            select: {
                publicId: true,
                typeId: true,
                year: true,
                comment: true,
                user: {
                    select: {
                        publicId: true,
                        name: true,
                    },
                },
            },
        },
    },
});

const songSearchRequestedSelection = Prisma.validator<Prisma.SongDefaultArgs>()(
    graft(songSearchTransportSelection, {
        select: {
            createdByUserId: true,
            isDeleted: true,
            tags: {
                select: {
                    songId: true,
                },
            },
            taggedFiles: {
                select: {
                    fileId: true,
                    songId: true,
                    file: {
                        select: {
                            uploadedByUserId: true,
                            visiblePermissionId: true,
                            isDeleted: true,
                            tags: {
                                select: {
                                    fileId: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { file: { uploadedAt: "desc" } },
            },
            credits: {
                select: {
                    userId: true,
                    songId: true,
                },
            },
        }
    }),
);

const songSearchContract = deriveViewContract(
    xSong,
    songSearchRequestedSelection,
    {
        transportSelection: songSearchTransportSelection,
        references: dashboardReferenceContract,
    },
);

export const songSearchSelection = songSearchContract.prismaSelection;

export const songSearchView = defineView({
    viewID: "Song_Search",
    entity: xSong,
    selection: songSearchSelection,
    dtoSchema: songSearchContract.dtoSchema,
    references: songSearchContract.referenceContract,
    hydrate: (dto, references) => {
        const hydrated = songSearchContract.hydrate(dto, references);
        return {
            ...hydrated,
            tags: hydrated.tags
                ?.flatMap(association => association.tag == null ? [] : [{
                    ...association,
                    tag: association.tag,
                }])
                .sort(compareResolvedSongTags),
            taggedFiles: hydrated.taggedFiles?.map(association => ({
                ...association,
                file: association.file && {
                    ...association.file,
                    tags: association.file.tags
                        ?.flatMap(tagAssociation => tagAssociation.bandFileTag == null ? [] : [{
                            ...tagAssociation,
                            bandFileTag: tagAssociation.bandFileTag,
                        }]),
                },
            })),
        };
    },
});

export type SongSearchDto = DtoOf<typeof songSearchView>;
export type SongSearchClient = ClientOf<typeof songSearchView>;

const songDetailTransportSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        aliases: true,
        description: true,
        startBPM: true,
        endBPM: true,
        introducedYear: true,
        lengthSeconds: true,
        createdByUser: { select: { publicId: true } },
        visiblePermissionId: true,
        pinnedRecordingId: true,
        tags: {
            select: {
                publicId: true,
                bandSongTagId: true,
            },
        },
        taggedFiles: {
            select: {
                publicId: true,
                file: fileCardTransportSelection,
            },
        },
        credits: {
            select: {
                publicId: true,
                userId: true,
                songId: true,
                typeId: true,
                year: true,
                comment: true,
                user: {
                    select: {
                        publicId: true,
                        name: true,
                    },
                },
            },
        },
    },
});

const songDetailRequestedSelection = Prisma.validator<Prisma.SongDefaultArgs>()(
    graft(songDetailTransportSelection, {
        select: {
            createdByUserId: true,
            isDeleted: true,
            tags: {
                select: {
                    songId: true,
                },
            },
            taggedFiles: {
                select: {
                    fileId: true,
                    songId: true,
                    file: fileCardSelection,
                },
                orderBy: { file: { uploadedAt: "desc" } },
            },
        },
    }));

const songDetailContract = deriveViewContract(
    xSong,
    songDetailRequestedSelection,
    {
        transportSelection: songDetailTransportSelection,
        references: dashboardReferenceContract,
    },
);

export const songDetailSelection = songDetailContract.prismaSelection;

export const songDetailView = defineView({
    viewID: "Song_Detail",
    entity: xSong,
    selection: songDetailSelection,
    dtoSchema: songDetailContract.dtoSchema,
    references: songDetailContract.referenceContract,
    hydrate: (dto, references) => {
        const hydrated = songDetailContract.hydrate(dto, references);
        return {
            ...hydrated,
            tags: hydrated.tags
                ?.flatMap(association => association.tag == null ? [] : [{
                    ...association,
                    tag: association.tag,
                }])
                .sort(compareResolvedSongTags),
            taggedFiles: hydrated.taggedFiles,
        };
    },
});

export type SongDetailDto = DtoOf<typeof songDetailView>;
export type SongDetailClient = ClientOf<typeof songDetailView>;
