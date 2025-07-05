import React from "react";
import { MediaPlayerContextType, MediaPlayerTrack } from "./MediaPlayerTypes";
import { CustomAudioPlayerAPI } from "./CustomAudioPlayer";
import { formatSongLength } from "../../../../shared/time";
import { Tooltip } from "@mui/material";
import { getHashedColor } from "@/shared/utils";

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

const getSegmentColor = (track: MediaPlayerTrack, isCurrent: boolean): string => {
    // Use song name, file name, or URL for hashing
    const identifier = track.songContext?.name ||
        track.file?.fileLeafName ||
        track.url ||
        "untitled";

    //const hash = hashString(identifier);
    return getHashedColor(identifier, {
        alpha: "100%",
        luminosity: "50%",
        saturation: isCurrent ? "70%" : "10%"
    });
};

const getSegmentProportionalWidth = (track: MediaPlayerTrack): number => {
    // Use song name, file name, or URL for hashing
    const identifier = track.songContext?.name ||
        track.file?.fileLeafName ||
        track.url ||
        "untitled";

    const hash = hashString(identifier);

    // Generate a proportional width between 1 and 10 based on hash
    // This gives us varied but consistent widths for demonstration
    return 1 + (hash % 9); // Results in values from 1 to 10
};

export const SetlistVisualizationBar: React.FC<{
    mediaPlayer: MediaPlayerContextType;
    audioAPI?: CustomAudioPlayerAPI | null;
}> = ({ mediaPlayer, audioAPI }) => {
    const { playlist, currentIndex, playheadSeconds, lengthSeconds } = mediaPlayer;
    const [visible, setVisible] = React.useState(false);
    const [hoverPosition, setHoverPosition] = React.useState<number | null>(null);
    const [hoverTime, setHoverTime] = React.useState<number | null>(null);

    const current = currentIndex != null ? playlist[currentIndex] : undefined;

    // Show/hide animation effect - sync with media player visibility
    React.useEffect(() => {
        setVisible(!!current && playlist.length > 1);
    }, [current, playlist.length]);

    // Only show if playlist has more than one song
    if (playlist.length <= 1) {
        return null;
    }

    // Calculate playhead position as a percentage within the current track
    const getPlayheadPosition = (): number => {
        if (currentIndex == null || !playheadSeconds) {
            return 0;
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

    return (
        <div
            className={`setlistVisualizationBar${visible ? ' setlistVisualizationBar--visible' : ''}`}
        >
            {playlist.map((track, index) => {
                const isCurrentTrack = index === currentIndex;
                const color = getSegmentColor(track, isCurrentTrack);
                const title = mediaPlayer.getTrackTitle(track);
                const proportionalWidth = getSegmentProportionalWidth(track);
                const fullTtitle = `${index + 1}. ${title.title}${title.subtitle ? ` (${title.subtitle})` : ''}`;
                const playheadPosition = isCurrentTrack ? getPlayheadPosition() : 0;

                // Calculate the total width units for percentage calculation
                const totalWidthUnits = playlist.reduce((sum, t) => sum + getSegmentProportionalWidth(t), 0);
                const widthPercentage = (proportionalWidth / totalWidthUnits) * 100;

                // Handler for seeking within the current track
                const handleCurrentTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
                    if (!isCurrentTrack) {
                        console.warn('Click on non-current track segment ignored');
                        return;
                    }

                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(1, clickX / rect.width));

                    // Get track duration
                    let trackDuration = lengthSeconds;
                    if (!isFinite(trackDuration) || trackDuration <= 0) {
                        if (audioAPI && isFinite(audioAPI.duration) && audioAPI.duration > 0) {
                            //console.log(`Using audioAPI duration for seeking to ${percentage * 100}%`);
                            trackDuration = audioAPI.duration;
                        } else {
                            //console.warn('Cannot seek without valid track duration');
                            return; // Can't seek without duration
                        }
                    } else {
                        //console.log(`Using MediaPlayerContext duration for seeking to ${percentage * 100}%`);
                    }

                    const seekTime = percentage * trackDuration;

                    // Perform the actual seek using the audio API
                    // The MediaPlayerBar's onTimeUpdate will automatically update the context
                    if (audioAPI) {
                        audioAPI.seekTo(seekTime);
                    } else {
                        //console.warn('Cannot seek: audioAPI not available');
                    }
                };

                // Handler for hover position tracking on current track
                const handleCurrentTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
                    if (!isCurrentTrack) return;

                    const rect = e.currentTarget.getBoundingClientRect();
                    const hoverX = e.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(1, hoverX / rect.width));
                    setHoverPosition(percentage * 100);

                    // Calculate the time at the hover position
                    let trackDuration = lengthSeconds;
                    if (!isFinite(trackDuration) || trackDuration <= 0) {
                        if (audioAPI && isFinite(audioAPI.duration) && audioAPI.duration > 0) {
                            trackDuration = audioAPI.duration;
                        } else {
                            setHoverTime(null);
                            return;
                        }
                    }

                    const timeAtPosition = percentage * trackDuration;
                    setHoverTime(timeAtPosition);
                };

                const handleCurrentTrackMouseLeave = () => {
                    setHoverPosition(null);
                    setHoverTime(null);
                };

                return (
                    <div
                        key={index}
                        className={`setlistVisualizationSegment ${isCurrentTrack ? 'setlistVisualizationSegment--current' : ''}`}
                        style={{
                            width: `${widthPercentage}%`,
                            flexShrink: 0,
                            "--segment-color": color,
                        } as any}
                    >
                        <div
                            className={`coloredSegment ${isCurrentTrack ? 'coloredSegment--seekable' : ''}`}
                            style={{
                                backgroundColor: "var(--segment-color)",
                                position: 'relative',
                            }}
                            onClick={isCurrentTrack ? handleCurrentTrackClick : () => {
                                mediaPlayer.setPlaylist(playlist, index);
                            }}
                            onMouseMove={isCurrentTrack ? handleCurrentTrackMouseMove : undefined}
                            onMouseLeave={isCurrentTrack ? handleCurrentTrackMouseLeave : undefined}
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
                            <span className="segmentText">{fullTtitle}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
