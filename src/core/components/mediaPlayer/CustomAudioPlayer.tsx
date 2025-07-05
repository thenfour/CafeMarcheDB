import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { gIconMap } from "../../db3/components/IconMap";
import { CMSmallButton } from "../CMCoreComponents2";

interface CustomAudioPlayerProps {
    src?: string;
    controls?: boolean;
    onLoadedMetadata?: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
    onTimeUpdate?: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
    onPlaying?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
    autoplay?: boolean;
    // Add other audio props as needed
}

// Forward ref to expose the audio element's methods
export const CustomAudioPlayer = forwardRef<HTMLAudioElement, CustomAudioPlayerProps>(
    ({ src, controls, onLoadedMetadata, onTimeUpdate, onPlaying, onPause, onEnded, autoplay, ...props }, ref) => {
        const audioRef = useRef<HTMLAudioElement>(null);
        const [isPlaying, setIsPlaying] = React.useState(false);
        const [currentTime, setCurrentTime] = React.useState(0);
        const [duration, setDuration] = React.useState(0);
        const [isLoading, setIsLoading] = React.useState(false);

        // Expose audio element methods via ref
        useImperativeHandle(ref, () => audioRef.current!, []);

        const handlePlay = async () => {
            if (audioRef.current) {
                try {
                    await audioRef.current.play();
                } catch (error) {
                    console.error("Failed to play audio:", error);
                }
            }
        };

        const handlePauseClick = () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };

        const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
            if (audioRef.current && duration > 0 && isFinite(duration)) {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, clickX / rect.width)); // Clamp between 0 and 1
                const newTime = percentage * duration;
                
                // Ensure the new time is valid before setting it
                if (isFinite(newTime) && newTime >= 0 && newTime <= duration) {
                    audioRef.current.currentTime = newTime;
                    setCurrentTime(newTime);
                }
            }
        };

        const formatTime = (seconds: number): string => {
            // Handle NaN, infinity, and negative values
            if (!isFinite(seconds) || seconds < 0) {
                return "0:00";
            }
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
            const audio = e.currentTarget;
            const audioDuration = audio.duration;
            // Ensure duration is a valid finite number
            setDuration(isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 0);
            setIsLoading(false);
            onLoadedMetadata?.(e);
        };

        const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
            const audio = e.currentTarget;
            const audioCurrentTime = audio.currentTime;
            // Ensure currentTime is a valid finite number
            setCurrentTime(isFinite(audioCurrentTime) && audioCurrentTime >= 0 ? audioCurrentTime : 0);
            onTimeUpdate?.(e);
        };

        const handlePlaying = () => {
            setIsPlaying(true);
            onPlaying?.();
        };

        const handleAudioPause = () => {
            setIsPlaying(false);
            onPause?.();
        };

        const handleEnded = () => {
            setIsPlaying(false);
            onEnded?.();
        };

        const handleLoadStart = () => {
            setIsLoading(true);
        };

        const progressPercentage = duration > 0 && isFinite(duration) && isFinite(currentTime) 
            ? Math.max(0, Math.min(100, (currentTime / duration) * 100))
            : 0;

        return (
            <div className="customAudioPlayer">
                {/* Hidden audio element that does the actual work */}
                <audio
                    ref={audioRef}
                    src={src}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlaying={handlePlaying}
                    onPause={handleAudioPause}
                    onEnded={handleEnded}
                    onLoadStart={handleLoadStart}
                    autoPlay={autoplay}
                    {...props}
                />

                {/* Custom controls */}
                {controls && (
                    <div className="customAudioControls">
                        <CMSmallButton
                            onClick={isPlaying ? handlePauseClick : handlePlay}
                            enabled={!isLoading && !!src}
                            className="playPauseButton"
                        >
                            {isLoading ? (
                                <span className="audioLoadingSpinner">⏳</span>
                            ) : isPlaying ? (
                                gIconMap.Pause()
                            ) : (
                                gIconMap.PlayCircleOutline()
                            )}
                        </CMSmallButton>

                        <div className="audioTimeDisplay">
                            {formatTime(currentTime)}
                        </div>

                        <div className="audioProgressContainer" onClick={handleSeek}>
                            <div className="audioProgressTrack">
                                <div
                                    className="audioProgressFill"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                        </div>

                        <div className="audioTimeDisplay">
                            {formatTime(duration)}
                        </div>
                    </div>
                )}
            </div>
        );
    }
);

CustomAudioPlayer.displayName = 'CustomAudioPlayer';
