import { SkipNext, SkipPrevious, Sync } from "@mui/icons-material";
import { Tooltip } from "@mui/material";
import React from "react";
import { formatSongLength } from "../../../../shared/time";
import { CMSmallButton } from "../CMCoreComponents2";
import { CustomAudioPlayer, CustomAudioPlayerAPI } from "./CustomAudioPlayer";
import { MediaPlayerContextType } from "./MediaPlayerTypes";
import { SetlistVisualizationBars } from "./SetlistVisualizationBar";

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
            <span></span>
            <span></span>
        </div>
    );
}

export const MediaPlayerBar: React.FC<{ mediaPlayer: MediaPlayerContextType }> = ({ mediaPlayer }) => {
    const audioRef = React.useRef<CustomAudioPlayerAPI>(null);
    const [visible, setVisible] = React.useState(false);
    const [debugTooltipOpen, setDebugTooltipOpen] = React.useState(true); // Add this for debugging
    //const [showingPlaylistDialog, setShowingPlaylistDialog] = React.useState(false);

    const current = mediaPlayer.currentTrack;
    const currentUri = current ? mediaPlayer.getTrackUri(current) : undefined;

    // Show/hide animation effect
    React.useEffect(() => {
        setVisible(!!current || mediaPlayer.playlist.length > 0);
    }, [current, mediaPlayer.playlist.length]);

    // Sync play/pause with isPlaying
    React.useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (!current) return;
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

    // Always render the bar for animation, but toggle visibility class
    return (
        <div className={`mediaPlayerBar${visible ? ' mediaPlayerBar--visible' : ''}`}>
            {hasPlaylist && (
                <SetlistVisualizationBars mediaPlayer={mediaPlayer} audioAPI={audioRef.current} />
            )}
            <div className="responsiveRow">
                <div className="mediaPlayerBarTransport">
                    {mediaPlayer.canPullPlaylist && (
                        <Tooltip title="Refresh Playlist" arrow>
                            <div>
                                <CMSmallButton onClick={() => mediaPlayer.pullPlaylist()}><Sync /></CMSmallButton>
                            </div>
                        </Tooltip>
                    )}
                    {mediaPlayer.playlist.length > 1 && (<>
                        <CMSmallButton enabled={mediaPlayer.previousEnabled()} onClick={() => mediaPlayer.prev()}><SkipPrevious /></CMSmallButton>
                        <CMSmallButton enabled={mediaPlayer.nextEnabled()} onClick={() => mediaPlayer.next()}><SkipNext /></CMSmallButton>
                    </>)}
                    {current && (
                        <CustomAudioPlayer
                            src={currentUri}
                            ref={audioRef}
                            onDurationChange={(e, duration) => {
                                const audio = audioRef.current;
                                if (!audio) return;
                                mediaPlayer.setLengthSeconds(duration);
                            }}
                            onTimeUpdate={e => {
                                const currentTime = e.currentTarget.currentTime;
                                mediaPlayer.setPlayheadSeconds(currentTime);
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
                            <span className="mediaPlayerTrackTitle">{title?.displayIndex}{title?.title || "No media"}</span>
                            <span className="mediaPlayerTrackSubtitle">{title?.subtitle}</span>
                        </span>

                        <div className="mediaPlayerTimeDisplay">
                            <span className="mediaPlayerCurrentTime">
                                {formatSongLength(Math.floor(mediaPlayer.playheadSeconds)) || "0:00"}
                            </span>
                            <span className="mediaPlayerTimeSeparator">/</span>
                            <span className="mediaPlayerTotalTime">
                                {mediaPlayer.lengthSeconds === undefined ? "-:--" : formatSongLength(Math.floor(mediaPlayer.lengthSeconds)) || "0:00"}
                            </span>
                        </div>

                        <AnimatedFauxEqualizer enabled={mediaPlayer.isPlaying} />
                    </div>
                    <div style={{ flexGrow: 1 }}></div>
                    {/* <div>
                        <CMSmallButton
                            onClick={() => mediaPlayer.setPlaylist([], undefined)}
                        >
                            {gIconMap.Close()}
                        </CMSmallButton>

                    </div> */}
                </div>
            </div>
        </div>);
};

