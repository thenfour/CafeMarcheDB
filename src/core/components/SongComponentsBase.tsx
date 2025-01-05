
import { SortDirection } from 'shared/rootroot';
import { formatSongLength } from 'shared/time';
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { DiscreteCriterion } from '../db3/shared/apiTypes';
import { DashboardContextData } from './DashboardContext';

export type EnrichedVerboseSong = db3.EnrichedSong<db3.SongPayload_Verbose>;


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface SongWithMetadata {
    song: EnrichedVerboseSong;
    songURI: string;
    formattedBPM: null | string;
    formattedLength: null | string;
};

export const CalculateSongMetadata = (song: EnrichedVerboseSong, tabSlug?: string | undefined | null): SongWithMetadata => {
    return {
        song,
        songURI: API.songs.getURIForSong(song, tabSlug || undefined),
        formattedBPM: (song.startBPM === null && song.endBPM === null) ? null : API.songs.getFormattedBPM(song),
        formattedLength: song.lengthSeconds === null ? null : formatSongLength(song.lengthSeconds),
    };
};


export const GetSongFileInfo = (song: EnrichedVerboseSong, dashboardContext: DashboardContextData) => {

    const enrichedFiles = song.taggedFiles.map(ft => {
        return {
            ...ft,
            file: db3.enrichFile(ft.file, dashboardContext),
        };
    });

    const partitions = enrichedFiles.filter(f => f.file.tags.some(t => t.fileTag.significance === db3.FileTagSignificance.Partition));
    const recordings = enrichedFiles.filter(f => f.file.tags.some(t => t.fileTag.significance === db3.FileTagSignificance.Recording));
    const otherFiles = enrichedFiles.filter(
        f =>
            !f.file.tags.some(
                t =>
                    t.fileTag.significance === db3.FileTagSignificance.Partition ||
                    t.fileTag.significance === db3.FileTagSignificance.Recording
            )
    );
    return {
        enrichedFiles,
        partitions,
        recordings,
        otherFiles,
    }
};




// //////////////////////////////////////////////////////////////////////////////////////////////////
export enum SongOrderByColumnOptions {
    id = "id",
    name = "name",
};

export type SongOrderByColumnOption = keyof typeof SongOrderByColumnOptions;

export interface SongsFilterSpec {
    quickFilter: string;
    refreshSerial: number; // this is necessary because you can do things to change the results from this page. think of adding an event then refetching.

    orderByColumn: SongOrderByColumnOption;
    orderByDirection: SortDirection;

    tagFilter: DiscreteCriterion;
};


