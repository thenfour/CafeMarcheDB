import React from "react";
import { MediaPlayerContextType, MediaPlayerTrack } from "./MediaPlayerContext";
import { CMSmallButton } from "../CMCoreComponents2";
import { gIconMap } from "../../db3/components/IconMap";
import { SkipNext, SkipPrevious } from "@mui/icons-material";
import { AdminInspectObject } from "../CMCoreComponents";

export const AnimatedFauxEqualizer: React.FC<{
    className?: string;
    style?: React.CSSProperties;
    enabled?: boolean;
}> = (props) => {
    return (
        <div className={`equalizer ${props.className || ''} ${props.enabled ? 'enabled' : 'disabled'}`} style={props.style} role="img" aria-label="Audio playing">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
        </div>
    );
}

export const MediaPlayerBar: React.FC<{ mediaPlayer: MediaPlayerContextType }> = ({ mediaPlayer }) => {
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const [visible, setVisible] = React.useState(false);

    const current: MediaPlayerTrack | undefined =
        mediaPlayer.currentIndex == null ? undefined : mediaPlayer.playlist[mediaPlayer.currentIndex];

    // Show/hide animation effect
    React.useEffect(() => {
        setVisible(!!current);
    }, [current]);

    // Sync play/pause with isPlaying
    React.useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (mediaPlayer.isPlaying) {
            // the audio player won't start playing until the media is ready sometimes,
            // so set autoplay any time we expect playing.
            audio.autoplay = true;
            audio.play().catch(() => {
                console.error("Failed to play audio:", audio.src);
            });
        } else {
            audio.autoplay = false; // see above
            if (!audio.paused) {
                console.log("mediaPlayer.paused = false; setting PAUSED");
                audio.pause();
            }
        }
    }, [mediaPlayer.isPlaying, mediaPlayer.currentIndex]);

    // When track changes, reset time
    React.useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0; // Reset time when track changes
        mediaPlayer.setPlayheadSeconds(0);
    }, [mediaPlayer.currentIndex]);

    const title = current && mediaPlayer.getTrackTitle(current);

    // Always render the bar for animation, but toggle visibility class
    return (
        <div className={`mediaPlayerBar${visible ? ' mediaPlayerBar--visible' : ''}`}>
            <div className="mediaPlayerBarTransport">
                <CMSmallButton
                    style={{ opacity: 1 }}
                    onClick={() => mediaPlayer.setPlaylist([], undefined)}
                >
                    {gIconMap.Close()}
                </CMSmallButton>

                <CMSmallButton enabled={mediaPlayer.previousEnabled()} onClick={() => mediaPlayer.prev()}><SkipPrevious /></CMSmallButton>
                <CMSmallButton enabled={mediaPlayer.nextEnabled()} onClick={() => mediaPlayer.next()}><SkipNext /></CMSmallButton>

                {current && (
                    <audio
                        src={current.url}
                        controls
                        ref={audioRef}
                        onLoadedMetadata={e => mediaPlayer.setLengthSeconds(e.currentTarget.duration)}
                        onTimeUpdate={e => mediaPlayer.setPlayheadSeconds(e.currentTarget.currentTime)}
                        onPlaying={() => {
                            mediaPlayer.setIsPlaying(true);
                        }}
                        onPause={() => {
                            mediaPlayer.setIsPlaying(false);
                        }}
                        onEnded={() => {
                            // don't auto-next if the playlist is ending.
                            if (mediaPlayer.currentIndex == null || mediaPlayer.currentIndex + 1 >= mediaPlayer.playlist.length) {
                                const audio = audioRef.current;
                                if (!audio) return;
                                // If we reach the end of the playlist, reset the player
                                audio.currentTime = 0; // Reset time
                                return;
                            }
                            mediaPlayer.next();
                        }}
                    />
                )}
            </div>
            <div className="mediaPlayerTrackMetadataDisplay">
                <span className="mediaPlayerTrackMetadataCol1">
                    <span className="mediaPlayerTrackTitle">{title?.title}</span>
                    <span className="mediaPlayerTrackSubtitle">{title?.subtitle}</span>
                </span>

                <AnimatedFauxEqualizer enabled={mediaPlayer.isPlaying} />
            </div>
        </div>
    );
};

