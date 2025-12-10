
import { formatSongLength } from 'shared/time';
import * as db3 from "src/core/db3/db3";
import { API } from '../../db3/clientAPI';
import { EnrichedVerboseSong } from '../../db3/shared/schema/enrichedSongTypes';
import { DashboardContextData } from '../dashboardContext/DashboardContext';
import { enrichFile } from '../../db3/shared/schema/enrichedFileTypes';

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
            file: enrichFile(ft.file, dashboardContext),
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



