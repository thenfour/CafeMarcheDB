import { getHashedColor } from "@/shared/utils";
import React from "react";
import { formatSongLength } from "../../../../shared/time";
import { CustomAudioPlayerAPI } from "./CustomAudioPlayer";
//import { useMediaPlayer } from "./MediaPlayerContext";
import { MediaPlayerContextType, MediaPlayerTrack } from "./MediaPlayerTypes";

// Simple hash function to generate consistent colors for songs
const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
};

type TrackType = "song" | "divider" | "dummy";

const getItemType = (item: MediaPlayerTrack): TrackType => {
    if (item.setListItemContext?.type === "divider") {
        if (item.setListItemContext.isSong) {
            return "dummy";
        }
        return "divider";
    }

    if (item.url || item.file) {
        return "song";
    }
    return "dummy";
};

// New functions for setlist-aware rendering
const getSetlistItemProportionalWidth = (item: MediaPlayerTrack): number => {
    const trackType = getItemType(item);
    return {
        song: 2,
        divider: 0.5,
        dummy: 1
    }[trackType] || 1;
};


interface StyleData {
    containerClassName: string;
    containerStyle: React.CSSProperties;
    coloredBarClassName: string;
    coloredBarStyle: React.CSSProperties;
}

const getItemStyleData = (item: MediaPlayerTrack, isCurrentTrack: boolean, mediaPlayer: MediaPlayerContextType): StyleData => {
    const title = mediaPlayer.getTrackTitle(item);

    switch (getItemType(item)) {
        case "divider": {
            if (item.setListItemContext?.type !== "divider") throw new Error("Expected item to be a divider");

            return {
                containerClassName: "setlistVisualizationSegment--divider",
                containerStyle: {
                    "--segment-color": item.setListItemContext.color || "#666666",
                } as any,
                coloredBarClassName: "",
                coloredBarStyle: {
                    backgroundColor: "var(--segment-color)",
                }
            }
        }
        default:
        case "dummy":
            return {
                containerClassName: "setlistVisualizationSegment--dummy",
                containerStyle: {
                    "--segment-color": "#444", // Default color for dummy songs
                } as any,
                coloredBarClassName: "hatch",
                coloredBarStyle: {
                    "--fc": "#666",
                    "--bc": "#333",
                } as any,
            }
        case "song": {

            return {
                containerClassName: "setlistVisualizationSegment--song",
                containerStyle: {
                    "--segment-color": getHashedColor(title.title, {
                        alpha: "100%",
                        luminosity: "50%",
                        saturation: isCurrentTrack ? "70%" : "15%",
                    }),
                } as any,
                coloredBarClassName: "",
                coloredBarStyle: {
                    backgroundColor: "var(--segment-color)",
                }
            };
        }
    }

};

interface VisBarSegmentProps {
    item: MediaPlayerTrack;
    isCurrentTrack: boolean;
    audioAPI: CustomAudioPlayerAPI | null;
    mediaPlayer: MediaPlayerContextType;
};

const VisBarSegment = ({ item, isCurrentTrack, audioAPI, mediaPlayer }: VisBarSegmentProps) => {
    const [hoverPosition, setHoverPosition] = React.useState<number | null>(null);
    const [hoverTime, setHoverTime] = React.useState<number | null>(null);

    const proportionalWidth = getSetlistItemProportionalWidth(item);

    const styleData = getItemStyleData(item, false, mediaPlayer);
    const title = mediaPlayer.getTrackTitle(item);

    const isInteractable = item.file || item.url;

    // todo is this redundant with mediaPlayer.lengthSeconds?
    let audioDurationSeconds: number | undefined;
    if (isCurrentTrack) {
        audioDurationSeconds = audioAPI?.duration;
    }

    // Calculate playhead position as a percentage within the current track
    const { playheadSeconds, lengthSeconds } = mediaPlayer;
    const getPlayheadPosition = (): number | undefined => {
        if (!isCurrentTrack || !playheadSeconds) {
            return undefined;
        }

        // Try to get duration from the MediaPlayerContext
        let trackDuration = lengthSeconds;

        // If lengthSeconds is invalid, try to get it from the audio API
        if (!isFinite(trackDuration) || trackDuration <= 0) {
            if (audioAPI && isFinite(audioAPI.duration) && audioAPI.duration > 0) {
                trackDuration = audioAPI.duration;
            } else {
                return 0; // Can't calculate without valid duration
            }
        }

        const position = Math.max(0, Math.min(100, (playheadSeconds / trackDuration) * 100));
        return position;
    };

    let playheadPosition: number | undefined = undefined;
    if (isCurrentTrack) {
        playheadPosition = getPlayheadPosition();
    }

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isInteractable) return;

        if (isCurrentTrack) {
            // Handle seeking within current track
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, clickX / rect.width));
            seekToPosition(percentage);
        } else {
            // Switch to this track
            mediaPlayer.playTrackOfPlaylist(item.playlistIndex);
        }
    };

    // Handler for hover on current track
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isCurrentTrack) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const hoverX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, hoverX / rect.width));
        setHoverPosition(percentage * 100);

        if (!audioDurationSeconds) {
            return;
        }

        const timeAtPosition = percentage * audioDurationSeconds;
        setHoverTime(timeAtPosition);
    };

    const handleMouseLeave = () => {
        setHoverPosition(null);
        setHoverTime(null);
    };

    function seekToPosition(percentage: number) {
        if (!audioDurationSeconds) {
            return;
        }

        const seekTime = percentage * audioDurationSeconds;

        // Perform the actual seek using the audio API
        if (audioAPI) {
            audioAPI.seekTo(seekTime);
        }
    }

    return <div
        className={`setlistVisualizationSegment ${styleData.containerClassName} ${isCurrentTrack ? 'setlistVisualizationSegment--current' : ''}`}
        style={{
            //width: `${widthPercentage}%`,
            flexShrink: 0,
            flex: proportionalWidth,
            cursor: isInteractable ? 'pointer' : 'default',
            ...styleData.containerStyle,
        } as any}
    >
        <div
            className={`coloredSegment ${styleData.coloredBarClassName} ${isCurrentTrack ? 'coloredSegment--seekable' : ''} ${!isInteractable ? 'coloredSegment--noninteractive' : ''}`}
            style={{
                position: 'relative',
                ...styleData.coloredBarStyle,
            } as React.CSSProperties}
            onClick={handleClick}
            onMouseMove={isCurrentTrack ? handleMouseMove : undefined}
            onMouseLeave={isCurrentTrack ? handleMouseLeave : undefined}
        >
            {/* Progress fill for current track */}
            {isCurrentTrack && (
                <div
                    className="progressFill"
                    style={{
                        width: `${playheadPosition}%`,
                    }}
                />
            )}
            {/* Playhead indicator for current track */}
            {isCurrentTrack && (
                <div
                    className="playheadIndicator"
                    style={{
                        left: `${playheadPosition}%`,
                    }}
                />
            )}
            {/* Hover position indicator for current track */}
            {isCurrentTrack && hoverPosition !== null && (
                <>
                    <div
                        className="hoverPositionIndicator"
                        style={{
                            left: `${hoverPosition}%`,
                        }}
                    />
                    {/* Time display at hover position */}
                    {hoverTime !== null && (
                        <div
                            className="hoverTimeDisplay"
                            style={{
                                left: `${hoverPosition}%`,
                            }}
                        >
                            {formatSongLength(Math.floor(hoverTime))}
                        </div>
                    )}
                </>
            )}
            <span className="segmentText">{title.displayIndex}{title.title}</span>
        </div>
    </div>;
};





