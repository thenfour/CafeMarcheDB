import { getHashedColor, IsUsableNumber } from "@/shared/utils";
import React from "react";
import { formatSongLength } from "../../../../shared/time";
import { CustomAudioPlayerAPI } from "./CustomAudioPlayer";
//import { useMediaPlayer } from "./MediaPlayerContext"; <-- circular dependency.
import { PlayCircleOutlined } from "@mui/icons-material";
import { gCharMap } from "../../db3/components/IconMap";
import { CMSmallButton } from "../CMCoreComponents2";
import { useLocalStorageState } from "../useLocalStorageState";
import { MediaPlayerContextType, MediaPlayerTrack } from "./MediaPlayerTypes";

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


const getTheoreticalDurationSeconds = (item: MediaPlayerTrack): number => {
    const fallbackDuration = 200;
    if (item.setListItemContext?.type === "divider") {
        if (item.setListItemContext.isSong) {
            // If it's a song divider, we can use the song's duration
            return item.setListItemContext.lengthSeconds || fallbackDuration;
        }
        // For regular dividers, we don't have a duration
        return fallbackDuration;
    }
    return item.songContext?.lengthSeconds || fallbackDuration;
}

const MIN_WIDTH_PX = 80;   // never smaller than this
const MAX_WIDTH_PX = 450;   // never larger than this
const PIVOT_SECONDS = 3.5 * 60;   // a 3-min track sits halfway between min & max
const CURVE_STEEPNESS = 0.012; // lower = flatter, higher = steeper

const getItemWidthPixels = (item: MediaPlayerTrack): number | undefined => {
    const trackType = getItemType(item);
    if (trackType === "divider") {
        return undefined; // handled by CSS
    }

    // songs have a minimum width, and grow in a non-linear way based on their theoretical duration.
    // the idea is that songs have width based on their duration, but cannot easily grow to be huge. For normal song lengths, the widths are reasonable.
    const seconds = getTheoreticalDurationSeconds(item);
    const span = MAX_WIDTH_PX - MIN_WIDTH_PX;
    const growth = 1 + Math.exp(-CURVE_STEEPNESS * (seconds - PIVOT_SECONDS));
    const width = MIN_WIDTH_PX + span / growth;
    return width;
};


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
};

const VisBarSegment = ({ item, isCurrentTrack, audioAPI, mediaPlayer }: VisBarSegmentProps) => {
    const [hoverPosition, setHoverPosition] = React.useState<number | null>(null);
    const [hoverTime, setHoverTime] = React.useState<number | null>(null);

    const width = getItemWidthPixels(item);

    const trackType = getItemType(item);
    const styleData = getItemStyleData(item, false, mediaPlayer);
    const title = mediaPlayer.getTrackTitle(item);

    const isInteractable = item.file || item.url;

    // todo is this redundant with mediaPlayer.lengthSeconds?
    // let audioDurationSeconds: number | undefined;
    // if (isCurrentTrack) {
    //     audioDurationSeconds = mediaPlayer.lengthSeconds;
    // }

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
        } else {
            // Switch to this track
            //mediaPlayer.playTrackOfPlaylist(item.playlistIndex);
        }
    };

    const handleClickContainer = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isInteractable) return;

        if (isCurrentTrack) {
            return;
        } else {
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
            //flex: proportionalWidth,
            width: width === undefined ? undefined : `${width}px`,
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
            onClick={handleClickColoredBar}
            onMouseMove={isCurrentTrack ? handleMouseMove : undefined}
            onMouseLeave={isCurrentTrack ? handleMouseLeave : undefined}
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
        <div
            className={`setlistVisualizationBar`}
        >
            {beginWithDummyDivider && <div className="songPartition dummyDivider"></div>}
            {
                items.map((track, index) => <VisBarSegment
                    key={index}
                    item={track}
                    isCurrentTrack={currentIndex === index + startIndex}
                    audioAPI={audioAPI}
                    mediaPlayer={mediaPlayer}
                />)
            }
        </div>
    );
};

type ExpandStyle = "expanded" | "normal" | "collapsed";

export const SetlistVisualizationBars: React.FC<{
    mediaPlayer: MediaPlayerContextType;
    audioAPI: CustomAudioPlayerAPI | null;
}> = ({ mediaPlayer, audioAPI }) => {
    const { playlist } = mediaPlayer;
    //const [expanded, setExpanded] = React.useState(false);
    const [expanded, setExpanded] = useLocalStorageState<ExpandStyle>({
        key: "setlistVisualizationBarExpanded",
        initialValue: "normal",
        deserialize: (value: any) => {
            if (value === "expanded" || value === "normal" || value === "collapsed") {
                return value;
            }
            return "normal"; // default to normal if invalid
        }
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

    // if there are 3 or fewer rows, always expand.
    //const alwaysExpanded = rowBounds.length <= 3;

    return (
        <div
            className={`setlistVisualizationBarContainer ${expanded}`}
        >
            <div className="setlistVisualizationBarControls">
                <CMSmallButton tooltip={"Expand the playlist visualization to show the full playlist"} onClick={() => setExpanded("expanded")} className={`expand ${expanded === "expanded" ? "selected" : ""}`}>
                    Expand {gCharMap.UpArrow()}
                </CMSmallButton>
                <CMSmallButton tooltip={"Show just a portion of the playlist, to not take too much space."} onClick={() => setExpanded("normal")} className={`normal ${expanded === "normal" ? "selected" : ""}`}>
                    Normal
                </CMSmallButton>
                <CMSmallButton tooltip={"Hide the playlist visualization"} onClick={() => setExpanded("collapsed")} className={`collapse ${expanded === "collapsed" ? "selected" : ""}`}>
                    Collapse {gCharMap.DownArrow()}
                </CMSmallButton>
            </div>
            <div className="setlistVisualizationBarContainer BarsContainer">
                {
                    rowBounds.map((rowBound, rowIndex) => (
                        <SetlistVisualizationBar
                            key={rowIndex}
                            beginWithDummyDivider={needsFirstRowDummyDivider && rowIndex === 0}
                            mediaPlayer={mediaPlayer}
                            audioAPI={audioAPI}
                            startIndex={rowBound.startIndex}
                            length={rowBound.length}
                        />
                    ))
                }
            </div>
        </div>
    );
};
