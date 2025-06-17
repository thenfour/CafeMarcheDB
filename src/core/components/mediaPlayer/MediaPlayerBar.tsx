import React from "react";
//import "public/style/mediaPlayer.css";
import { MediaPlayerTrack, useMediaPlayer } from "./MediaPlayerContext";
import { CMSmallButton } from "../CMCoreComponents2";
import { gIconMap } from "../../db3/components/IconMap";
import { SkipNext, SkipPrevious } from "@mui/icons-material";

// function formatTime(t?: number) {
//     if (!t || isNaN(t)) return "0:00";
//     const m = Math.floor(t / 60);
//     const s = Math.floor(t % 60);
//     return `${m}:${s.toString().padStart(2, "0")}`;
// }

export const MediaPlayerBar: React.FC = () => {
    const mediaPlayer = useMediaPlayer();
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
            audio.play().catch(() => {
                console.error("Failed to play audio:", audio.src);
            });
        } else {
            audio.pause();
        }
    }, [mediaPlayer.isPlaying, mediaPlayer.currentIndex]);

    // When track changes, reset time
    React.useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0; // Reset time when track changes
        mediaPlayer.setPlayheadSeconds(0);
    }, [mediaPlayer.currentIndex]);

    // Always render the bar for animation, but toggle visibility class
    return (
        <div className={`mediaPlayerBar${visible ? ' mediaPlayerBar--visible' : ''}`}>
            <CMSmallButton
                style={{ opacity: 1 }}
                onClick={() => mediaPlayer.setPlaylist([], undefined)}
            >
                {gIconMap.Close()}
            </CMSmallButton>

            {/* {mediaPlayer.isPlaying ? (
                <CMSmallButton onClick={() => mediaPlayer.pause()}>pause</CMSmallButton>
            ) : (
                <CMSmallButton onClick={() => mediaPlayer.unpause()}>play</CMSmallButton>
            )} */}
            <CMSmallButton enabled={mediaPlayer.previousEnabled()} onClick={() => mediaPlayer.prev()}><SkipPrevious /></CMSmallButton>
            <CMSmallButton enabled={mediaPlayer.nextEnabled()} onClick={() => mediaPlayer.next()}><SkipNext /></CMSmallButton>
            {/* <div>
                {formatTime(mediaPlayer.playheadSeconds)} / {formatTime(mediaPlayer.lengthSeconds)}
            </div> */}
            {/* <div style={{ flexGrow: 1 }} /> */}
            {current && (
                <audio
                    src={current.url}
                    controls
                    ref={audioRef}
                    onLoadedMetadata={e => mediaPlayer.setLengthSeconds(e.currentTarget.duration)}
                    onTimeUpdate={e => mediaPlayer.setPlayheadSeconds(e.currentTarget.currentTime)}
                    onPlaying={() => mediaPlayer.setIsPlaying(true)}
                    onPause={() => mediaPlayer.setIsPlaying(false)}
                    onEnded={() => mediaPlayer.next()}
                    style={{ flex: 1, maxWidth: "600px" }}
                />
            )}
            <div className="mediaPlayerTrackTitle">
                <span>{current ? mediaPlayer.getTrackTitle(current) : ""}</span>
                <div className={`equalizer ${mediaPlayer.isPlaying ? "enabled" : "disabled"}`} role="img" aria-label="Audio playing">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    );
};
