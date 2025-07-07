import { getHashedColor, IsUsableNumber, lerp } from "@/shared/utils";
import React from "react";
import { formatSongLength } from "../../../../shared/time";
import { CustomAudioPlayerAPI } from "./CustomAudioPlayer";
//import { useMediaPlayer } from "./MediaPlayerContext"; <-- circular dependency.
import { PlayCircleOutlined } from "@mui/icons-material";
import { gCharMap } from "../../db3/components/IconMap";
import { CMSmallButton } from "../CMCoreComponents2";
import { useLocalStorageState } from "../useLocalStorageState";
import { MediaPlayerContextType, MediaPlayerTrack } from "./MediaPlayerTypes";

const TEN_MINUTES = 10 * 60;          // 600 s
const MIN_ROW_PX = 120;              // visual floor (unchanged)

type TrackType = "song" | "divider" | "dummy";

const getItemType = (item: MediaPlayerTrack): TrackType => {
    if (item.setListItemContext?.type === "divider") {
        if (item.setListItemContext.isSong) {
            return "dummy";
        }
        return "divider";
    }

    if (item.url || item.file) {
        return "song";
    }
    return "dummy";
};

export const getTheoreticalDurationSeconds = (
    item: MediaPlayerTrack,
): number | undefined => {
    const fallback = 200;

    if (item.setListItemContext?.type === "divider") {
        return item.setListItemContext.isSong
            ? item.setListItemContext.lengthSeconds || fallback
            : undefined;                         // pure divider → no duration
    }

    if (item.songContext?.lengthSeconds) {
        return item.songContext?.lengthSeconds;
    }

    return fallback;
};

// export const rowWeightFromDuration = (secs: number): number => {
//     const kRow = 0.001;        // smaller ⇒ rows cluster closer together
//     const pivotRow = 30 * 60;     // a 30-min playlist lands near 0.5
//     return 1 / (1 + Math.exp(-kRow * (secs - pivotRow)));
// };

export const weightFromDuration = (secs?: number): number => {
    if (secs == null) return 0;
    const k = 0.006;              // tweak feel. lower number = every track more or less the same width. higher = more variance.
    const pivot = 5 * 60;         // 5-min track sits near 0.5
    return 1 / (1 + Math.exp(-k * (secs - pivot)));
};

export const DIVIDER_PX = 34;

interface StyleData {
    containerClassName: string;
    containerStyle: React.CSSProperties;
    coloredBarClassName: string;
    coloredBarStyle: React.CSSProperties;
}

const getItemStyleData = (item: MediaPlayerTrack, isCurrentTrack: boolean, mediaPlayer: MediaPlayerContextType): StyleData => {
    const title = mediaPlayer.getTrackTitle(item);

    switch (getItemType(item)) {
        case "divider": {
            if (item.setListItemContext?.type !== "divider") throw new Error("Expected item to be a divider");

            return {
                containerClassName: "songPartition--divider",
                containerStyle: {
                    "--segment-color": item.setListItemContext.color || "#666666",
                } as any,
                coloredBarClassName: "",
                coloredBarStyle: {
                }
            }
        }
        default:
        case "dummy":
            return {
                containerClassName: "songPartition--dummy",
                containerStyle: {
                    "--segment-color": "transparent",
                } as any,
                coloredBarClassName: "",//"hatch",
                coloredBarStyle: {
                } as any,
            }
        case "song": {

            return {
                containerClassName: "songPartition--song",
                containerStyle: {
                    "--segment-color": getHashedColor(title.title, {
                        alpha: "100%",
                        luminosity: "50%",
                        saturation: "70%",// isCurrentTrack ? "90%" : "15%",
                    }),
                } as any,
                coloredBarClassName: "",
                coloredBarStyle: {
                }
            };
        }
    }

};

interface VisBarSegmentProps {
    item: MediaPlayerTrack;
    isCurrentTrack: boolean;
    audioAPI: CustomAudioPlayerAPI | null;
    mediaPlayer: MediaPlayerContextType;
    //widthPx?: number;
    styleOverride: React.CSSProperties;
};

