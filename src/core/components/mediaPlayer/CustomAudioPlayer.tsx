import { IsUsableNumber } from "@/shared/utils";
import { PlayArrow } from "@mui/icons-material";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { gIconMap } from "../../db3/components/IconMap";
import { CMSmallButton } from "../CMCoreComponents2";
import { useLocalStorageState } from "../useLocalStorageState";
import { MediaPlayerSlider } from "./MediaPlayerSlider";

// Constants
const DEFAULT_VOLUME = 75;
const VOLUME_THRESHOLD_LOW = 50;
const SEEK_TIMEOUT_MS = 500;
const CHROME_DURATION_HACK_SEEK_VALUE = 1e101;

export interface CustomAudioPlayerAPI {
    // Playback control
    play: () => Promise<void>;
    pause: () => void;

    // Properties
    get currentTime(): number;
    set currentTime(value: number);
    get duration(): number | undefined;
    get paused(): boolean;
    get ended(): boolean;
    get volume(): number;
    set volume(value: number);
    get muted(): boolean;
    set muted(value: boolean);
    get autoplay(): boolean;
    set autoplay(value: boolean);
    get src(): string;

    // Additional useful properties
    get readyState(): number;
    get networkState(): number;
    get buffered(): TimeRanges;

    // Custom methods
    getAudioState: () => {
        duration: number | undefined;
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
    onLoadedMetadata?: () => void;
    onTimeUpdate?: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
    onPlaying?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
    onDurationChange?: (e: Event | null, duration: number | undefined) => void;
    autoplay?: boolean;
    // Add other audio props as needed
}

// Forward ref to expose our custom API
export const CustomAudioPlayer = forwardRef<CustomAudioPlayerAPI, CustomAudioPlayerProps>(
    ({ src, controls, onLoadedMetadata, onTimeUpdate, onPlaying, onPause, onEnded, autoplay, onDurationChange, ...props }, ref) => {
        const audioRef = useRef<HTMLAudioElement>(null);
        const [isPlaying, setIsPlaying] = React.useState(false);
        const [currentTime, setCurrentTime] = React.useState(0);
        const [reportedDuration, setReportedDuration] = React.useState<number | undefined>(undefined);
        const [isLoading, setIsLoading] = React.useState(false);
        const [volume, setVolume] = useLocalStorageState<number>({
            key: 'mediaPlayerVolume',
            initialValue: DEFAULT_VOLUME
        });
        const [isMuted, setIsMuted] = useLocalStorageState<boolean>({
            key: 'mediaPlayerMuted',
            initialValue: false
        });
        const [volumeBeforeMute, setVolumeBeforeMute] = React.useState(DEFAULT_VOLUME);
        const [isUserSeeking, setIsUserSeeking] = React.useState(false);

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
            // Playbook control
            play: async () => {
                if (audioRef.current) {
                    return audioRef.current.play();
                }
                return Promise.reject(new Error('Audio element not ready'));
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
                return reportedDuration;
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
                    duration: reportedDuration,
                    currentTime: audio.currentTime,
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
                    //console.log(`seeking to ${time} on src ${audioRef.current.src}`);
                    audioRef.current.currentTime = time;
                    setCurrentTime(time);
                }
            },
        }), [reportedDuration, volume, isMuted]);

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

        const duration = IsUsableNumber(audioRef.current?.duration) ? audioRef.current?.duration : undefined;
        const setReportedDurationIfNeeded = (newDuration: number | undefined, reason: string) => {
            if (reportedDuration == null && newDuration != null && reportedDuration !== newDuration) {
                //console.log(`Setting reported duration to ${newDuration} because: ${reason}`);
                setReportedDuration(newDuration);
            }
        };

        React.useEffect(() => {
            setReportedDurationIfNeeded(undefined, "src changed"); // Reset duration when src changes
        }, [src]);

        // establish a timer that checks for a valid duration
        React.useEffect(() => {
            const checkDuration = () => {
                if (audioRef.current && IsUsableNumber(audioRef.current.duration)) {
                    setReportedDurationIfNeeded(audioRef.current.duration, "duration check timer");
                }
            };
            const intervalId = setInterval(checkDuration, 200);
            return () => clearInterval(intervalId);
        }, []);

        React.useEffect(() => {
            onDurationChange?.(null, reportedDuration);
        }, [reportedDuration]);

        const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

        const handleProgressChange = (value: number) => {
            if (duration === undefined) return;
            if (!audioRef.current) return;
            const newTime = value;

            // Clear any existing timeout
            if (seekTimeoutRef.current) {
                clearTimeout(seekTimeoutRef.current);
            }

            // Set seeking state and update time
            setIsUserSeeking(true);
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);

            // Use seeked event to properly detect when seeking is complete
            const handleSeeked = () => {
                setIsUserSeeking(false);
                audioRef.current?.removeEventListener('seeked', handleSeeked);
            };

            audioRef.current.addEventListener('seeked', handleSeeked, { once: true });

            // Fallback timeout in case seeked event doesn't fire
            seekTimeoutRef.current = setTimeout(() => {
                setIsUserSeeking(false);
                audioRef.current?.removeEventListener('seeked', handleSeeked);
            }, SEEK_TIMEOUT_MS);
        };

        // Cleanup seek timeout on unmount
        React.useEffect(() => {
            return () => {
                if (seekTimeoutRef.current) {
                    clearTimeout(seekTimeoutRef.current);
                }
            };
        }, []);

        const chromeHackCleanupRef = useRef<(() => void) | null>(null);

        React.useEffect(() => {
            const audio = audioRef.current;
            if (!audio) return;

            const handleLoadedMetadata = () => {
                setIsLoading(false);
                setReportedDurationIfNeeded(audio.duration, "handleLoadedMetadata");

                // Apply persisted volume settings to the audio element
                if (audioRef.current) {
                    audioRef.current.volume = volume / 100;
                    audioRef.current.muted = isMuted;
                }

                if (audio.duration === Infinity) {
                    // Chrome requires a hack; firefox reports the duration based on the actual audio file data,
                    // but chrome reports Infinity for VBR songs or if metadata is not correct. This is a hack
                    // to force seek to the end, grab the time, and use that as the duration.

                    // Save original handler
                    const originalOnTimeUpdate = audio.ontimeupdate;

                    // Create cleanup function
                    const cleanup = () => {
                        if (audio.ontimeupdate === tempHandler) {
                            audio.ontimeupdate = originalOnTimeUpdate;
                        }
                    };

                    // Temporarily override
                    const tempHandler = () => {
                        cleanup();
                        audio.currentTime = 0;
                        setReportedDurationIfNeeded(audio.duration, "Chrome hack");
                    };

                    audio.ontimeupdate = tempHandler;
                    chromeHackCleanupRef.current = cleanup;

                    // Force seek to trigger actual duration detection
                    audio.currentTime = CHROME_DURATION_HACK_SEEK_VALUE;
                } else {
                    setReportedDurationIfNeeded(audio.duration, "normal duration");
                }
            };

            audio.addEventListener('loadedmetadata', handleLoadedMetadata);
            onLoadedMetadata?.();

            return () => {
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
                // Cleanup Chrome hack if it's still active
                if (chromeHackCleanupRef.current) {
                    chromeHackCleanupRef.current();
                    chromeHackCleanupRef.current = null;
                }
            };

        }, [src, volume, isMuted, audioRef.current]);



        const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
            if (!audioRef.current) return;
            const audioCurrentTime = audioRef.current.currentTime;
            setReportedDurationIfNeeded(e.currentTarget.duration, "handleTimeUpdate");

            if (isUserSeeking || !IsUsableNumber(audioCurrentTime)) {
                return; // Skip if user is seeking or currentTime is not usable
            }

            // Ensure currentTime is a valid finite number
            setCurrentTime(isFinite(audioCurrentTime) && audioCurrentTime >= 0 ? audioCurrentTime : 0);

            onTimeUpdate?.(e);
        };

        // Add handler for when audio can play to get more accurate duration info
        const handleCanPlay = () => {
            if (audioRef.current) {
                setReportedDurationIfNeeded(audioRef.current.duration, "handleCanPlay");
            }
        };

        const handleDurationChange = () => {
            if (audioRef.current) {
                setReportedDurationIfNeeded(audioRef.current.duration, "handleDurationChange");
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
                    const restoreVolume = volumeBeforeMute > 0 ? volumeBeforeMute : DEFAULT_VOLUME;
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
            } else if (volume < VOLUME_THRESHOLD_LOW) {
                return gIconMap.VolumeDown();
            } else {
                return gIconMap.VolumeUp();
            }
        };

        return (
            <div className="customAudioPlayer">
                {/* Hidden audio element that does the actual work */}
                <audio
                    ref={audioRef}
                    src={src}
                    //onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlaying={handlePlaying}
                    onPause={handleAudioPause}
                    onEnded={handleEnded}
                    onLoadStart={handleLoadStart}
                    onCanPlay={handleCanPlay}
                    onDurationChange={handleDurationChange}
                    autoPlay={autoplay}
                    preload="metadata"
                // {...props}
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

                        <div className="audioProgressContainer">
                            <MediaPlayerSlider
                                value={currentTime}
                                min={0}
                                max={duration || 100}
                                step={0.1}
                                onChange={handleProgressChange}
                                disabled={!src || isLoading || duration === undefined}
                                className="progressSlider"
                                aria-label="Audio progress"
                            />
                        </div>

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
