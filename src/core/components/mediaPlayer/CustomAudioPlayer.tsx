import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { gIconMap } from "../../db3/components/IconMap";
import { CMSmallButton } from "../CMCoreComponents2";
import { useLocalStorageState } from "../useLocalStorageState";
import { MediaPlayerSlider } from "./MediaPlayerSlider";
import { PlayArrow } from "@mui/icons-material";

export interface CustomAudioPlayerAPI {
    // Playback control
    play: () => Promise<void>;
    pause: () => void;

    // Properties
    get currentTime(): number;
    set currentTime(value: number);
    get duration(): number;
    get paused(): boolean;
    get ended(): boolean;
    get volume(): number;
    set volume(value: number);
    get muted(): boolean;
    set muted(value: boolean);
    get autoplay(): boolean;
    set autoplay(value: boolean);
    get src(): string;
    // set src(value: string);

    // Additional useful properties
    get readyState(): number;
    get networkState(): number;
    get buffered(): TimeRanges;

    // Custom methods
    getAudioState: () => {
        duration: number;
        currentTime: number;
        volume: number;
        muted: boolean;
        paused: boolean;
        ended: boolean;
        buffered: TimeRanges;
        readyState: number;
        networkState: number;
    } | null;
    seekTo: (time: number) => void;
}

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

