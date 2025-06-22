import { Prisma } from "db";

export type MediaPlayerSongContextPayload = Prisma.SongGetPayload<{
    select: {
        id: true,
        name: true,
        pinnedRecordingId: true,
    }
}>;

export type MediaPlayerEventContextPayload = Prisma.EventGetPayload<{
    select: {
        id: true,
        name: true,
        startsAt: true,
        isAllDay: true,
        durationMillis: true,
        statusId: true,
        typeId: true,
    }
}>;

export type MediaPlayerFileContextPayload = Prisma.FileGetPayload<{
    select: {
        id: true,
        fileLeafName: true,
        externalURI: true,
        mimeType: true,
        sizeBytes: true,
        parentFileId: true,
        previewFileId: true,
        fileCreatedAt: true,
        uploadedAt: true,
    }
}>;

// A minimal audio file type for playlist items
export interface MediaPlayerTrack {
    songContext?: MediaPlayerSongContextPayload;
    eventContext?: MediaPlayerEventContextPayload;
    file?: MediaPlayerFileContextPayload;
    url?: string;
}

export interface MediaPlayerTrackTitle {
    title: string;
    subtitle?: string;
}

export interface MediaPlayerContextType {
    // general
    playlist: MediaPlayerTrack[];
    currentIndex?: number | undefined;
    isPlaying: boolean;
    playheadSeconds: number; // playhead
    lengthSeconds: number;
    getTrackTitle: (track: MediaPlayerTrack) => MediaPlayerTrackTitle;
    previousEnabled: () => boolean;
    nextEnabled: () => boolean;
    isPlayingFile: (fileId: number) => boolean;

    // 
    //play: (index?: number) => void;
    unpause: () => void;
    playUri: (uri: string) => void;
    pause: () => void;
    next: () => void;
    prev: () => void;
    setPlaylist: (tracks: MediaPlayerTrack[], startIndex?: number) => void;

    // Audio element stuff (the master audio element controls or uses these)
    setIsPlaying: (playing: boolean) => void;
    setPlayheadSeconds: (t: number) => void;
    setLengthSeconds: (d: number) => void;
}