export const SetlistVisualizationBar: React.FC<{
    mediaPlayer: MediaPlayerContextType;
    audioAPI: CustomAudioPlayerAPI | null;
    startIndex: number;
    length: number;
    //currentIndex: number | undefined;
}> = ({ mediaPlayer, audioAPI, startIndex, length }) => {
    const { playlist, currentIndex, } = mediaPlayer;
    //const [visible, setVisible] = React.useState(false);

    //const current = currentIndex != null ? playlist[currentIndex] : undefined;

    // // Show/hide animation effect - sync with media player visibility
    // React.useEffect(() => {
    //     setVisible(playlist.length > 1);
    // }, [currentTrack, playlist.length]);

    // take the playlist segment based on bounds
    const items = playlist.slice(startIndex, startIndex + length);

    return (
        <div
            className={`setlistVisualizationBar`}
        >
            {
                items.map((track, index) => <VisBarSegment
                    key={index}
                    item={track}
                    isCurrentTrack={currentIndex === index + startIndex}
                    audioAPI={audioAPI}
                    mediaPlayer={mediaPlayer}
                />)
            }
        </div>
    );
};



export const SetlistVisualizationBars: React.FC<{
    mediaPlayer: MediaPlayerContextType;
    audioAPI: CustomAudioPlayerAPI | null;
}> = ({ mediaPlayer, audioAPI }) => {
    const { playlist } = mediaPlayer;
    //const [visible, setVisible] = React.useState(false);

    // const current = currentIndex != null ? playlist[currentIndex] : undefined;

    // // Show/hide animation effect - sync with media player visibility
    // React.useEffect(() => {
    //     setVisible(playlist.length > 1);
    // }, [current, playlist.length]);

    // calculate rows. a new row begins when a divider is encountered that's marked as a break,
    // as long as it is not just after another break (avoid empty rows).
    const rowBounds: { startIndex: number, length: number }[] = [];
    let currentRow: { startIndex: number, length: number } = { startIndex: 0, length: 0 };
    for (let i = 0; i < playlist.length; i++) {
        const track = playlist[i]!;
        if (track.setListItemContext?.type === "divider" && track.setListItemContext.isInterruption && currentRow.length > 0) {
            // If we hit a divider that is an interruption, finalize the current row
            currentRow.length = i - currentRow.startIndex; // Set length of the row
            rowBounds.push(currentRow);
            currentRow = { startIndex: i + 1, length: 0 }; // Start a new row after the divider
        } else {
            currentRow.length++; // Increment the length of the current row
        }
    }
    // If there's a remaining row after the loop, add it
    if (currentRow.length > 0 || currentRow.startIndex < playlist.length) {
        currentRow.length = playlist.length - currentRow.startIndex; // Set length of the last row
        rowBounds.push(currentRow);
    }

    console.log(`rowBounds`, rowBounds);

    return (
        <div
            className={`setlistVisualizationBarContainer`}
        >
            {
                rowBounds.map((rowBound, rowIndex) => (
                    <SetlistVisualizationBar
                        key={rowIndex}
                        mediaPlayer={mediaPlayer}
                        audioAPI={audioAPI}
                        startIndex={rowBound.startIndex}
                        length={rowBound.length}
                    //playlist={row}
                    //currentIndex={currentIndex}
                    />
                ))
            }
        </div>
    );
};