const VisBarSegment = ({ item, isCurrentTrack, audioAPI, mediaPlayer, styleOverride }: VisBarSegmentProps) => {
    const [hoverPosition, setHoverPosition] = React.useState<number | null>(null);
    const [hoverTime, setHoverTime] = React.useState<number | null>(null);

    const trackType = getItemType(item);
    const styleData = getItemStyleData(item, false, mediaPlayer);
    const title = mediaPlayer.getTrackTitle(item);

    const isInteractable = item.file || item.url;

    // Calculate playhead position as a percentage within the current track
    const { playheadSeconds, lengthSeconds } = mediaPlayer;
    const getPlayheadPosition = (): number | undefined => {
        if (!isCurrentTrack || !playheadSeconds) {
            return undefined;
        }
        if (!lengthSeconds) {
            return undefined;
        }

        const position = Math.max(0, Math.min(100, (playheadSeconds / lengthSeconds) * 100));
        return position;
    };

    let playheadPosition: number | undefined = undefined;
    if (isCurrentTrack) {
        playheadPosition = getPlayheadPosition();
    }

    const handleClickColoredBar = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isInteractable) return;

        if (isCurrentTrack) {
            // Handle seeking within current track
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, clickX / rect.width));
            seekToPosition(percentage);
        }
    };

    const handleClickContainer = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isInteractable) return;

        if (!isCurrentTrack) {
            // Switch to this track
            mediaPlayer.playTrackOfPlaylist(item.playlistIndex);
        }
    };

    // Handler for hover on current track
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isCurrentTrack) return;

        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        const hoverX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, hoverX / rect.width));
        setHoverPosition(percentage * 100);

        if (!IsUsableNumber(lengthSeconds)) {
            return;
        }

        const timeAtPosition = percentage * lengthSeconds;
        setHoverTime(timeAtPosition);
    };

    const handleMouseLeave = () => {
        setHoverPosition(null);
        setHoverTime(null);
    };

    function seekToPosition(percentage: number) {
        if (!lengthSeconds) {
            return;
        }

        const seekTime = percentage * lengthSeconds;

        // Perform the actual seek using the audio API
        if (audioAPI) {
            audioAPI.seekTo(seekTime);
        }
    }

    return <div
        // this container div is needed in order to be marginless
        className={`songPartition ${styleData.containerClassName} ${isCurrentTrack ? 'songPartition--current' : ''} ${isCurrentTrack ? 'songPartition--seekable' : ''} ${isInteractable ? 'songPartition--interactable' : 'songPartition--noninteractable'}`}
        style={{
            ...styleOverride,
            ...styleData.containerStyle,
        } as any}
        onClick={handleClickContainer}
    >
        <div
            // bar which adds margin; its width must represent the width of the song, but can be tall enough to click on.
            className={`songBoundsContainer`}
            style={{
                ...styleData.coloredBarStyle,
            } as React.CSSProperties}
            onMouseMove={isCurrentTrack ? handleMouseMove : undefined}
            onMouseLeave={isCurrentTrack ? handleMouseLeave : undefined}
            onClick={handleClickColoredBar}
        >
            {isInteractable && <div
                // represents the "body" of the song; the line representing the track bar.
                className={`songTrackBar ${styleData.coloredBarClassName}`}
                style={styleData.coloredBarStyle}
            >
            </div>}
            {/* Progress fill for current track */}
            {isCurrentTrack && IsUsableNumber(playheadPosition) && (<>
                <div
                    className="progressFillLeft"
                    style={{
                        width: `${playheadPosition}%`,
                    }}
                />
                <div
                    className="progressFillRight"
                    style={{
                        width: `${100 - playheadPosition!}%`,
                    }}
                />
            </>
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
            {trackType === "divider" && (
                <div className="dividerIndicator" />
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
            {trackType !== "divider" && <div className="textOverlayContainer">
                <span className="songTitle">
                    {title.displayIndex}{title.title}
                </span>
                {!isCurrentTrack && isInteractable && <span className="playIcon"><PlayCircleOutlined /></span>}
            </div>}
        </div>
    </div>;
};

export const SetlistVisualizationBar: React.FC<{
    beginWithDummyDivider: boolean;
    mediaPlayer: MediaPlayerContextType;
    audioAPI: CustomAudioPlayerAPI | null;
    startIndex: number;
    length: number;
}> = ({ mediaPlayer, audioAPI, startIndex, length, beginWithDummyDivider }) => {

    const { playlist, currentIndex, } = mediaPlayer;

    // take the playlist segment based on bounds
    const items = playlist.slice(startIndex, startIndex + length);

    return (
        <div className="setlistVisualizationBar">
            {beginWithDummyDivider && <div className="songPartition dummyDivider" />}
            {items.map((track, idx) => {
                const duration = getTheoreticalDurationSeconds(track);
                let flexStyle: React.CSSProperties = {};
                if (duration == null) {
                    flexStyle = { flex: `0 0 ${DIVIDER_PX}px` };
                } else {
                    flexStyle = {
                        flex: `${weightFromDuration(duration) || 1} 1 0`,
                        // don't set minwidth because i need to support very small screens
                        maxWidth: 550,
                    }
                }

                return (
                    <VisBarSegment
                        key={idx}
                        styleOverride={flexStyle}
                        item={track}
                        isCurrentTrack={currentIndex === idx + startIndex}
                        audioAPI={audioAPI}
                        mediaPlayer={mediaPlayer}
                    />
                );
            })}
        </div>
    );
};

export const EXPAND_STYLE_VALUES = ["expanded", "normal", "collapsed"] as const;
export type ExpandStyle = typeof EXPAND_STYLE_VALUES[number];

export const isExpandStyle = (v: unknown): v is ExpandStyle =>
    typeof v === "string" && EXPAND_STYLE_VALUES.includes(v as any);

export const SetlistVisualizationBars: React.FC<{
    mediaPlayer: MediaPlayerContextType;
    audioAPI: CustomAudioPlayerAPI | null;
}> = ({ mediaPlayer, audioAPI }) => {
    const { playlist } = mediaPlayer;
    const [expanded, setExpanded] = useLocalStorageState<ExpandStyle>({
        key: "setlistVisualizationBarExpanded",
        initialValue: "normal",
        deserialize: (v) => (isExpandStyle(v) ? v : "normal"),
        serialize: (v) => (isExpandStyle(v) ? v : "normal"),
    });

    // calculate rows. a new row begins when a divider is encountered that's marked as a break,
    // as long as it is not just after another break (avoid empty rows).
    const rowBounds: { startIndex: number, length: number }[] = [];
    let currentRow: { startIndex: number, length: number } = { startIndex: 0, length: 0 };
    for (let i = 0; i < playlist.length; i++) {
        const track = playlist[i]!;
        if (track.setListItemContext?.type === "divider" && track.setListItemContext.isInterruption && currentRow.length > 0) {
            // If we hit a divider that is an interruption, finalize the current row
            currentRow.length = i - currentRow.startIndex; // Set length of the row
            rowBounds.push(currentRow);
            currentRow = { startIndex: i, length: 0 }; // Start a new row after the divider
        } else {
            currentRow.length++; // Increment the length of the current row
        }
    }
    // If there's a remaining row after the loop, add it
    if (currentRow.length > 0 || currentRow.startIndex < playlist.length) {
        currentRow.length = playlist.length - currentRow.startIndex; // Set length of the last row
        rowBounds.push(currentRow);
    }

    if (rowBounds.length < 1) {
        return null;
    }

    let needsFirstRowDummyDivider = false;

    if (rowBounds.length > 1) {
        // if the last row is only dividers, move it to the previous row
        const lastRow = rowBounds[rowBounds.length - 1]!;
        const lastRowItems = playlist.slice(lastRow.startIndex, lastRow.startIndex + lastRow.length);
        const onlyDividers = lastRowItems.every(item => item.setListItemContext?.type === "divider");
        if (onlyDividers) {
            // Move the last row's length to the previous row
            const previousRow = rowBounds[rowBounds.length - 2]!;
            previousRow.length += lastRow.length;
            rowBounds.pop(); // Remove the last row
        }

        // if all rows except the first begin with a divider, then add a dummy divider in the first row; it's more visually comfortable.
        const firstRow = rowBounds[0]!;
        const firstRowItems = playlist.slice(firstRow.startIndex, firstRow.startIndex + firstRow.length);
        const firstRowStartsWithDivider = firstRowItems[0]?.setListItemContext?.type === "divider";
        const allOtherRowsStartWithDivider = rowBounds.slice(1).every(row => {
            const items = playlist.slice(row.startIndex, row.startIndex + row.length);
            return items[0]?.setListItemContext?.type === "divider";
        });
        needsFirstRowDummyDivider = allOtherRowsStartWithDivider && !firstRowStartsWithDivider;
    }

    const getRowTotalDurationSeconds = (row: MediaPlayerTrack[]) =>
        row.reduce((s, t) => s + (getTheoreticalDurationSeconds(t) ?? 0), 0);

    const rowMediaItems = rowBounds.map(({ startIndex, length }) =>
        playlist.slice(startIndex, startIndex + length));

    const rowDurations = rowMediaItems.map(getRowTotalDurationSeconds);

    const referenceSecs = Math.max(Math.max(...rowDurations), TEN_MINUTES); // the duration that 100% width will represent.

    return (
        <div
            className={`setlistVisualizationBarContainer ${expanded}`}
        >
            <div className="setlistVisualizationBarControls">
                <CMSmallButton tooltip={"Expand the playlist visualization to show the full playlist"} onClick={() => setExpanded("expanded")} className={`expand ${expanded === "expanded" ? "selected" : ""}`}>
                    Full {gCharMap.UpArrow()}
                </CMSmallButton>
                <CMSmallButton tooltip={"Show just a portion of the playlist, to not take too much space."} onClick={() => setExpanded("normal")} className={`normal ${expanded === "normal" ? "selected" : ""}`}>
                    Normal
                </CMSmallButton>
                <CMSmallButton tooltip={"Hide the playlist visualization"} onClick={() => setExpanded("collapsed")} className={`collapse ${expanded === "collapsed" ? "selected" : ""}`}>
                    Hide {gCharMap.DownArrow()}
                </CMSmallButton>
            </div>
            <div className="setlistVisualizationBarContainer BarsContainer">
                {rowMediaItems.map((rowItems, i) => (
                    <div
                        key={i}
                        style={{
                            width: `${lerp(.25, 1, (rowDurations[i]! / referenceSecs)) * 100}%`,
                            minWidth: MIN_ROW_PX,
                        }}
                    >
                        <SetlistVisualizationBar
                            beginWithDummyDivider={needsFirstRowDummyDivider && i === 0}
                            mediaPlayer={mediaPlayer}
                            audioAPI={audioAPI}
                            startIndex={rowBounds[i]!.startIndex}
                            length={rowBounds[i]!.length}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
