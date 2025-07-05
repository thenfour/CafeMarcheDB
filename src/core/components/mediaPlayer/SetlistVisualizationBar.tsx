import React from "react";
import { MediaPlayerContextType, MediaPlayerTrack } from "./MediaPlayerTypes";
import { Tooltip } from "@mui/material";

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

const getSegmentColor = (track: MediaPlayerTrack): string => {
    // Use song name, file name, or URL for hashing
    const identifier = track.songContext?.name ||
        track.file?.fileLeafName ||
        track.url ||
        "untitled";

    const hash = hashString(identifier);

    // Generate a pleasing color from the hash
    const hue = hash % 360;
    const saturation = 60 + (hash % 30); // 60-90%
    const lightness = 45 + (hash % 20); // 45-65%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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

export const SetlistVisualizationBar: React.FC<{ mediaPlayer: MediaPlayerContextType }> = ({ mediaPlayer }) => {
    const { playlist, currentIndex, playheadSeconds, lengthSeconds } = mediaPlayer;
    const [visible, setVisible] = React.useState(false);

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

        // If lengthSeconds is invalid (Infinity, NaN, or 0), try to get it from DOM
        if (!isFinite(trackDuration) || trackDuration <= 0) {
            // Try to find audio element in the DOM as a fallback
            const audioElement = document.querySelector('audio');
            if (audioElement && isFinite(audioElement.duration) && audioElement.duration > 0) {
                trackDuration = audioElement.duration;
                console.log(`Using fallback duration from DOM: ${trackDuration}`);
            } else {
                console.log(`Invalid lengthSeconds: ${lengthSeconds} and no valid DOM audio duration, cannot calculate playhead position`);
                return 0;
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
                const color = getSegmentColor(track);
                const title = mediaPlayer.getTrackTitle(track);
                const proportionalWidth = getSegmentProportionalWidth(track);
                const fullTtitle = `${index + 1}. ${title.title}${title.subtitle ? ` (${title.subtitle})` : ''}`;
                const playheadPosition = isCurrentTrack ? getPlayheadPosition() : 0;

                // Calculate the total width units for percentage calculation
                const totalWidthUnits = playlist.reduce((sum, t) => sum + getSegmentProportionalWidth(t), 0);
                const widthPercentage = (proportionalWidth / totalWidthUnits) * 100;

                return (
                    <div
                        key={index}
                        className={`setlistVisualizationSegment ${isCurrentTrack ? 'setlistVisualizationSegment--current' : ''}`}
                        style={{
                            width: `${widthPercentage}%`,
                            flexShrink: 0,
                        }}
                    >
                        <Tooltip title={fullTtitle} arrow>
                            <div
                                className={`coloredSegment`}
                                style={{
                                    backgroundColor: color,
                                    position: 'relative',
                                }}
                                onClick={() => {
                                    mediaPlayer.setPlaylist(playlist, index);
                                }}
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
                                <span className="segmentText">{fullTtitle}</span>
                            </div>
                        </Tooltip>
                    </div>
                );
            })}
        </div>
    );
};
