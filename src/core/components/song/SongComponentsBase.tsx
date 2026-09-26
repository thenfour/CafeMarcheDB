
import { formatSongLength } from 'shared/time';
import * as db3 from "src/core/db3/db3";
import type { SongPublicId } from "shared/publicId";
import { getFormattedBPM } from '../../db3/clientAPILL';
import { DashboardContextData } from '../dashboardContext/DashboardContext';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface SongMetadataSource {
    publicId: SongPublicId;
    name?: string;
    startBPM?: number | null;
    endBPM?: number | null;
    lengthSeconds?: number | null;
}

export interface SongMetadata<TSong extends SongMetadataSource> {
    song: TSong;
    songURI: string;
    formattedBPM: null | string;
    formattedLength: null | string;
}

export type SongWithMetadata = SongMetadata<db3.SongDetailClient>;

export const CalculateSongMetadata = <TSong extends SongMetadataSource>(
    song: TSong,
    tabSlug: string | undefined | null,
    dashboardContext: DashboardContextData,
): SongMetadata<TSong> => {
    return {
        song,
        songURI: dashboardContext.routingApi.getURIForSong(song, tabSlug || undefined),
        formattedBPM: (song.startBPM == null && song.endBPM == null) ? null : getFormattedBPM(song),
        formattedLength: song.lengthSeconds == null ? null : formatSongLength(song.lengthSeconds),
    };
};


export const GetSongFileInfo = (song: db3.SongDetailClient) => {

    const enrichedFiles = song.taggedFiles ?? [];

    const partitions = enrichedFiles.filter(f => (f.file.tags ?? []).some(t => t.fileTag.significance === db3.FileTagSignificance.Partition));
    const recordings = enrichedFiles.filter(f => (f.file.tags ?? []).some(t => t.fileTag.significance === db3.FileTagSignificance.Recording));
    const otherFiles = enrichedFiles.filter(
        f =>
            !(f.file.tags ?? []).some(
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