// Forward ref to expose our custom API
export const CustomAudioPlayer = forwardRef<CustomAudioPlayerAPI, CustomAudioPlayerProps>(
    ({ src, controls, onLoadedMetadata, onTimeUpdate, onPlaying, onPause, onEnded, autoplay, ...props }, ref) => {
        const audioRef = useRef<HTMLAudioElement>(null);
        const [isPlaying, setIsPlaying] = React.useState(false);
        const [currentTime, setCurrentTime] = React.useState(0);
        const [duration, setDuration] = React.useState(0);
        const [isLoading, setIsLoading] = React.useState(false);
        const [volume, setVolume] = useLocalStorageState<number>({
            key: 'mediaPlayerVolume',
            initialValue: 75 // Default to 75% volume
        });
        const [isMuted, setIsMuted] = useLocalStorageState<boolean>({
            key: 'mediaPlayerMuted',
            initialValue: false
        });
        const [volumeBeforeMute, setVolumeBeforeMute] = React.useState(75);
        const [isUserSeeking, setIsUserSeeking] = React.useState(false);

        //console.log(`customaudioplayer src=${src}`);

        // Sync localStorage volume with audio element when it loads
        React.useEffect(() => {
            if (audioRef.current && audioRef.current.readyState > 0) {
                audioRef.current.volume = volume / 100;
                audioRef.current.muted = isMuted;
            }
        }, [volume, isMuted]);

        // Initialize volumeBeforeMute with current volume on mount
        React.useEffect(() => {
            if (!isMuted && volume > 0) {
                setVolumeBeforeMute(volume);
            }
        }, []); // Only run on mount

        // Expose our custom API via ref
        useImperativeHandle(ref, () => ({
            // Playback control
            play: async () => {
                if (audioRef.current) {
                    return audioRef.current.play();
                }
                return Promise.reject('Audio element not ready');
            },
            pause: () => {
                if (audioRef.current) {
                    audioRef.current.pause();
                }
            },

            // Properties with getters and setters
            get currentTime() {
                return audioRef.current?.currentTime ?? 0;
            },
            set currentTime(value: number) {
                if (audioRef.current && isFinite(value) && value >= 0) {
                    audioRef.current.currentTime = value;
                    setCurrentTime(value);
                }
            },
            get duration() {
                return audioRef.current?.duration ?? 0;
            },
            get paused() {
                return audioRef.current?.paused ?? true;
            },
            get ended() {
                return audioRef.current?.ended ?? false;
            },
            get volume() {
                return audioRef.current?.volume ?? 1;
            },
            set volume(value: number) {
                if (audioRef.current && isFinite(value) && value >= 0 && value <= 1) {
                    audioRef.current.volume = value;
                    setVolume(Math.round(value * 100));
                    setIsMuted(value === 0);
                }
            },
            get muted() {
                return audioRef.current?.muted ?? false;
            },
            set muted(value: boolean) {
                if (audioRef.current) {
                    audioRef.current.muted = value;
                    setIsMuted(value);
                }
            },
            get autoplay() {
                return audioRef.current?.autoplay ?? false;
            },
            set autoplay(value: boolean) {
                if (audioRef.current) {
                    audioRef.current.autoplay = value;
                }
            },
            get src() {
                return audioRef.current?.src ?? '';
            },
            // set src(value: string) {
            //     if (audioRef.current) {
            //         console.log("Setting audio src to:", value);
            //         audioRef.current.src = value;
            //     } else {
            //         console.warn("Audio element not ready to set src");
            //     }
            // },

            // Additional properties
            get readyState() {
                return audioRef.current?.readyState ?? 0;
            },
            get networkState() {
                return audioRef.current?.networkState ?? 0;
            },
            get buffered() {
                return audioRef.current?.buffered ?? ({} as TimeRanges);
            },

            // Custom methods
            getAudioState: () => {
                const audio = audioRef.current;
                if (!audio) return null;

                return {
                    duration: isFinite(audio.duration) ? audio.duration : 0,
                    currentTime: isFinite(audio.currentTime) ? audio.currentTime : 0,
                    volume: audio.volume,
                    muted: audio.muted,
                    paused: audio.paused,
                    ended: audio.ended,
                    buffered: audio.buffered,
                    readyState: audio.readyState,
                    networkState: audio.networkState,
                };
            },
            seekTo: (time: number) => {
                if (audioRef.current && isFinite(time) && time >= 0) {
                    audioRef.current.currentTime = time;
                    setCurrentTime(time);
                }
            },
        }), []);

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
        }; const handleProgressChange = (value: number) => {
            if (audioRef.current && duration > 0 && isFinite(duration)) {
                const newTime = value;

                // Ensure the new time is valid before setting it
                if (isFinite(newTime) && newTime >= 0 && newTime <= duration) {
                    setIsUserSeeking(true);
                    audioRef.current.currentTime = newTime;
                    setCurrentTime(newTime);

                    // Reset seeking state after a short delay to allow the audio to catch up
                    setTimeout(() => {
                        setIsUserSeeking(false);
                    }, 100);
                }
            }
        };

        const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
            const audio = e.currentTarget;
            const audioDuration = audio.duration;
            // Ensure duration is a valid finite number
            setDuration(isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 0);
            setIsLoading(false);

            // Apply persisted volume settings to the audio element
            audio.volume = volume / 100;
            audio.muted = isMuted;

            onLoadedMetadata?.(e);
        };

        const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
            const audio = e.currentTarget;
            const audioCurrentTime = audio.currentTime;
            const audioDuration = audio.duration;

            // Only update currentTime if user is not actively seeking
            if (!isUserSeeking) {
                // Ensure currentTime is a valid finite number
                setCurrentTime(isFinite(audioCurrentTime) && audioCurrentTime >= 0 ? audioCurrentTime : 0);
            }

            // Update duration if it wasn't available before or has changed
            if (isFinite(audioDuration) && audioDuration > 0 && audioDuration !== duration) {
                setDuration(audioDuration);
            }

            onTimeUpdate?.(e);
        };

        // Add handler for when audio can play to get more accurate duration info
        const handleCanPlay = () => {
            if (audioRef.current) {
                const audio = audioRef.current;
                const audioDuration = audio.duration;
                if (isFinite(audioDuration) && audioDuration > 0) {
                    setDuration(audioDuration);
                }
            }
        };

        // Add handler for duration change (some formats report duration progressively)
        const handleDurationChange = () => {
            if (audioRef.current) {
                const audio = audioRef.current;
                const audioDuration = audio.duration;
                if (isFinite(audioDuration) && audioDuration > 0) {
                    setDuration(audioDuration);
                }
            }
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
        }; const handleVolumeChange = (value: number) => {
            if (audioRef.current) {
                const newVolume = value;
                const volumeDecimal = newVolume / 100; // Convert to 0-1 for audio element

                setVolume(newVolume);
                setIsMuted(newVolume === 0);
                audioRef.current.volume = volumeDecimal;
                audioRef.current.muted = newVolume === 0;
            }
        };

        const handleMuteToggle = () => {
            if (audioRef.current) {
                if (isMuted) {
                    // Unmute: restore previous volume
                    const restoreVolume = volumeBeforeMute > 0 ? volumeBeforeMute : 75;
                    setVolume(restoreVolume);
                    setIsMuted(false);
                    audioRef.current.volume = restoreVolume / 100;
                    audioRef.current.muted = false;
                } else {
                    // Mute: save current volume and set to 0
                    setVolumeBeforeMute(volume);
                    setVolume(0);
                    setIsMuted(true);
                    audioRef.current.volume = 0;
                    audioRef.current.muted = true;
                }
            }
        };

        const getVolumeIcon = () => {
            if (isMuted || volume === 0) {
                return gIconMap.VolumeOff();
            } else if (volume < 50) {
                return gIconMap.VolumeDown();
            } else {
                return gIconMap.VolumeUp();
            }
        };

        //console.log(`audio player; duration:${duration}, readystaty:${audioRef.current?.readyState}, islaoding:${isLoading}, src:${src}, isPlaying:${isPlaying}, currentTime:${currentTime}, volume:${volume}, muted:${isMuted}`);

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
                    onCanPlay={handleCanPlay}
                    onDurationChange={handleDurationChange}
                    autoPlay={autoplay}
                    preload="metadata"
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
                                <PlayArrow />
                            )}
                        </CMSmallButton>
                        {/* 
                        <div className="audioTimeDisplay">
                            {formatTime(currentTime)}
                        </div> */}

                        <div className="audioProgressContainer">
                            <MediaPlayerSlider
                                value={currentTime}
                                min={0}
                                max={duration > 0 && isFinite(duration) ? duration : 100}
                                step={0.1}
                                onChange={handleProgressChange}
                                disabled={!src || isLoading || duration <= 0}
                                className="progressSlider"
                                aria-label="Audio progress"
                            />
                        </div>
                        {/* 
                        <div className="audioTimeDisplay">
                            {formatTime(duration)}
                        </div> */}

                        {/* Volume control */}
                        <div className="volumeControl">
                            <CMSmallButton
                                onClick={handleMuteToggle}
                                enabled={!isLoading && !!src}
                                className="muteButton"
                            >
                                {getVolumeIcon()}
                            </CMSmallButton>
                            <MediaPlayerSlider
                                value={volume}
                                min={0}
                                max={100}
                                step={1}
                                onChange={handleVolumeChange}
                                disabled={!src || isLoading}
                                className="volumeSlider"
                                aria-label="Volume"
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    }
);

CustomAudioPlayer.displayName = 'CustomAudioPlayer';
