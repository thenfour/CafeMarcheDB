
import { formatSongLength } from 'shared/time';
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { SortDirection } from 'shared/rootroot';
import { DiscreteCriterion } from '../db3/shared/apiTypes';

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


