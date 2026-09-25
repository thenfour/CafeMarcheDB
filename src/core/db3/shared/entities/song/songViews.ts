import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { PermissionForVisibilityArgs, SongTagAssociationNaturalOrderBy } from "../../schema/prismArgs";
import {
    fileCardSelection,
    fileCardTransportSelection,
} from "../file/fileViews";
import { xSongCredit, xSongCreditType, xSong, xSongTag } from "../../schema/song";
import { dashboardReferenceContract } from "../../references/dashboardReferences";
import { graft } from "../common/viewCommon";

export const songTagEditorSelection = Prisma.validator<Prisma.SongTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
        group: true,
        indicator: true,
        indicatorCssClass: true,
    },
});

const songTagEditorContract = deriveViewContract(xSongTag, songTagEditorSelection);

export const songCreditTypeEditorSelection = Prisma.validator<Prisma.SongCreditTypeDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
    },
});

const songCreditTypeEditorContract = deriveViewContract(
    xSongCreditType,
    songCreditTypeEditorSelection,
);

export const songCreditEditorSelection = Prisma.validator<Prisma.SongCreditDefaultArgs>()({
    select: {
        publicId: true,
        comment: true,
        year: true,
        userId: true,
        user: {
            select: {
                id: true,
                name: true,
            },
        },
        songId: true,
        song: {
            select: {
                id: true,
                name: true,
                description: true,
            },
        },
        typeId: true,
        type: songCreditTypeEditorSelection,
    },
});

const songCreditEditorContract = deriveViewContract(
    xSongCredit,
    songCreditEditorSelection,
);

export const songCreditUserSelection = Prisma.validator<Prisma.SongCreditDefaultArgs>()({
    select: {
        publicId: true,
        userId: true,
        songId: true,
        typeId: true,
        year: true,
        comment: true,
        type: {
            select: {
                publicId: true,
                text: true,
            },
        },
    },
});

const songCreditUserContract = deriveViewContract(
    xSongCredit,
    songCreditUserSelection,
);

export const songEditorSelection = Prisma.validator<Prisma.SongDefaultArgs>()({
    select: {
        id: true,
        name: true,
        aliases: true,
        description: true,
        startBPM: true,
        endBPM: true,
        introducedYear: true,
        lengthSeconds: true,
        isDeleted: true,
        createdByUserId: true,
        createdByUser: {
            select: {
                id: true,
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
                tagId: true,
                tag: songTagEditorSelection,
            },
            orderBy: SongTagAssociationNaturalOrderBy,
        },
    },
});

const songEditorContract = deriveViewContract(xSong, songEditorSelection);

export const songTagEditorView = defineCrudView({
    viewID: "SongTag_Editor",
    entity: xSongTag,
    operations: { create: true, update: true, delete: true },
    selection: songTagEditorContract.prismaSelection,
    dtoSchema: songTagEditorContract.dtoSchema,
    hydrate: songTagEditorContract.hydrate,
});

export const songCreditTypeEditorView = defineCrudView({
    viewID: "SongCreditType_Editor",
    entity: xSongCreditType,
    operations: { create: true, update: true, delete: true },
    selection: songCreditTypeEditorContract.prismaSelection,
    dtoSchema: songCreditTypeEditorContract.dtoSchema,
    hydrate: songCreditTypeEditorContract.hydrate,
});

export const songCreditEditorView = defineCrudView({
    viewID: "SongCredit_Editor",
    entity: xSongCredit,
    operations: { create: true, update: true, delete: true },
    selection: songCreditEditorContract.prismaSelection,
    dtoSchema: songCreditEditorContract.dtoSchema,
    hydrate: songCreditEditorContract.hydrate,
});

export const songCreditUserView = defineView({
    viewID: "SongCredit_UserCredits",
    entity: xSongCredit,
    selection: songCreditUserContract.prismaSelection,
    dtoSchema: songCreditUserContract.dtoSchema,
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
        id: true,
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
                tagId: true,
            },
        },
        taggedFiles: {
            select: {
                id: true,
                file: {
                    select: {
                        id: true,
                        tags: {
                            select: {
                                publicId: true,
                                fileTagId: true,
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
                        id: true,
                        name: true,
                    },
                },
            },
        },
    },
});

export const songSearchSelection = Prisma.validator<Prisma.SongDefaultArgs>()(
    graft(songSearchTransportSelection, {
        select: {
            createdByUserId: true,
            isDeleted: true,
            tags: {
                select: {
                    songId: true,
                    tag: {
                        // Projection support; hydration uses the dashboard reference.
                        select: { publicId: true },
                    },
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
                                    fileTag: { select: { publicId: true } },
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
                    type: {
                        select: { publicId: true },
                    },
                },
            },
        }
    }),
);

const songSearchContract = deriveViewContract(
    xSong,
    songSearchSelection,
    {
        transportSelection: songSearchTransportSelection,
        references: dashboardReferenceContract,
    },
);

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
                .sort((a, b) => a.tag.sortOrder - b.tag.sortOrder),
            taggedFiles: hydrated.taggedFiles?.map(association => ({
                ...association,
                file: association.file && {
                    ...association.file,
                    tags: association.file.tags
                        ?.flatMap(tagAssociation => tagAssociation.fileTag == null ? [] : [{
                            ...tagAssociation,
                            fileTag: tagAssociation.fileTag,
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
        id: true,
        name: true,
        aliases: true,
        description: true,
        startBPM: true,
        endBPM: true,
        introducedYear: true,
        lengthSeconds: true,
        createdByUserId: true,
        visiblePermissionId: true,
        pinnedRecordingId: true,
        tags: {
            select: {
                publicId: true,
                tagId: true,
            },
        },
        taggedFiles: {
            select: {
                id: true,
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
                        id: true,
                        name: true,
                    },
                },
            },
        },
    },
});

export const songDetailSelection = Prisma.validator<Prisma.SongDefaultArgs>()(
    graft(songDetailTransportSelection, {
        select: {
            isDeleted: true,
            tags: {
                select: {
                    songId: true,
                    tag: {
                        // Projection support; hydration uses the dashboard reference.
                        select: { publicId: true },
                    },
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
            credits: {
                select: {
                    type: {
                        select: { publicId: true },
                    },
                },
            },
        },
    }));

const songDetailContract = deriveViewContract(
    xSong,
    songDetailSelection,
    {
        transportSelection: songDetailTransportSelection,
        references: dashboardReferenceContract,
    },
);

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
                .sort((a, b) => a.tag.sortOrder - b.tag.sortOrder),
            taggedFiles: hydrated.taggedFiles,
        };
    },
});

export type SongDetailDto = DtoOf<typeof songDetailView>;
export type SongDetailClient = ClientOf<typeof songDetailView>;
