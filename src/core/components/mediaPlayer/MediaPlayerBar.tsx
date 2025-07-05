import { SkipNext, SkipPrevious } from "@mui/icons-material";
import React from "react";
import { formatSongLength } from "../../../../shared/time";
import { gIconMap } from "../../db3/components/IconMap";
import { CMSmallButton } from "../CMCoreComponents2";
import { CustomAudioPlayer, CustomAudioPlayerAPI } from "./CustomAudioPlayer";
import { MediaPlayerContextType, MediaPlayerTrack } from "./MediaPlayerTypes";
import { SetlistVisualizationBar } from "./SetlistVisualizationBar";

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
    const audioRef = React.useRef<CustomAudioPlayerAPI>(null);
    const [visible, setVisible] = React.useState(false);
    const [showingPlaylistDialog, setShowingPlaylistDialog] = React.useState(false);

    const current: MediaPlayerTrack | undefined =
        mediaPlayer.currentIndex == null ? undefined : mediaPlayer.playlist[mediaPlayer.currentIndex];

    // Show/hide animation effect
    React.useEffect(() => {
        setVisible(!!current || mediaPlayer.playlist.length > 0);
    }, [current, mediaPlayer.playlist.length]);

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

    const hasPlaylist = mediaPlayer.playlist.length > 1;
    const trackNumberString = hasPlaylist && mediaPlayer.currentIndex != null
        ? `${mediaPlayer.currentIndex + 1}.` : "";

    // Always render the bar for animation, but toggle visibility class
    return (
        <div className={`mediaPlayerBar${visible ? ' mediaPlayerBar--visible' : ''}`}>
            <SetlistVisualizationBar mediaPlayer={mediaPlayer} />
            <div className="responsiveRow">
                <div className="mediaPlayerBarTransport">
                    {mediaPlayer.playlist.length > 1 && (<>
                        <CMSmallButton enabled={mediaPlayer.previousEnabled()} onClick={() => mediaPlayer.prev()}><SkipPrevious /></CMSmallButton>
                        <CMSmallButton enabled={mediaPlayer.nextEnabled()} onClick={() => mediaPlayer.next()}><SkipNext /></CMSmallButton>
                        {/* <CMSmallButton enabled={true} onClick={() => setShowingPlaylistDialog(true)}>
                        <ListIcon />
                    </CMSmallButton> */}
                    </>)}                {current && (
                        <CustomAudioPlayer
                            src={current.url}
                            controls
                            ref={audioRef}
                            onLoadedMetadata={e => {
                                const duration = e.currentTarget.duration;
                                if (isFinite(duration) && duration > 0) {
                                    mediaPlayer.setLengthSeconds(duration);
                                } else {
                                    console.log('Invalid duration on loadedMetadata:', duration);
                                }
                            }}
                            onTimeUpdate={e => {
                                const currentTime = e.currentTarget.currentTime;
                                const duration = e.currentTarget.duration;

                                mediaPlayer.setPlayheadSeconds(currentTime);

                                // Update duration if it wasn't available before or if it's now valid
                                if (isFinite(duration) && duration > 0 && duration !== mediaPlayer.lengthSeconds) {
                                    mediaPlayer.setLengthSeconds(duration);
                                }
                            }}
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
                <div className="mediaPlayerBarSegment">
                    <div className="mediaPlayerTrackMetadataDisplay">
                        <span className="mediaPlayerTrackMetadataCol1">
                            <span className="mediaPlayerTrackTitle">{trackNumberString}{title?.title || "No media"}</span>
                            <span className="mediaPlayerTrackSubtitle">{title?.subtitle}</span>
                        </span>

                        <div className="mediaPlayerTimeDisplay">
                            <span className="mediaPlayerCurrentTime">
                                {formatSongLength(Math.floor(mediaPlayer.playheadSeconds)) || "0:00"}
                            </span>
                            <span className="mediaPlayerTimeSeparator">/</span>
                            <span className="mediaPlayerTotalTime">
                                {formatSongLength(Math.floor(mediaPlayer.lengthSeconds)) || "0:00"}
                            </span>
                        </div>

                        <AnimatedFauxEqualizer enabled={mediaPlayer.isPlaying} />
                    </div>
                    <div style={{ flexGrow: 1 }}></div>
                    <div>
                        <CMSmallButton
                            onClick={() => mediaPlayer.setPlaylist([], undefined)}
                        >
                            {gIconMap.Close()}
                        </CMSmallButton>

                    </div>
                </div>
            </div>
        </div>);
};

