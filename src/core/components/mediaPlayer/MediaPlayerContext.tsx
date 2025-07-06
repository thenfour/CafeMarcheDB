import React, { createContext, useCallback, useContext, useState } from "react";
import { getURIForFile } from "../../db3/clientAPILL";
import { MediaPlayerBar } from "./MediaPlayerBar";
import { MediaPlayerContextType, MediaPlayerTrack, MediaPlayerTrackTitle } from "./MediaPlayerTypes";

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
    //const [setlistData, setSetlistData] = useState<MediaPlayerSetlistData | undefined>(undefined);

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

    const playTrackOfPlaylist: (trackOrPlaylistIndex: MediaPlayerTrack | number) => void = (trackOrPlaylistIndex: MediaPlayerTrack) => {
        if (typeof trackOrPlaylistIndex === "number") {
            // If it's a number, treat it as an index in the playlist
            if (trackOrPlaylistIndex < 0 || trackOrPlaylistIndex >= playlist.length) {
                console.warn("Invalid playlist index:", trackOrPlaylistIndex);
                return;
            }
            setCurrentIndex(trackOrPlaylistIndex);
            setIsPlaying(true);
            return;
        }

        // assumes that track is in the current playlist.
        setCurrentIndex(trackOrPlaylistIndex.playlistIndex);
        setIsPlaying(true);
    };

    const setPlaylist = useCallback((tracks: MediaPlayerTrack[], startIndex: number | undefined) => {

        // sanitize / fill in data
        tracks = tracks.map((track, index) => ({
            ...track,
            playlistIndex: index, // set the playlist index for each track
        }));

        setPlaylistState(tracks);
        //setSetlistData(setlistDataParam);

        if (tracks.length === 0) {
            setCurrentIndex(undefined);
            setIsPlaying(false);
            setAudioTime(0);
            setAudioDuration(0);
            return;
        }

        //        console.log("MediaPlayerProvider: setPlaylist called with startIndex", startIndex);
        setCurrentIndex(startIndex || 0);
        if (startIndex != null) {
            setIsPlaying(true);
        } else {
            setIsPlaying(false);
        }
    }, []);

    const playUri = (uri: string) => {
        const track: MediaPlayerTrack = {
            playlistIndex: -1, // filled in later
            setlistId: undefined, // ad-hoc tracks don't belong to a setlist
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

        // calculate the index.
        let displayIndexNum: number | undefined = playlist.length > 1 ? track.playlistIndex + 1 : undefined;
        if (track.setListItemContext) {
            if (track.setListItemContext.type === "song") {//} || (track.setListItemContext.type === "divider" && track.setListItemContext.isSong)) {
                displayIndexNum = track.setListItemContext.index + 1;
            }
            if (track.setListItemContext.type === "divider") {
                if (track.setListItemContext.isSong) {
                    if (track.setListItemContext.index != null) {
                        displayIndexNum = track.setListItemContext.index + 1;
                    } else {
                        displayIndexNum = undefined;
                    }
                }
                else {
                    displayIndexNum = undefined; // don't show index for dividers that are not songs
                }
            }
        }

        const displayIndex = displayIndexNum !== undefined ? `${displayIndexNum}. ` : "";

        if (track.setListItemContext?.type === "divider") {
            return { displayIndex, title: track.setListItemContext.subtitle || "" };
        }
        if (track.songContext?.name) {
            return { displayIndex, title: track.songContext.name, subtitle: track.eventContext?.name || track.file?.fileLeafName };
        }
        if (track.eventContext?.name) {
            return { displayIndex, title: track.eventContext.name, subtitle: track.file?.fileLeafName };
        }
        if (track.file?.fileLeafName) {
            return { displayIndex, title: track.file.fileLeafName };
        }
        if (track.url) {
            const filename = track.url.split('/').pop() || "Untitled Track";
            return { displayIndex, title: filename };
        }
        return { displayIndex, title: "Untitled Track" };
    }, []);

    const unpause = useCallback(() => {
        setIsPlaying(true);
    }, []);

    const isPlayingFile = useCallback((fileId: number | undefined | null) => {
        if (fileId == null) return false; // If fileId is null or undefined, return false
        if (currentIndex === undefined || currentIndex < 0 || currentIndex >= playlist.length) return false;
        const track = playlist[currentIndex]!;
        return track.file?.id === fileId;
    }, [currentIndex, playlist]);

    const getTrackUri = useCallback((track: MediaPlayerTrack): string | undefined => {
        if (track.url) return track.url; // If track has a URL, return it
        if (track.file?.externalURI) return track.file.externalURI; // If track has a file with external URI, return it
        if (track.file) {
            return getURIForFile(track.file); // Use the utility function to get the URI for the file
        }
    }, []);

    const contextValue: MediaPlayerContextType = {
        playlist,
        currentIndex,
        currentTrack: currentIndex !== undefined ? playlist[currentIndex] : undefined,
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
        isPlayingFile,
        playTrackOfPlaylist,
        getTrackUri,
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

