import { Prisma } from "db";
import { EventSongListItem } from "../../db3/shared/setlistApi";

export type MediaPlayerSongContextPayload = Prisma.SongGetPayload<{
    select: {
        id: true,
        name: true,
        pinnedRecordingId: true,
        lengthSeconds: true,
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
        storedLeafName: true,
        uploadedAt: true,
    }
}>;

export type MediaPlayerSetlistItemContextPayload = EventSongListItem;// & {
//    displayIndex: number | undefined; // index in the setlist, used for display
//};

// A minimal audio file type for playlist items
export interface MediaPlayerTrack {
    playlistIndex: number; // index in the playlist, used for playback
    setlistId?: number; // ID of the setlist this track belongs to, for disambiguation
    setlistPlanId?: number;

    songContext?: MediaPlayerSongContextPayload;
    eventContext?: MediaPlayerEventContextPayload;
    setListItemContext?: MediaPlayerSetlistItemContextPayload;
    file?: MediaPlayerFileContextPayload;
    url?: string; // for ad-hoc tracks not in the database
}


export interface MediaPlayerTrackTitle {
    displayIndex: string | undefined; // displayed index of the track
    title: string;
    subtitle?: string;
}

export interface MediaPlayerContextType {
    // general
    playlist: MediaPlayerTrack[];
    currentTrack: MediaPlayerTrack | undefined;
    currentIndex?: number | undefined;
    isPlaying: boolean;
    playheadSeconds: number; // playhead
    lengthSeconds: number | undefined;
    getTrackTitle: (track: MediaPlayerTrack) => MediaPlayerTrackTitle;
    getTrackUri: (track: MediaPlayerTrack) => string | undefined;
    previousEnabled: () => boolean;
    nextEnabled: () => boolean;
    isPlayingFile: (fileId: number) => boolean;
    isPlayingSetlistItem: (args: { setlistId?: number | undefined, setlistPlanId?: number | undefined, setlistItemIndex: number, fileId: number }) => boolean;
    isPlayingTrack: (track: MediaPlayerTrack) => boolean;

    // setlist integration (optional)
    //setlistData?: MediaPlayerSetlistData;

    // 
    //play: (index?: number) => void;
    unpause: () => void;
    playUri: (uri: string) => void;
    pause: () => void;
    next: () => void;
    prev: () => void;
    setPlaylist: (tracks: MediaPlayerTrack[], startIndex?: number) => void;
    playTrackOfPlaylist: (trackOrPlaylistIndex: MediaPlayerTrack | number) => void;

    // Audio element stuff (the master audio element controls or uses these)
    setIsPlaying: (playing: boolean) => void;
    setPlayheadSeconds: (t: number) => void;
    setLengthSeconds: (d: number | undefined) => void;

    setPullPlaylistFn: (fn: () => MediaPlayerTrack[]) => void;
    pullPlaylist: () => boolean;
    canPullPlaylist: boolean;
}
