import React from "react";
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

export const SetlistVisualizationBar: React.FC<{ mediaPlayer: MediaPlayerContextType }> = ({ mediaPlayer }) => {
    const { playlist, currentIndex } = mediaPlayer;
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

    const segmentWidth = 100 / playlist.length;

    return (
        <div className={`setlistVisualizationBar${visible ? ' setlistVisualizationBar--visible' : ''}`}>
            {playlist.map((track, index) => {
                const isCurrentTrack = index === currentIndex;
                const color = getSegmentColor(track);
                const title = mediaPlayer.getTrackTitle(track);

                return (
                    <div
                        key={index}
                        className={`setlistVisualizationSegment ${isCurrentTrack ? 'setlistVisualizationSegment--current' : ''}`}
                        style={{
                            flex: `1`,
                            backgroundColor: color,
                        }}
                        title={`${index + 1}. ${title.title}${title.subtitle ? ` (${title.subtitle})` : ''}`}
                        onClick={() => {
                            mediaPlayer.setPlaylist(playlist, index);
                        }}
                    >
                        <span>{title.title}</span>
                    </div>
                );
            })}
        </div>
    );
};
