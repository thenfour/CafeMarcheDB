
import { formatSongLength } from 'shared/time';
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';

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
        songURI: API.songs.getURIForSong(song.id, song.slug, tabSlug || undefined),
        formattedBPM: (song.startBPM === null && song.endBPM === null) ? null : API.songs.getFormattedBPM(song),
        formattedLength: song.lengthSeconds === null ? null : formatSongLength(song.lengthSeconds),
    };
};

