import { Prisma } from "db";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xFile } from "../../schema/file";

const fileSearchTransportSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        id: true,
        fileLeafName: true,
        description: true,
        uploadedAt: true,
        uploadedByUser: {
            select: {
                id: true,
                name: true,
            },
        },
        visiblePermissionId: true,
        sizeBytes: true,
        storedLeafName: true,
        mimeType: true,
        externalURI: true,
        tags: {
            select: {
                id: true,
                fileTagId: true,
            },
        },
        taggedSongs: {
            select: {
                id: true,
                song: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        },
        taggedEvents: {
            select: {
                id: true,
                event: {
                    select: {
                        id: true,
                        name: true,
                        startsAt: true,
                        statusId: true,
                        typeId: true,
                    },
                },
            },
        },
        taggedInstruments: {
            select: {
                id: true,
                instrumentId: true,
            },
        },
        taggedWikiPages: {
            select: {
                id: true,
                wikiPage: {
                    select: {
                        id: true,
                        slug: true,
                    },
                },
            },
        },
    },
});

export const fileSearchSelection = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        ...fileSearchTransportSelection.select,
        uploadedByUserId: true,
        isDeleted: true,
        taggedSongs: {
            ...fileSearchTransportSelection.select.taggedSongs,
            select: {
                ...fileSearchTransportSelection.select.taggedSongs.select,
                songId: true,
                song: {
                    ...fileSearchTransportSelection.select.taggedSongs.select.song,
                    select: {
                        ...fileSearchTransportSelection.select.taggedSongs.select.song.select,
                        createdByUserId: true,
                        visiblePermissionId: true,
                        isDeleted: true,
                    },
                },
            },
        },
        taggedEvents: {
            ...fileSearchTransportSelection.select.taggedEvents,
            select: {
                ...fileSearchTransportSelection.select.taggedEvents.select,
                eventId: true,
                event: {
                    ...fileSearchTransportSelection.select.taggedEvents.select.event,
                    select: {
                        ...fileSearchTransportSelection.select.taggedEvents.select.event.select,
                        createdByUserId: true,
                        visiblePermissionId: true,
                        isDeleted: true,
                    },
                },
            },
        },
        taggedWikiPages: {
            ...fileSearchTransportSelection.select.taggedWikiPages,
            select: {
                ...fileSearchTransportSelection.select.taggedWikiPages.select,
                wikiPageId: true,
                wikiPage: {
                    ...fileSearchTransportSelection.select.taggedWikiPages.select.wikiPage,
                    select: {
                        ...fileSearchTransportSelection.select.taggedWikiPages.select.wikiPage.select,
                        visiblePermissionId: true,
                    },
                },
            },
        },
    },
});

const fileSearchViewContract = deriveViewContract(
    xFile,
    fileSearchSelection,
    { transportSelection: fileSearchTransportSelection },
);

export const fileSearchView = defineView({
    viewID: "File_Search",
    entity: xFile,
    selection: fileSearchSelection,
    dtoSchema: fileSearchViewContract.dtoSchema,
    hydrate: (dto, references) => {
        const hydrated = fileSearchViewContract.hydrate(dto, references);
        return {
            ...hydrated,
            tags: hydrated.tags
                ?.flatMap(association => association.fileTag == null ? [] : [{
                    ...association,
                    fileTag: association.fileTag,
                }]),
            taggedSongs: hydrated.taggedSongs
                ?.flatMap(association => association.song == null ? [] : [{
                    ...association,
                    song: association.song,
                }]),
            taggedEvents: hydrated.taggedEvents
                ?.flatMap(association => association.event == null ? [] : [{
                    ...association,
                    event: association.event,
                }]),
            taggedInstruments: hydrated.taggedInstruments
                ?.flatMap(association => association.instrument == null ? [] : [{
                    ...association,
                    instrument: association.instrument,
                }]),
            taggedWikiPages: hydrated.taggedWikiPages
                ?.flatMap(association => association.wikiPage == null ? [] : [{
                    ...association,
                    wikiPage: association.wikiPage,
                }]),
        };
    },
});

export type FileSearchDto = DtoOf<typeof fileSearchView>;
export type FileSearchClient = ClientOf<typeof fileSearchView>;
