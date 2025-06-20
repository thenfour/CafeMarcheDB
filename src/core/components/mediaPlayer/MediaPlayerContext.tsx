import { Prisma } from "db";
import React, { createContext, useContext, useState, useCallback } from "react";
import { MediaPlayerBar } from "./MediaPlayerBar";

export type MediaPlayerSongContextPayload = Prisma.SongGetPayload<{
    select: {
        id: true,
        name: true,
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
    // general props
    playlist: MediaPlayerTrack[];
    currentIndex?: number | undefined;
    isPlaying: boolean;
    playheadSeconds: number; // playhead
    lengthSeconds: number;
    getTrackTitle: (track: MediaPlayerTrack) => MediaPlayerTrackTitle;
    previousEnabled: () => boolean;
    nextEnabled: () => boolean;

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

const MediaPlayerContext = createContext<MediaPlayerContextType | undefined>(undefined);

export const useMediaPlayer = () => {
    const ctx = useContext(MediaPlayerContext);
    if (!ctx) throw new Error("useMediaPlayer must be used within a MediaPlayerProvider");
    return ctx;
};

export const MediaPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [playlist, setPlaylistState] = useState<MediaPlayerTrack[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number | undefined>(undefined);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [audioTime, setAudioTime] = useState<number>(0);
    const [audioDuration, setAudioDuration] = useState<number>(0);

    const pause = useCallback(() => setIsPlaying(false), []);
    const next = useCallback(() => {
        setCurrentIndex((i) => {
            if (i == null) return 0; // If currentIndex is undefined, start from the beginning
            return (i + 1 < playlist.length ? i + 1 : 0);
        });
        setIsPlaying(true);
    }, [playlist.length]);

    const prev = useCallback(() => {
        setCurrentIndex((i) => {
            if (i == null) return playlist.length - 1; // If currentIndex is undefined, go to the last track
            return (i - 1 >= 0 ? i - 1 : playlist.length - 1);
        });
        setIsPlaying(true);
    }, [playlist.length]);

    const setPlaylist = useCallback((tracks: MediaPlayerTrack[], startIndex: number | undefined) => {
        setPlaylistState(tracks);
        setCurrentIndex(startIndex);
        if (startIndex != null) {
            setIsPlaying(true);
        }
    }, []);

    const playUri = (uri: string) => {
        const track: MediaPlayerTrack = {
            url: uri,
        };
        const newPlaylist = [...playlist, track]; // append to playlist
        setPlaylistState(newPlaylist);
        setCurrentIndex(newPlaylist.length - 1);
        setAudioTime(0); // Reset playhead time
        setIsPlaying(true);
    };

    // possibilities for track title and subtitle
    // song name + event name
    // song name + file name
    // event name + file name
    // file name
    // url filename
    // if none of these, use "Untitled Track" as fallback
    const getTrackTitle = useCallback((track: MediaPlayerTrack): MediaPlayerTrackTitle => {
        if (track.songContext?.name) {
            return { title: track.songContext.name, subtitle: track.eventContext?.name || track.file?.fileLeafName };
        }
        if (track.eventContext?.name) {
            return { title: track.eventContext.name, subtitle: track.file?.fileLeafName };
        }
        if (track.file?.fileLeafName) {
            return { title: track.file.fileLeafName };
        }
        if (track.url) {
            const filename = track.url.split('/').pop() || "Untitled Track";
            return { title: filename };
        }
        return { title: "Untitled Track" };
    }, []);

    const unpause = useCallback(() => {
        setIsPlaying(true);
    }, []);

    const contextValue: MediaPlayerContextType = {
        playlist,
        currentIndex,
        isPlaying,
        playUri,
        pause,
        next,
        prev,
        setPlaylist,
        setIsPlaying,
        getTrackTitle,
        lengthSeconds: audioDuration,
        playheadSeconds: audioTime,
        setPlayheadSeconds: setAudioTime,
        setLengthSeconds: setAudioDuration,
        unpause,
        previousEnabled: () => currentIndex !== undefined && currentIndex > 0,
        nextEnabled: () => currentIndex !== undefined && currentIndex < playlist.length - 1,
    };

    return (
        <MediaPlayerContext.Provider
            value={contextValue}
        >
            {children}
            <MediaPlayerBar mediaPlayer={contextValue} />
        </MediaPlayerContext.Provider>
    );
};

