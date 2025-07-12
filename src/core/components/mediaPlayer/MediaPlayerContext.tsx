import React, { createContext, useCallback, useContext, useState } from "react";
import { getURIForFile } from "../../db3/clientAPILL";
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
    const [audioDuration, setAudioDuration] = useState<number | undefined>(undefined);
    const [pullPlaylistFn, setPullPlaylistFn] = useState<(() => MediaPlayerTrack[]) | undefined>(undefined);

    const pause = useCallback(() => setIsPlaying(false), []);

    const playTrackOfPlaylist: (trackOrPlaylistIndex: MediaPlayerTrack | number) => void = (trackOrPlaylistIndex: MediaPlayerTrack | number) => {
        if (typeof trackOrPlaylistIndex === "number") {
            // If it's a number, treat it as an index in the playlist
            if (trackOrPlaylistIndex < 0 || trackOrPlaylistIndex >= playlist.length) {
                console.warn("Invalid playlist index:", trackOrPlaylistIndex);
                return;
            }

            // Validate that target track is playable
            const targetTrack = playlist[trackOrPlaylistIndex]!;
            if (!isPlayable(targetTrack)) {
                console.error("MediaPlayer: attempt to play unplayable track at index", trackOrPlaylistIndex);
                return;
            }

            setCurrentIndex(trackOrPlaylistIndex);
            setIsPlaying(true);
            return;
        }

        // Validate that target track is playable
        if (!isPlayable(trackOrPlaylistIndex)) {
            console.error("MediaPlayer: attempt to play unplayable track:", trackOrPlaylistIndex);
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

        // Find first playable track for determining starting index
        const firstPlayableIndex = tracks.findIndex(track => {
            if (track.url) return true;
            if (track.file && track.file.storedLeafName) return true;
            if (track.songContext && track.songContext.pinnedRecordingId) return true;
            return false;
        });

        let targetIndex: number;
        if (startIndex !== undefined) {
            // Validate provided startIndex
            const targetTrack = tracks[startIndex];
            if (targetTrack) {
                const isTargetPlayable = targetTrack.url ||
                    (targetTrack.file && targetTrack.file.storedLeafName) ||
                    (targetTrack.songContext && targetTrack.songContext.pinnedRecordingId);

                if (!isTargetPlayable) {
                    console.error("MediaPlayer: startIndex points to unplayable track, using first playable track instead");
                    targetIndex = firstPlayableIndex !== -1 ? firstPlayableIndex : 0;
                } else {
                    targetIndex = startIndex;
                }
            } else {
                console.error("MediaPlayer: invalid startIndex provided");
                targetIndex = firstPlayableIndex !== -1 ? firstPlayableIndex : 0;
            }
        } else {
            // No startIndex provided, use first playable
            targetIndex = firstPlayableIndex !== -1 ? firstPlayableIndex : 0;
        }

        setCurrentIndex(targetIndex);
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
            const filename = track.url.split('/').pop() || "";
            return { displayIndex, title: filename };
        }
        return { displayIndex, title: "" };
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

    const isPlayingSetlistItem = (args: { fileId: number, setlistItemIndex: number, setlistId?: number | undefined, setlistPlanId?: number | undefined }) => {
        if (currentIndex === undefined || currentIndex < 0 || currentIndex >= playlist.length) return false;
        const track = playlist[currentIndex]!;
        if (currentIndex !== args.setlistItemIndex) return false; // Check if the current index matches the setlist item index
        if (!isPlayingFile(args.fileId)) return false; // Check if the current track is playing the specified file
        if (args.setlistId !== undefined && track.setlistId !== args.setlistId) return false; // If setlistId is provided, check if it matches the track's setlistId
        if (args.setlistPlanId !== undefined && track.setlistPlanId !== args.setlistPlanId) return false; // If setlistPlanId is provided, check if it matches the track's setlistPlanId
        return true; // All checks passed, the track is playing the specified setlist item
    };

    const isPlayingTrack = useCallback((track: MediaPlayerTrack): boolean => {
        if (currentIndex === undefined || currentIndex < 0 || currentIndex >= playlist.length) return false;
        const currentTrack = playlist[currentIndex]!;
        return currentTrack.playlistIndex === track.playlistIndex && currentTrack.setlistId === track.setlistId && currentTrack.setlistPlanId === track.setlistPlanId;
    }, [currentIndex, playlist]);

    const pullPlaylist = useCallback(() => {
        if (!pullPlaylistFn) return false;
        const newPlaylist = pullPlaylistFn();

        // TODO: see if it's possible to retain playback continuity between pullls

        setPlaylist(newPlaylist, undefined); // Reset to the first track
        return true;
    }, [pullPlaylistFn]);

    const isPlayable = useCallback((track: MediaPlayerTrack): boolean => {
        if (track.url) return true; // If track has a URL, it's playable
        if (track.file && track.file.storedLeafName) return true;
        if (track.songContext && track.songContext.pinnedRecordingId) return true;
        return false;
    }, []);

    // Helper functions for finding playable tracks
    const findFirstPlayableIndex = useCallback((): number | undefined => {
        for (let i = 0; i < playlist.length; i++) {
            if (isPlayable(playlist[i]!)) {
                return i;
            }
        }
        return undefined;
    }, [playlist, isPlayable]);

    const findNextPlayableIndex = useCallback((fromIndex: number): number | undefined => {
        for (let i = fromIndex + 1; i < playlist.length; i++) {
            if (isPlayable(playlist[i]!)) {
                return i;
            }
        }
        return undefined;
    }, [playlist, isPlayable]);

    const findPrevPlayableIndex = useCallback((fromIndex: number): number | undefined => {
        for (let i = fromIndex - 1; i >= 0; i--) {
            if (isPlayable(playlist[i]!)) {
                return i;
            }
        }
        return undefined;
    }, [playlist, isPlayable]);

    // Navigation functions that use playable track logic
    const next = useCallback(() => {
        setCurrentIndex((i) => {
            if (i == null) {
                // If currentIndex is undefined, find first playable track
                const firstPlayable = findFirstPlayableIndex();
                return firstPlayable !== undefined ? firstPlayable : 0;
            }
            // Find next playable track from current position
            const nextPlayable = findNextPlayableIndex(i);
            return nextPlayable !== undefined ? nextPlayable : i; // Stay at current if no next playable
        });
        setIsPlaying(true);
    }, [findFirstPlayableIndex, findNextPlayableIndex]);

    const prev = useCallback(() => {
        setCurrentIndex((i) => {
            if (i == null) {
                // If currentIndex is undefined, find last playable track
                const lastPlayable = findPrevPlayableIndex(playlist.length);
                return lastPlayable !== undefined ? lastPlayable : playlist.length - 1;
            }
            // Find previous playable track from current position
            const prevPlayable = findPrevPlayableIndex(i);
            return prevPlayable !== undefined ? prevPlayable : i; // Stay at current if no previous playable
        });
        setIsPlaying(true);
    }, [findPrevPlayableIndex, playlist.length]);

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
        previousEnabled: () => {
            if (currentIndex === undefined || currentIndex <= 0) return false;
            // Check if there's a playable track before current index
            for (let i = currentIndex - 1; i >= 0; i--) {
                if (isPlayable(playlist[i]!)) return true;
            }
            return false;
        },
        nextEnabled: () => {
            if (currentIndex === undefined || currentIndex >= playlist.length - 1) return false;
            // Check if there's a playable track after current index
            for (let i = currentIndex + 1; i < playlist.length; i++) {
                if (isPlayable(playlist[i]!)) return true;
            }
            return false;
        },
        isPlayingFile,
        playTrackOfPlaylist,
        getTrackUri,
        isPlayingSetlistItem,
        isPlayingTrack,
        setPullPlaylistFn: (fn) => {
            setPullPlaylistFn(val => fn); // overload of setter requires this syntax
        },
        pullPlaylist,
        canPullPlaylist: pullPlaylistFn !== undefined,
        isPlayable,
    };

    return (
        <MediaPlayerContext.Provider
            value={contextValue}
        >
            {children}
        </MediaPlayerContext.Provider>
    );
};

