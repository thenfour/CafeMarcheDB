import { useQuery } from "@blitzjs/rpc";
import { Button, ButtonGroup, DialogContent, DialogTitle, Divider, FormControlLabel, Menu, MenuItem, Switch, Tooltip } from "@mui/material";
import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { QuickSearchItemType, QuickSearchItemTypeSets } from "shared/quickFilter";
import { formatSongLength } from "shared/time";
import { getHashedColor } from "shared/utils";
import { CMChip } from "src/core/components/CMChip";
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import { CMSmallButton, DialogActionsCM, DotMenu, InspectObject, KeyValueTable, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { useConfirm } from "src/core/components/ConfirmationDialog";
import { getClipboardSongList, PortableSongList } from "src/core/components/EventSongListComponents";
import { Markdown } from "src/core/components/markdown/Markdown";
import * as SetlistAPI from "src/core/db3/shared/setlistApi";
import { Markdown3Editor } from "src/core/components/markdown/MarkdownControl3";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { SongAutocomplete } from "src/core/components/SongAutocomplete";
import { CMTab, CMTabPanel } from "src/core/components/TabPanel";
import { getURIForSong } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import getSongPinnedRecording from "src/core/db3/queries/getSongPinnedRecording";
import { SetlistPlan, SetlistPlanColumn } from "src/core/db3/shared/setlistPlanTypes";
import * as db3 from "../../db3/db3";
import * as DB3Client from "../../db3/DB3Client";
import { TSongPinnedRecording } from "../../db3/shared/apiTypes";
import { EventSongListDividerItem } from "../../db3/shared/setlistApi";
import { AssociationSelect, AssociationValueLink } from "../ItemAssociation";
import { MediaPlayerTrack } from "../mediaPlayer/MediaPlayerTypes";
import { SongPlayButton } from "../mediaPlayer/SongPlayButton";
import { useSongsContext } from "../song/SongsContext";
import { SongTagIndicatorContainer } from "../SongTagIndicatorContainer";
import { VisibilityControl } from "../VisibilityControl";
import { LerpColor, SetlistPlannerColorScheme } from "./SetlistPlanColorComponents";
import { SetlistPlanGroupSelect } from "./SetlistPlanGroupComponents";
import { SetlistPlannerLedArray, SetlistPlannerLedDefArray } from "./SetlistPlanLedComponents";
import { CalculateSetlistPlanCost, CalculateSetlistPlanStats, CalculateSetlistPlanStatsForCostCalc, SetlistPlanCostPenalties, SetlistPlanMutator, SetlistPlanStats } from "./SetlistPlanUtilities";
import { NumberField } from "./SetlistPlanUtilityComponents";
import { SetlistPlannerVisualizations } from "./SetlistPlanVisualization";
import { gGeneralPaletteList, gLightSwatchColors, gSwatchColors } from "../color/palette";
import { ColorPick } from "../color/ColorPick";
import { ReactiveInputDialog } from "../ReactiveInputDialog";

interface AddSongComponentProps {
    mutator: SetlistPlanMutator;
}

const AddSongComponent = (props: AddSongComponentProps) => {
    const snackbar = useSnackbar();
    return <div className="SetlistPlannerDocumentEditorAddSong">
        Add song...
        <SongAutocomplete
            value={null}
            onChange={(newSong) => {
                if (newSong) {
                    props.mutator.addSong(newSong.id);
                }
            }}
        />

        <ButtonGroup>
            <Button
                startIcon={gIconMap.Add()}
                onClick={() => {
                    props.mutator.addDivider();
                }}
            >
                Add Divider
            </Button>
            {/* <Button
                startIcon={gIconMap.ContentPaste()}
                onClick={async () => {
                    const songList = await getClipboardSongList();
                    if (!songList) {
                        snackbar.showError("Not a valid setlist in the clipboard");
                        return;
                    }
                    props.mutator.addPortableSongList(songList);
                }}
            >
                Paste json setlist
            </Button> */}
        </ButtonGroup>
    </div>;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
interface SetlistPlannerRowEditorProps {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    rowId: string;
    onDelete: () => void;
}

const SetlistPlannerRowEditor = (props: SetlistPlannerRowEditorProps) => {
    const allSongs = useSongsContext().songs;
    const row = props.doc.payload.rows.find((x) => x.rowId === props.rowId);

    if (!row) {
        return null;
    }

    const handleSongCommentChange = React.useCallback((newMarkdown: string) => {
        props.mutator.setRowComment(props.rowId, newMarkdown);
    }, [props.mutator, props.rowId]);

    const song = row.type === "song" ? allSongs.find((x) => x.id === row.songId) : null;

    return (
        <div className="SetlistPlannerDocumentEditorSong">
            {row.type === "song" && song && (
                <div>
                    <h3 className="name">{song.name}</h3>
                </div>
            )}

            <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
                <Button
                    onClick={() => {
                        props.mutator.deleteRow(row.rowId);
                        props.onDelete();
                    }}
                    startIcon={gIconMap.Delete()}
                >
                    Delete
                </Button>
                <div className="type">
                    <CMChip color={row.type === "divider" ? gSwatchColors.brown : gSwatchColors.blue}>
                        {row.type}
                    </CMChip>
                </div>
            </div>

            <div>
                <h4>Comment</h4>
                <Markdown3Editor
                    nominalHeight={100}
                    onChange={handleSongCommentChange}
                    initialValue={row.commentMarkdown || ""}
                    markdownPreviewLayout="tabbed"
                />
            </div>

            {row.type === "divider" && (
                <div style={{ marginTop: "20px" }}>
                    <FormControlLabel
                        label="This is a break, and resets the running time"
                        control={
                            <Switch
                                checked={row.isInterruption ?? true}
                                onChange={(e) => props.mutator.setRowIsInterruption(props.rowId, e.target.checked)}
                            />
                        }
                    />
                </div>
            )}
        </div>
    );
};


//////////////////////////////////////////////////////////////////////////////////////////////////
interface SetlistPlannerRowEditorDialogProps {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    rowId: string;
    open: boolean;
    onClose: () => void;
}

const SetlistPlannerRowEditorDialog = (props: SetlistPlannerRowEditorDialogProps) => {
    const allSongs = useSongsContext().songs;
    const row = props.doc.payload.rows.find((x) => x.rowId === props.rowId);

    if (!row) {
        return null;
    }

    const handleSongCommentChange = React.useCallback((newMarkdown: string) => {
        props.mutator.setRowComment(props.rowId, newMarkdown);
    }, [props.mutator, props.rowId]);

    const song = row.type === "song" ? allSongs.find((x) => x.id === row.songId) : null;

    return (
        <ReactiveInputDialog
            open={props.open}
            onCancel={props.onClose}
        >
            <DialogTitle>
                Edit {row.type === "song" ? "Song" : "Divider"}: {song?.name || ""}
            </DialogTitle>
            <DialogContent dividers>
                <SetlistPlannerRowEditor
                    doc={props.doc}
                    mutator={props.mutator}
                    rowId={props.rowId}
                    onDelete={props.onClose}
                />
                <DialogActionsCM>
                    <Button onClick={props.onClose}>Close</Button>
                </DialogActionsCM>
            </DialogContent>
        </ReactiveInputDialog>
    );
};



//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerMatrixRowProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    rowId: string;
    stats: SetlistPlanStats;
    colorScheme: SetlistPlannerColorScheme;
    allTagIds: number[];

    rowIndex: number;
    allPinnedRecordings: Record<number, TSongPinnedRecording>;
    thisTrack: MediaPlayerTrack;
    getPlaylist: () => MediaPlayerTrack[];

    lengthColumnMode: LengthColumnMode;
    toggleLengthColumnMode: () => void;
    rowItemWithRunningTime: SetlistAPI.EventSongListItem;
};

const SetlistPlannerMatrixSongRow = (props: SetlistPlannerMatrixRowProps) => {
    const allSongs = useSongsContext().songs;
    const [showEditDialog, setShowEditDialog] = React.useState(false);
    const [closeMenuProc, setCloseMenuProc] = React.useState<(() => void) | null>(null);
    let songStats = props.stats.songStats.find((x) => x.rowId === props.rowId);
    if (!songStats) {
        // in intermediate contexts this can happen; use an empty stat object
        return null;
    };

    // if balance is negative, use a gradient.
    // if balance is 0 or positive, use a solid green.
    let balanceColor = "transparent";
    if (songStats.balance != null && songStats.balance < 0) {
        balanceColor = LerpColor(songStats.balance, props.stats.minSongBalance, 0, props.colorScheme.songPointBalanceNegative);
    } else if (songStats.balance != null && songStats.balance >= 0) {
        balanceColor = LerpColor(songStats.balance, props.stats.maxSongBalance, 0, props.colorScheme.songPointBalancePositive);
    }

    const songRow = props.doc.payload.rows.find((x) => x.rowId === props.rowId)!;
    const song = allSongs.find((x) => x.id === songRow.songId!);
    if (!song) {
        // maybe you have lost access to the song, or it was deleted.
        return <div style={{ fontStyle: "italic", color: "#888" }}>song not found</div>
    }
    const songLengthFormatted = song.lengthSeconds === null ? null : formatSongLength(song.lengthSeconds);

    if (props.rowItemWithRunningTime.type !== "song") throw new Error("Expected song item in SetlistPlannerMatrixSongRow");
    const songItemWithRunningTime = props.rowItemWithRunningTime;

    // Duplicate detection
    const songOccurrences = props.doc.payload.rows.reduce((acc, row) => {
        return acc + (row.type === "song" && row.songId === song.id ? 1 : 0);
    }, 0);
    const isDupeWarning = songOccurrences > 1;

    return <div className="tr">

        <div className="td delete">
            <div className="freeButton" onClick={() => props.mutator.deleteRow(props.rowId)}>
                {gIconMap.Delete()}
            </div>
        </div>

        <div className="td songName" style={{ "--song-hash-color": getHashedColor(song.name), position: "relative" } as any}>

            <div className="dragHandle draggable" style={{ fontFamily: "monospace" }}>
                {/* #{(props.doc.payload.rows.findIndex((x) => x.rowId === props.rowId) + 1).toString().padStart(2, " ")} */}
                #{props.rowItemWithRunningTime ? (songItemWithRunningTime.index + 1).toString().padStart(2, " ") : "--"}
                ☰
            </div>

            <Tooltip title={`Amount of rehearsal points this song needs`} disableInteractive>
                <div className="numberCell" style={{ backgroundColor: LerpColor(songStats.requiredPoints, props.stats.minSongRequiredPoints, props.stats.maxSongRequiredPoints, props.colorScheme.songRequiredPoints) }}>
                    <NumberField
                        //key={`points-required-${props.rowId}`}
                        initialValue={songStats.requiredPoints || null}
                        onChange={(e, newValue) => { props.mutator.setRowPointsRequired(props.rowId, newValue || undefined) }}
                    />
                </div>
            </Tooltip>

            <div style={{ display: "flex", alignItems: "center" }}>
                <SetlistPlannerLedArray
                    direction="row"
                    ledDefs={props.doc.payload.rowLeds || []}
                    ledValues={songRow.leds || []}
                    onLedValueChanged={val => props.mutator.setRowLedValue(songRow.rowId, val.ledId, val)}
                    additionalAssociatedItems={[{
                        itemType: QuickSearchItemType.song,
                        id: song.id,
                        name: song.name,
                    }]}
                />

                <SongPlayButton
                    rowIndex={props.rowIndex}
                    track={props.thisTrack}
                    getPlaylist={props.getPlaylist}
                />

                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {isDupeWarning && <Tooltip title={`This song occurs ${songOccurrences} times in this plan. Is that right?`}><div className='warnIndicator'>!{songOccurrences}</div></Tooltip>}
                    <Tooltip disableInteractive title={songRow.commentMarkdown ? <Markdown markdown={songRow.commentMarkdown || null} /> : null}>
                        <a href={getURIForSong(song)} target="_blank" rel="noreferrer" style={{
                            //"--song-hash-color": getHashedColor(song.name),
                            color: `var(--song-hash-color)`,
                        } as any}>{song.name}</a>
                    </Tooltip>
                </div>
                <SongTagIndicatorContainer
                    tagIds={song.tags.map(tag => tag.tagId)}
                    allPossibleTags={props.allTagIds}
                />
            </div>
        </div>
        <div className={`td ${props.lengthColumnMode === "length" ? "songLength" : "runningLength"} interactable`} onClick={props.toggleLengthColumnMode}>
            {props.lengthColumnMode === "length"
                ? songLengthFormatted
                : (props.rowItemWithRunningTime?.runningTimeSeconds
                    ? <>{formatSongLength(props.rowItemWithRunningTime.runningTimeSeconds)}{props.rowItemWithRunningTime.songsWithUnknownLength ? <>+</> : <>&nbsp;</>}</>
                    : null
                )
            }
        </div>
        {
            props.doc.payload.columns.map((segment, index) => {
                // if no measureUsage, use transparent color
                // otherwise 
                const cell = props.doc.payload.cells.find((x) => x.columnId === segment.columnId && x.rowId === props.rowId);
                const pointsAllocated = cell?.pointsAllocated;
                const hasPointsAllocated = pointsAllocated !== undefined;
                let grad = props.colorScheme.songSegmentPoints;
                const style: any = {
                };

                if (segment.color) {
                    const col = gGeneralPaletteList.findEntry(segment.color);
                    if (col) {
                        grad = [
                            col.strong.foregroundColor,
                            col.strong.backgroundColor,
                        ];

                        if (!hasPointsAllocated) {
                            style["--fc"] = LerpColor(0.12, 0, 1, ["#ffffff", col.strong.backgroundColor]);
                            style["--bc"] = LerpColor(0.25, 0, 1, ["#ffffff", col.strong.foregroundColor]);
                        }
                    }
                }

                let bgColor = hasPointsAllocated ? LerpColor(
                    pointsAllocated,
                    props.stats.minCellAllocatedPoints,
                    props.stats.maxCellAllocatedPoints,
                    grad
                ) : "white";

                style["backgroundColor"] = bgColor;
                return <div key={index} className={`td segment numberCell pointAllocationCell ${cell?.autoFilled ? "autoFilled" : "notAutoFilled"} ${hasPointsAllocated ? "" : "hatch"}`} style={style}>
                    <NumberField
                        //key={`cell-${props.rowId}-${segment.columnId}`}
                        initialValue={hasPointsAllocated ? pointsAllocated : null}
                        onChange={(e, newValue) => {
                            props.mutator.setManualCellPoints(props.rowId, segment.columnId, newValue == null ? undefined : newValue);
                        }}
                    />
                </div>;
            })
        }
        <Tooltip title={`Total points this song will be rehearsed`} disableInteractive>
            <div className="td rehearsalTime numberCell" style={{ backgroundColor: LerpColor(songStats.totalPointsAllocated, props.stats.minSongTotalPoints, props.stats.maxSongTotalPoints, props.colorScheme.songTotalPoints) }}>
                <NumberField inert value={songStats.totalPointsAllocated} />
            </div>
        </Tooltip>
        <Tooltip title={`Rehearsal points remaining to finish rehearsing this song. ${(songStats.balance || 0) >= 0 ? `You have allocated enough time to rehearse this song` : `You need to allocate ${-(songStats.balance || 0)} more points to finish rehearsing ${song.name}`}`} disableInteractive>
            <div className={`td balance numberCell`} style={{ backgroundColor: balanceColor }}>
                <NumberField inert value={songStats.balance || null} showPositiveSign />
            </div>
        </Tooltip>
        <div className="td dotMenu">
            <DotMenu setCloseMenuProc={(newProc) => setCloseMenuProc(() => newProc)}>
                <MenuItem onClick={() => {
                    setShowEditDialog(true);
                    closeMenuProc?.();
                }}>
                    Edit
                </MenuItem>
            </DotMenu>
        </div>
        {showEditDialog && (
            <SetlistPlannerRowEditorDialog
                doc={props.doc}
                mutator={props.mutator}
                rowId={props.rowId}
                open={showEditDialog}
                onClose={() => setShowEditDialog(false)}
            />
        )}
    </div >;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerDividerRowProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    rowId: string;
    stats: SetlistPlanStats;
    rowItemWithRunningTime?: SetlistAPI.EventSongListItem;
};

const SetlistPlannerDividerRow = (props: SetlistPlannerDividerRowProps) => {
    const [showEditDialog, setShowEditDialog] = React.useState(false);
    const [closeMenuProc, setCloseMenuProc] = React.useState<(() => void) | null>(null);
    const row = props.doc.payload.rows.find((x) => x.rowId === props.rowId)!;

    return <div className={`tr divider ${row.isInterruption ? "interruption" : " noInterruption"}`}>
        <div className="td delete">
            <div className="freeButton" onClick={() => props.mutator.deleteRow(props.rowId)}>
                {gIconMap.Delete()}
            </div>
        </div>
        <div className="td songName">
            <div className="dragHandle draggable" style={{ fontFamily: "monospace" }} dangerouslySetInnerHTML={{ __html: "&nbsp;&nbsp;&nbsp;☰" }}>
            </div>

            <div className="numberCell">
                <NumberField
                    style={{ visibility: "hidden" }}
                    value={0}
                    onChange={(e, newValue) => { props.mutator.setRowPointsRequired(props.rowId, newValue || undefined) }}
                />
            </div>

            <div style={{ display: "flex", alignItems: "center" }} className="textContent">
                <SetlistPlannerLedArray
                    direction="row"
                    ledDefs={props.doc.payload.rowLeds || []}
                    ledValues={row.leds || []}
                    onLedValueChanged={val => props.mutator.setRowLedValue(row.rowId, val.ledId, val)}
                    additionalAssociatedItems={[]}
                />
                <Markdown compact markdown={row.commentMarkdown || ""} />
            </div>
        </div>
        <div className="td play"></div>
        <div className="td songLength"></div>
        {/* Add empty cells for each segment column */}
        {props.doc.payload.columns.map((segment, index) => (
            <div key={index} className="td segment"></div>
        ))}
        <div className="td rehearsalTime"></div>
        <div className="td balance"></div>
        <div className="td dotMenu">
            <DotMenu setCloseMenuProc={(newProc) => setCloseMenuProc(() => newProc)}>
                <MenuItem onClick={() => {
                    closeMenuProc?.();
                    setShowEditDialog(true);
                }}>
                    Edit
                </MenuItem>
                <MenuItem onClick={() => {
                    props.mutator.setRowIsInterruption(props.rowId, !(row.isInterruption ?? true));
                    //closeMenuProc?.();
                }}>
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={row.isInterruption ?? true}
                                readOnly
                            />
                        }
                        label="Break; reset running time"
                    />
                </MenuItem>
            </DotMenu>
        </div>
        {showEditDialog && (
            <SetlistPlannerRowEditorDialog
                doc={props.doc}
                mutator={props.mutator}
                rowId={props.rowId}
                open={showEditDialog}
                onClose={() => setShowEditDialog(false)}
            />
        )}
    </div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
type ColumnHeaderDropdownMenuProps = {
    columnId: string;
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
};

const ColumnHeaderDropdownMenu = (props: ColumnHeaderDropdownMenuProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const column = props.doc.payload.columns.find((x) => x.columnId === props.columnId)!;
    const allSongs = useSongsContext().songs;
    const snackbar = useSnackbar();

    const handleClearAllocation = async () => {
        await snackbar.invokeAsync(async () => {
            props.mutator.clearColumnAllocation(column.columnId);
            setAnchorEl(null);
        }, `Cleared allocation for ${column.name}`);
    };

    const handleSwapAllocationWith = async (otherColumnId: string) => {
        await snackbar.invokeAsync(async () => {
            props.mutator.swapColumnAllocation(column.columnId, otherColumnId);
            setAnchorEl(null);
        }, `Swapped allocation with ${props.doc.payload.columns.find((x) => x.columnId === otherColumnId)!.name}`);
    };

    const columnToSetlist = (column: SetlistPlanColumn): PortableSongList => {
        // ignores dividers, and picks only songs for which cells have allocated points.
        const cellsThisColumn = props.doc.payload.cells.filter((x) => x.columnId === column.columnId);
        const filteredCells = cellsThisColumn.filter((x) => !!x.pointsAllocated);
        const cellRowIds = filteredCells.map((x) => x.rowId);
        const songIds = props.doc.payload.rows.filter((x) => x.type === "song" && cellRowIds.includes(x.rowId)).map(row => row.songId);
        const songs = allSongs.filter((x) => songIds.includes(x.id));
        return songs.map((s, index) => ({
            sortOrder: index,
            comment: "",
            song: s,
            type: 'song',
        }));
    };

    const allSongsToSetlist = (): PortableSongList => {
        const songs = props.doc.payload.rows.filter((x) => x.type === "song").map(row => allSongs.find(s => s.id === row.songId)).filter(x => !!x) as any;
        return songs.map((s, index) => ({
            sortOrder: index,
            comment: "",
            song: s,
            type: 'song',
        }));
    };

    const handleCopySongNames = async () => {
        const setlist = columnToSetlist(column);
        await snackbar.invokeAsync(async () => {
            await navigator.clipboard.writeText(setlist.filter(x => x.type === "song").map(x => x.song.name).join("\n"));
            setAnchorEl(null);
        }, "Copied song names to clipboard");
    };

    const handleCopyAsSetlist = async () => {
        await snackbar.invokeAsync(async () => {
            const setlist = columnToSetlist(column);
            await navigator.clipboard.writeText(JSON.stringify(setlist, null, 2));
            setAnchorEl(null);
        }, `Copied ${column.name} as setlist`);
    };

    const handleCopyAllSongNames = async () => {
        const setlist = allSongsToSetlist();
        await snackbar.invokeAsync(async () => {
            await navigator.clipboard.writeText(setlist.filter(x => x.type === "song").map(x => x.song.name).join("\n"));
            setAnchorEl(null);
        }, "Copied song names to clipboard");
    };

    const handleCopyAllAsSetlist = async () => {
        await snackbar.invokeAsync(async () => {
            const setlist = allSongsToSetlist();
            await navigator.clipboard.writeText(JSON.stringify(setlist, null, 2));
            setAnchorEl(null);
        }, `Copied ${column.name} as setlist`);
    };

    return <>
        <CMSmallButton className='DotMenu' onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}>{gCharMap.VerticalEllipses()}</CMSmallButton>
        <Menu
            id="menu-setlistplannercolumn"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
        >
            {column.associatedItem && <MenuItem>
                <AssociationValueLink value={{ ...column.associatedItem, matchingField: undefined, matchStrength: 0 }} />
            </MenuItem>}

            <MenuItem onClick={handleCopySongNames}>
                <div>
                    <div>Copy allocated song names</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Copy names of songs with rehearsal points in this column
                    </div>
                </div>
            </MenuItem>

            <MenuItem onClick={handleCopyAsSetlist}>
                <div>
                    <div>Copy allocated songs as setlist</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Copy as JSON setlist format for external use
                    </div>
                </div>
            </MenuItem>

            <Divider />

            <MenuItem onClick={handleCopyAllSongNames}>
                <div>
                    <div>Copy all song names</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Copy names of all songs in the entire plan
                    </div>
                </div>
            </MenuItem>

            <MenuItem onClick={handleCopyAllAsSetlist}>
                <div>
                    <div>Copy all songs as setlist</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Copy entire plan as JSON setlist format
                    </div>
                </div>
            </MenuItem>

            <Divider />

            <MenuItem onClick={handleClearAllocation}>
                <div>
                    <div>Clear allocation for {column.name}</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Remove all rehearsal points from this column
                    </div>
                </div>
            </MenuItem>

            {
                props.doc.payload.columns.length > 1 && <>
                    <Divider />
                    {
                        props.doc.payload.columns.filter(c => c.columnId != props.columnId).map((c, index) => (
                            <MenuItem key={index} onClick={() => handleSwapAllocationWith(c.columnId)}>
                                <div>
                                    <div>Swap allocation with {c.name}</div>
                                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                                        Exchange rehearsal points between columns
                                    </div>
                                </div>
                            </MenuItem>
                        ))
                    }
                </>}
        </Menu >
    </>;
};



//////////////////////////////////////////////////////////////////////////////////////////////////
type LengthColumnMode = "length" | "runningTime";

type SetlistPlannerMatrixProps = {
    doc: SetlistPlan;
    tempDoc: SetlistPlan | undefined;
    mutator: SetlistPlanMutator;
    stats: SetlistPlanStats;
    colorScheme: SetlistPlannerColorScheme;
    costCalcConfig: SetlistPlanCostPenalties;
};

const SetlistPlannerMatrix = (props: SetlistPlannerMatrixProps) => {
    const allSongs = useSongsContext().songs;
    const [showCostBreakdown, setShowCostBreakdown] = React.useState(false);
    const [lengthColumnMode, setLengthColumnMode] = React.useState<LengthColumnMode>("length");

    const docOrTempDoc = props.tempDoc || props.doc;
    //const isTempDoc = !!props.tempDoc;

    const toggleLengthColumnMode = () => {
        setLengthColumnMode(prev => prev === "length" ? "runningTime" : "length");
    };

    // Convert setlist plan data to LocalSongListPayload format so we can use SetlistAPI.GetRowItems
    const convertToLocalSongListPayload = React.useMemo(() => {
        try {
            const songList = {
                songs: docOrTempDoc.payload.rows
                    .filter(row => row.type === 'song' && row.songId)
                    .map((row) => {
                        const song = allSongs.find(s => s.id === row.songId);
                        if (!song) return null;
                        return {
                            eventSongListId: 0, // not used for running time calculation
                            id: docOrTempDoc.payload.rows.indexOf(row), // cannot use index; that's only divider index.
                            sortOrder: docOrTempDoc.payload.rows.indexOf(row), // cannot use index; that's only divider index.
                            subtitle: row.commentMarkdown || "",
                            songId: song.id,
                            song: {
                                id: song.id,
                                name: song.name,
                                lengthSeconds: song.lengthSeconds,
                                startBPM: song.startBPM,
                                endBPM: song.endBPM,
                                tags: song.tags,
                                pinnedRecordingId: song.pinnedRecordingId,
                            }
                        };
                    })
                    .filter(Boolean) as any[],
                dividers: docOrTempDoc.payload.rows
                    .filter(row => row.type === 'divider')
                    .map((row, index) => ({
                        id: docOrTempDoc.payload.rows.indexOf(row), // cannot use index; that's only divider index.
                        eventSongListId: 0, // not used for running time calculation
                        isInterruption: row.isInterruption ?? true, // defaults to true for dividers
                        subtitleIfSong: null,
                        isSong: false,
                        lengthSeconds: null,
                        textStyle: db3.EventSongListDividerTextStyle.Default,
                        subtitle: row.commentMarkdown || "",
                        color: row.color || null,
                        sortOrder: docOrTempDoc.payload.rows.indexOf(row), // cannot use index; that's only divider index.
                    }))
            };
            return songList;
        } catch (error) {
            console.error('Error converting setlist plan to LocalSongListPayload:', error);
            return { songs: [], dividers: [] };
        }
    }, [docOrTempDoc.payload.rows, allSongs]);

    // Calculate running times using the setlist API
    const rowItemsWithRunningTimes = React.useMemo(() => {
        try {
            const r = SetlistAPI.GetRowItems(convertToLocalSongListPayload);
            //console.log(`calculated portable song list from,to`, docOrTempDoc.payload.rows, convertToLocalSongListPayload, r);
            return r;
        } catch (error) {
            console.error('Error calculating running times:', error);
            return [];
        }
    }, [convertToLocalSongListPayload]);

    // Collect all song IDs from the planner for pinned recording query
    const songIds = React.useMemo(() => {
        return docOrTempDoc.payload.rows
            .filter(row => row.type === 'song' && row.songId)
            .map(row => row.songId!);
    }, [docOrTempDoc.payload.rows]);

    // Fetch all pinned recordings for songs in this planner
    const [pinnedRecordings] = useQuery(getSongPinnedRecording, {
        songIds: songIds,
    }, {
        enabled: songIds.length > 0
    });

    const rowToPlaylistTrack = (row: SetlistPlan['payload']['rows'][number], rowIndex: number): MediaPlayerTrack => {
        if (row.type === "divider") {
            return {
                setlistPlanId: docOrTempDoc.id,
                playlistIndex: rowIndex,
                setListItemContext: {
                    type: "divider",
                    id: -1,
                    eventSongListId: -1, // unused
                    subtitle: "",
                    isInterruption: true,
                    isSong: false,
                    subtitleIfSong: "",
                    lengthSeconds: 0,
                    textStyle: null,
                    color: null,
                    sortOrder: 0,
                    runningTimeSeconds: 0,
                    songsWithUnknownLength: 0,
                } satisfies EventSongListDividerItem,
            } satisfies MediaPlayerTrack;
        }
        const song = allSongs.find(s => s.id === row.songId);
        const pinnedRecording = (row.songId && pinnedRecordings) ? pinnedRecordings[row.songId] : undefined;
        return {
            setlistPlanId: docOrTempDoc.id,
            playlistIndex: rowIndex,
            file: pinnedRecording,
            songContext: song,
        } satisfies MediaPlayerTrack;
    };

    // Store current dependencies in a ref so the playlist function always returns current data
    const playlistDataRef = React.useRef({
        docOrTempDoc,
        rowToPlaylistTrack
    });
    playlistDataRef.current = {
        docOrTempDoc,
        rowToPlaylistTrack
    };

    // Use a stable function reference that always reads current data
    const getPlaylist: (() => MediaPlayerTrack[]) = React.useCallback(() => {
        return playlistDataRef.current.docOrTempDoc.payload.rows
            .map((row, rowIndex) => playlistDataRef.current.rowToPlaylistTrack(row, rowIndex));
    }, []); // Empty dependency array - this function never changes

    // Collect all unique tag IDs from all songs in the plan
    const allTagIds = React.useMemo(() => {
        const tagIds = new Set<number>();
        docOrTempDoc.payload.rows.forEach(row => {
            if (row.type === 'song' && row.songId) {
                const song = allSongs.find(s => s.id === row.songId);
                if (song) {
                    song.tags.forEach(tag => tagIds.add(tag.tagId));
                }
            }
        });
        return Array.from(tagIds);
    }, [docOrTempDoc.payload.rows, allSongs]);

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        if (args.addedIndex === args.removedIndex) return; // no change
        props.mutator.reorderRows(args);
    };

    const stats = CalculateSetlistPlanStatsForCostCalc(docOrTempDoc);
    const costResult = CalculateSetlistPlanCost({
        plan: docOrTempDoc,
        stats,
    }, props.costCalcConfig);
    const costResultBreakdown = costResult.breakdown
        .sort((a, b) => b.cost - a.cost)
        .map((x) => ({ ...x, cost: x.cost.toFixed(2) }));

    return <div className="SetlistPlannerMatrix">
        <div className="tr header">
            <div className="td delete"></div>
            <div className="td songName"></div>
            <div className="td play"></div>
            <div className={`td ${lengthColumnMode === "length" ? "songLength" : "runningLength"} interactable`} onClick={toggleLengthColumnMode}>
                {lengthColumnMode === "length" ? "Len" : "∑T"}
            </div>
            {docOrTempDoc.payload.columns.map((segment, index) => <div key={index} className="td segment">
                <div style={{ display: "flex" }}>
                    <Tooltip
                        disableInteractive
                        title={<div>
                            <div>{segment.name}</div>
                            {segment.associatedItem && <AssociationValueLink value={{ ...segment.associatedItem, matchingField: undefined, matchStrength: 0 }} />}
                        </div>}
                    >
                        <div>{segment.name}</div>
                    </Tooltip>
                    <div><ColumnHeaderDropdownMenu columnId={segment.columnId} doc={docOrTempDoc} mutator={props.mutator} /></div>
                </div>
                <div>
                    <SetlistPlannerLedArray
                        direction="column"
                        ledDefs={props.doc.payload.columnLeds || []}
                        ledValues={segment.leds || []}
                        onLedValueChanged={val => props.mutator.setColumnLedValue(segment.columnId, val.ledId, val)}
                        additionalAssociatedItems={segment.associatedItem ? [segment.associatedItem] : []}
                    />
                </div>
                <div className="numberCell" style={{ backgroundColor: LerpColor(segment.pointsAvailable, props.stats.minSegmentPointsAvailable, props.stats.maxSegmentPointsAvailable, props.colorScheme.segmentPointsAvailable) }}>
                    <NumberField
                        //key={`segment-avail-${segment.columnId}`}
                        initialValue={segment.pointsAvailable || null}
                        onChange={(e, newValue) => {
                            props.mutator.setColumnAvailablePoints(segment.columnId, newValue || undefined);
                        }}
                    />
                </div>
            </div>)}
            <div className="td rehearsalTime">total</div>
            <div className="td balance">bal</div>
            <div className="td dotMenu"></div>
        </div>
        <div className="matrix">
            <ReactSmoothDndContainer
                dragHandleSelector=".dragHandle"
                lockAxis="y"
                onDrop={onDrop}
            >
                {docOrTempDoc.payload.rows.map((song, index) => <ReactSmoothDndDraggable key={index}>
                    {song.type === "divider" ? <SetlistPlannerDividerRow
                        mutator={props.mutator}
                        stats={props.stats}
                        key={index}
                        doc={docOrTempDoc}
                        rowId={song.rowId}
                    /> :
                        <SetlistPlannerMatrixSongRow
                            mutator={props.mutator}
                            stats={props.stats}
                            key={index}
                            doc={docOrTempDoc}
                            colorScheme={props.colorScheme}
                            rowId={song.rowId}
                            allTagIds={allTagIds}

                            rowIndex={index}
                            allPinnedRecordings={pinnedRecordings || {}}
                            thisTrack={rowToPlaylistTrack(song, index)}
                            getPlaylist={getPlaylist}

                            lengthColumnMode={lengthColumnMode}
                            toggleLengthColumnMode={toggleLengthColumnMode}
                            rowItemWithRunningTime={rowItemsWithRunningTimes[index]!}
                        />
                    }
                </ReactSmoothDndDraggable>
                )}
            </ReactSmoothDndContainer>
        </div>

        <div className="footerContainer">
            <div className="tr footer">
                <div className="td delete"></div>
                {/* <Tooltip disableInteractive title={`Total required rehearsal points for all songs`}> */}
                <div className="td songName numberCell">
                    {/* <NumberField inert value={props.stats.totalPointsRequired} style={{ backgroundColor: gColors.songRequiredPoints[1] }} /> */}
                </div>
                <div className="td play"></div>
                <Tooltip
                    disableInteractive
                    title={lengthColumnMode === "length" ? `Total song length for all songs` : `Total running time for setlist`}
                >
                    <div className={`td ${lengthColumnMode === "length" ? "songLength" : "runningLength"} interactable`} onClick={toggleLengthColumnMode}>
                        {lengthColumnMode === "length"
                            ? formatSongLength(props.stats.totalSongLengthSeconds)
                            : (rowItemsWithRunningTimes.length > 0 && rowItemsWithRunningTimes[rowItemsWithRunningTimes.length - 1]?.runningTimeSeconds != null
                                ? formatSongLength(rowItemsWithRunningTimes[rowItemsWithRunningTimes.length - 1]!.runningTimeSeconds!)
                                : formatSongLength(props.stats.totalSongLengthSeconds)
                            )
                        }
                    </div>
                </Tooltip>
                {/* </Tooltip> */}
                {//docOrTempDoc.payload.columns.map((segment, index) => {
                    props.stats.segmentStats.map((segStat, index) => {
                        const bgColor = LerpColor(segStat.totalPointsAllocated, props.stats.minSegPointsUsed, props.stats.maxSegPointsUsed, props.colorScheme.segmentPoints);
                        return <Tooltip key={index} disableInteractive title={`Total rehearsal points you've allocated for ${segStat.segment.name}`}>
                            <div key={index} className="td segment numberCell" style={{ backgroundColor: bgColor }}>
                                <NumberField inert value={segStat.totalPointsAllocated} />
                            </div>
                        </Tooltip>;
                    })}
                <Tooltip
                    disableInteractive
                    title={`total rehearsal points allocated for the whole plan`}
                >
                    <div className="td rehearsalTime numberCell" style={{ backgroundColor: props.colorScheme.songTotalPoints[1] }}>
                        <NumberField inert value={props.stats.totalPointsAllocated} />
                    </div>
                </Tooltip>
                <Tooltip
                    disableInteractive
                    title={`total song balance for the whole plan. ${props.stats.totalPlanSongBalance >= 0 ? `you have allocated enough to rehearse all songs fully` : `you need to allocate ${Math.abs(props.stats.totalPlanSongBalance)} more points to rehearse all songs`}`}
                >
                    <div className="td balance numberCell totalPlanBalance" style={{ backgroundColor: props.stats.totalPlanSongBalance >= 0 ? props.colorScheme.totalSongBalancePositive : props.colorScheme.totalSongBalanceNegative }}>
                        <NumberField inert value={props.stats.totalPlanSongBalance} showPositiveSign />
                    </div>
                </Tooltip>
            </div>

            <div className="tr footer">
                <div className="td delete"></div>
                <div className="td songName"></div>
                <div className="td songLength">
                </div>
                {//docOrTempDoc.payload.columns.map((segment, index) => {
                    props.stats.segmentStats.map((segStat, index) => {
                        const balanceColor = (segStat.balance || 0) <= 0 ?
                            LerpColor(segStat.balance, 0, props.stats.maxSegmentBalance, props.colorScheme.segmentBalancePositive)
                            : LerpColor(segStat.balance, props.stats.minSegmentBalance, 0, props.colorScheme.segmentBalanceNegative);
                        return <Tooltip
                            key={index}
                            disableInteractive
                            title={`Rehearsal points left unallocated ${segStat.segment.name}`}
                        >
                            <div key={index} className="td segment numberCell" style={{ backgroundColor: balanceColor }}>
                                <NumberField inert value={segStat.balance || null} showPositiveSign />
                            </div>
                        </Tooltip>;
                    })}
                <Tooltip
                    disableInteractive
                    title={
                        <div>
                            <div>total rehearsal point balance for the whole plan</div>
                            <div>{props.stats.totalPlanSegmentBalance >= 0 ? `you have ${props.stats.totalPlanSegmentBalance} points left to allocate` : `you have over-allocated by ${-props.stats.totalPlanSegmentBalance} points.`}</div>
                        </div>}
                >
                    <div className="td rehearsalTime" style={{ backgroundColor: props.stats.totalPlanSegmentBalance >= 0 ? props.colorScheme.segmentBalancePositive[1] : props.colorScheme.segmentBalanceNegative[0] }}>
                        <NumberField inert value={props.stats.totalPlanSegmentBalance} showPositiveSign />
                    </div>
                </Tooltip>
                <div className="td balance"></div>
                <div className="td dotMenu"></div>
            </div>

            <div className="tr footer">
                <div className="td delete"></div>
                <div className="td songName"></div>
                <div className="td songLength">
                </div>
                {//docOrTempDoc.payload.columns.map((segment, index) => {
                    props.stats.segmentStats.map((segStat, index) => {
                        const col = LerpColor(segStat.segmentAllocatedCells.length, 0, props.stats.maxSongsInSegment, props.colorScheme.songCountPerSegment);
                        return <Tooltip
                            key={index}
                            disableInteractive
                            title={`Songs to rehearse in ${segStat.segment.name}`}
                        >
                            <div key={index} className="td segment numberCell" style={{ backgroundColor: col }}>
                                <NumberField inert value={segStat.segmentAllocatedCells.length} />
                            </div>
                        </Tooltip>;
                    })}
                <Tooltip
                    disableInteractive
                    title={`total song-rehearsal things ${0}`}
                >
                    <div className="td rehearsalTime" style={{ backgroundColor: props.colorScheme.songCountPerSegment[1] }}>
                        <NumberField inert value={props.stats.totalSongSegmentCells} />
                    </div>
                </Tooltip>
                <div className="td balance"></div>
                <div className="td dotMenu"></div>
            </div>

        </div >

        <Markdown3Editor
            //beginInPreview={true}
            initialValue={docOrTempDoc.payload.notes || ""}
            markdownPreviewLayout="tabbed"
            onChange={(newMarkdown) => {
                props.mutator.setNotes(newMarkdown);
            }}
            nominalHeight={300}
        />

        <table style={{ fontFamily: "monospace" }} className="cost-table">
            <tbody>
                <tr>
                    <td className="interactable" onClick={() => {
                        setShowCostBreakdown(!showCostBreakdown);
                    }}>Cost</td>
                    <td>{costResult.totalCost.toFixed(2)}</td>
                    <td></td>
                </tr>
                {showCostBreakdown && <>
                    <tr>
                        <td>Iterations</td>
                        <td>{docOrTempDoc.payload.autoCompleteIterations?.toLocaleString()}</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>Max depth</td>
                        <td>{docOrTempDoc.payload.autoCompleteDepth?.toLocaleString()}</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>Duration</td>
                        <td>{docOrTempDoc.payload.autoCompleteDurationSeconds?.toFixed(3)} seconds</td>
                        <td></td>
                    </tr>

                    {costResultBreakdown.map((x, index) => (
                        <tr key={index}>
                            <td>{x.explanation}</td>
                            <td>{x.cost}</td>
                            <td>
                                <div>
                                    <span>{x.factor01.toFixed(2)}</span>
                                    {(x.beginRowIndex !== undefined) && <span> / {props.stats.songStats[x.beginRowIndex]?.song?.name}</span>}
                                    {(x.columnIndex !== undefined) && <span> / {props.stats.segmentStats[x.columnIndex]?.segment.name}</span>}
                                </div>
                            </td>
                        </tr>
                    ))}
                </>}
            </tbody>
        </table>

        <KeyValueTable
            data={{
                "required points to rehearse all songs": props.stats.totalPointsRequired,
                "rehearsal points in the pool": props.stats.totalPointsInThePool,
                "": (props.stats.totalPointsInThePool >= props.stats.totalPointsRequired ?
                    <CMChip color={gLightSwatchColors.light_green}>You have enough rehearsal points to rehearse all songs</CMChip> :
                    <CMChip color={gLightSwatchColors.light_orange}>You don't have enough rehearsal time to rehearse all songs ({props.stats.totalPointsRequired - props.stats.totalPointsInThePool} short)</CMChip>),
                "Song points you still need to allocate": props.stats.totalPlanSongBalance,
                //"total rehearsal points allocated": props.stats.totalPointsUsed,
                "Rehearsal points still available": props.stats.totalPlanSegmentBalance,
                "songs per rehearsal": props.stats.songsPerSegment.toFixed(2),
            }} />

        <AddSongComponent mutator={props.mutator} />
    </div >;
}




//////////////////////////////////////////////////////////////////////////////////////////////////
type MainDropdownMenuProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    onDelete: () => void;
};

const MainDropdownMenu = (props: MainDropdownMenuProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const allSongs = useSongsContext().songs;
    const snackbar = useSnackbar();
    const confirm = useConfirm();

    const handleCopyToClipboard = () => {
        void snackbar.invokeAsync(async () => {
            await navigator.clipboard.writeText(JSON.stringify(props.doc, null, 2));
            setAnchorEl(null);
        }, "Copied plan to clipboard");
    };
    const handlePasteFromClipboard = async () => {
        const text = await navigator.clipboard.readText()
        let newDoc: SetlistPlan;

        try {
            newDoc = JSON.parse(text) as SetlistPlan;
        } catch (e) {
            console.error(e)
            snackbar.showError("Failed to parse clipboard contents")
            return
        }

        // #632 the parsed object will only contain primitives; Date objects will be strings.
        if (newDoc.createdAt) newDoc.createdAt = new Date(newDoc.createdAt);

        if (await confirm({ title: "Paste from clipboard", description: "This will replace the current document. Are you sure?" })) {
            void snackbar.invokeAsync(async () => {
                props.mutator.setDoc(newDoc)
                setAnchorEl(null)
            }, "Pasted from clipboard")
        }
    }

    const handleAddSongsFromClipboardSetlist = async () => {
        // deserialize the clipboard setlist.
        const setlist = await getClipboardSongList();
        if (!setlist) {
            snackbar.showError("Clipboard does not contain a valid setlist");
            return;
        }
        // find songs that are in the setlist but not in the current plan document.
        const missingSongs = setlist
            .filter(row => row.type === "song")
            .map(x => x.song.id)
            .filter(x => !props.doc.payload.rows.some(s => s.songId === x))
            .map(songId => allSongs.find(s => s.id === songId));

        // add these songs to the plan.
        props.mutator.addAndRemoveSongs(missingSongs.map(x => x!.id), []);
        setAnchorEl(null);
        console.log(`Adding ${missingSongs.length} songs...`);
        console.log(missingSongs.map(x => x?.name));
        snackbar.showSuccess(`Added ${missingSongs.length} songs from clipboard setlist`);
    };

    const handleAppendSetlistFromClipboard = async () => {
        // deserialize the clipboard setlist.
        const setlist = await getClipboardSongList();
        if (!setlist) {
            snackbar.showError("Clipboard does not contain a valid setlist");
            return;
        }

        // append the entire setlist structure to the current plan
        props.mutator.addPortableSongList(setlist, { mode: 'append' });
        setAnchorEl(null);
        console.log(`Appending ${setlist.length} items from setlist...`);
        snackbar.showSuccess(`Appended ${setlist.length} items from clipboard setlist`);
    };

    const handleReplaceWithSetlistFromClipboard = async () => {
        // deserialize the clipboard setlist.
        const setlist = await getClipboardSongList();
        if (!setlist) {
            snackbar.showError("Clipboard does not contain a valid setlist");
            return;
        }

        if (await confirm({
            title: "Replace with clipboard setlist",
            description: "This will replace the entire current plan with the clipboard setlist. Are you sure?"
        })) {
            // use the new replace mode to replace the entire setlist structure
            props.mutator.addPortableSongList(setlist, { mode: 'replace' });

            setAnchorEl(null);
            console.log(`Replaced plan with ${setlist.length} items from setlist...`);
            snackbar.showSuccess(`Replaced plan with ${setlist.length} items from clipboard setlist`);
        }
    };

    const handleClearAllSongs = async () => {
        if (await confirm({
            title: "Clear all songs",
            description: "This will remove all songs and dividers from the plan. Are you sure?"
        })) {
            // use replace mode with an empty setlist to clear everything
            props.mutator.addPortableSongList([], { mode: 'replace' });

            setAnchorEl(null);
            console.log(`Cleared all songs from plan`);
            snackbar.showSuccess(`Cleared all songs from plan`);
        }
    };

    const handleSyncWithClipboardSetlist = async () => {
        // first gather lists of songs to be added & removed,
        // use confirm() to ask the user if they want to proceed,
        // then perform the operations and report the results to the console & snackbar.
        console.log(`handleSyncWithClipboardSetlist`);
        try {
            const setlist = await getClipboardSongList();
            if (!setlist) {
                snackbar.showError("Clipboard does not contain a valid setlist");
                return;
            }
            const existing = new Set<number>(
                props.doc.payload.rows
                    .filter((r) => r.type === "song")
                    .map((r) => r.songId!)
            );
            const incoming = new Set<number>(
                setlist
                    .filter((item) => item.type === "song")
                    .map((item) => item.song.id)
            );
            const toAdd = [...incoming].filter((id) => !existing.has(id));
            const toRemove = [...existing].filter((id) => !incoming.has(id));

            if (!toAdd.length && !toRemove.length) {
                snackbar.showSuccess("Already synced with the setlist. No changes.");
                setAnchorEl(null);
                return;
            }

            const toAddSongs = toAdd.map((id) => allSongs.find((s) => s.id === id)).filter(s => !!s);
            const toRemoveSongs = toRemove.map((id) => allSongs.find((s) => s.id === id)).filter(s => !!s);

            const toAddComponents = toAddSongs.map((song) => <CMChip key={song.id}>{song.name}</CMChip>);
            const toRemoveComponents = toRemoveSongs.map((song) => <CMChip key={song.id}>{song.name}</CMChip>);

            if (await confirm({
                title: "Sync with clipboard setlist", description: <div>
                    <div>{toAdd.length ? `Add: ${toAdd.length}` : null}</div>
                    <div>{toAddComponents}</div>
                    <div>{toRemove.length ? `Remove: ${toRemove.length}` : null}</div>
                    <div>{toRemoveComponents}</div>
                </div>
            })) {
                props.mutator.addAndRemoveSongs(toAdd, toRemove);
                //if (toRemove.length) props.mutator.removeSongs(toRemove);
                snackbar.showSuccess(`Synced: ${toAdd.length} added, ${toRemove.length} removed`);
                setAnchorEl(null);
            }
        } catch (error) {
            console.error("Error syncing with clipboard setlist:", error);
            snackbar.showError("Failed to sync with clipboard setlist. Check console for details.");
        }
    };

    const handleCopyPortableSetlist = async () => {
        try {

            // first filter out invalid rows

            const validRows = props.doc.payload.rows.filter((row) => {
                if (row.type !== 'song') return true;
                if (!row.songId) return false; // must have a songId
                const song = allSongs.find(s => s.id === row.songId);
                if (!song) return false; // must be a valid song
                return true; // valid song row
            });

            const portableSetlist: PortableSongList = validRows
                .map((row, index) => {
                    if (row.type === 'song' && row.songId) {
                        const song = allSongs.find(s => s.id === row.songId)!;
                        return {
                            type: 'song',
                            sortOrder: index,
                            song: song,
                            comment: row.commentMarkdown || "",
                        };
                    } else {
                        return {
                            type: 'divider',
                            sortOrder: index,
                            comment: row.commentMarkdown || "",
                            color: row.color || null,
                            isInterruption: row.isInterruption ?? true, // defaults to true for dividers
                            isSong: false,
                            subtitleIfSong: null,
                            lengthSeconds: null,
                            textStyle: null,
                        };
                    }
                });

            const txt = JSON.stringify(portableSetlist, null, 2);
            await navigator.clipboard.writeText(txt);
            snackbar.showSuccess(`Copied ${portableSetlist.length} items as portable setlist (${txt.length} chars)`);
            setAnchorEl(null);
        } catch (error) {
            console.error("Error copying portable setlist:", error);
            snackbar.showError("Failed to copy portable setlist. Check console for details.");
        }
    };

    return <>
        <CMSmallButton className='DotMenu' onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}>{gCharMap.VerticalEllipses()}</CMSmallButton>
        <Menu
            id="menu-setlistplannermain"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
        >
            <MenuItem onClick={() => {
                setAnchorEl(null);
                props.mutator.clearAllocation();
            }}>
                <div>
                    <div>clear</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Remove all rehearsal point allocations
                    </div>
                </div>
            </MenuItem>
            <MenuItem onClick={handleClearAllSongs}>
                <div>
                    <div>clear all songs</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Remove all songs and dividers from the plan
                    </div>
                </div>
            </MenuItem>
            <MenuItem onClick={() => {
                setAnchorEl(null);
                props.onDelete();
            }}>
                <div>
                    <div>delete this plan</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Permanently remove this setlist plan
                    </div>
                </div>
            </MenuItem>

            <Divider />
            <MenuItem
                onClick={handleCopyToClipboard}
            >
                <div>
                    <div>Copy plan to clipboard</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Copy entire plan as JSON for backup/sharing
                    </div>
                </div>
            </MenuItem>
            <MenuItem
                onClick={handleCopyPortableSetlist}
            >
                <div>
                    <div>Copy song list as portable setlist</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Copy just the songs and dividers as JSON setlist format
                    </div>
                </div>
            </MenuItem>
            <MenuItem
                onClick={handlePasteFromClipboard}
            >
                <div>
                    <div>Paste plan from clipboard</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Replace current plan with JSON from clipboard
                    </div>
                </div>
            </MenuItem>


            <Divider />
            <MenuItem onClick={handleAddSongsFromClipboardSetlist}>
                <div>
                    <div>Add missing songs from copied setlist</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Appends only songs from the clipboard setlist that are not already in the plan
                    </div>
                </div>
            </MenuItem>
            <MenuItem onClick={handleAppendSetlistFromClipboard}>
                <div>
                    <div>Append setlist from clipboard</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Appends entire setlist to end of plan
                    </div>
                </div>
            </MenuItem>
            <MenuItem onClick={handleReplaceWithSetlistFromClipboard}>
                <div>
                    <div>Replace plan with clipboard setlist</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Replace entire plan with clipboard setlist structure
                    </div>
                </div>
            </MenuItem>
            <MenuItem onClick={handleSyncWithClipboardSetlist}>
                <div>
                    <div>Sync (add & remove) songs with clipboard setlist</div>
                    <div style={{ fontSize: '0.75em', color: 'text.secondary', opacity: 0.7 }}>
                        Match plan exactly with copied setlist (confirms before making changes)
                    </div>
                </div>
            </MenuItem>
        </Menu >
    </>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerDocumentEditorProps = {
    isModified: boolean;
    canUndo: boolean;
    canRedo: boolean;
    initialValue: SetlistPlan;
    tempValue: SetlistPlan | undefined;
    costCalcConfig: SetlistPlanCostPenalties;
    mutator: SetlistPlanMutator;
    colorScheme: SetlistPlannerColorScheme;
    groupTableClient: DB3Client.xTableRenderClient<db3.SetlistPlanGroupPayload>
    onSave: (doc: SetlistPlan) => void;
    onCancel: () => void;
    onDelete: () => void;
};

type TTabId = "plan" | "segments" | "songs" | "matrix";

export const SetlistPlannerDocumentEditor = (props: SetlistPlannerDocumentEditorProps) => {
    const [doc, setDoc] = React.useState<SetlistPlan>(props.initialValue);
    const [selectedTab, setSelectedTab] = React.useState<TTabId>("matrix");
    const allSongs = useSongsContext().songs;
    //const snackbar = useSnackbar();
    //const confirm = useConfirm();

    const docOrTempDoc = props.tempValue || doc;
    const isTempDoc = !!props.tempValue;    // Track when docOrTempDoc changes
    const prevDoc = React.useRef(docOrTempDoc);

    // React.useEffect(() => {
    //     if (prevDoc.current !== docOrTempDoc) {
    //         console.log('📄 docOrTempDoc changed:', {
    //             prevId: prevDoc.current?.id,
    //             newId: docOrTempDoc?.id,
    //             prevName: prevDoc.current?.name,
    //             newName: docOrTempDoc?.name,
    //             same: prevDoc.current === docOrTempDoc,
    //             isTempDoc,
    //         });
    //         prevDoc.current = docOrTempDoc;
    //     }
    // });

    const [stats, setStats] = React.useState<SetlistPlanStats>(() => CalculateSetlistPlanStats(docOrTempDoc, allSongs));
    React.useEffect(() => {
        setDoc(props.initialValue);
    }, [props.initialValue]);

    React.useEffect(() => {
        setStats(CalculateSetlistPlanStats(docOrTempDoc, allSongs));
    }, [docOrTempDoc]);

    const onDropSegment = (args: ReactSmoothDnd.DropResult) => {
        if (args.addedIndex === args.removedIndex) return; // no change
        props.mutator.reorderColumns(args);
    };

    // Memoize the change handlers to prevent unnecessary re-renders
    const handleNameChange = React.useCallback((e: any, newName: string) => {
        props.mutator.setName(newName);
    }, [props.mutator, docOrTempDoc.name]);

    // const handleGroupChange = (e: any, newGroupId: number | null) => {
    //     props.mutator.setGroupId(newGroupId);
    // };

    const handleDescriptionChange = React.useCallback((newMarkdown: string) => {
        props.mutator.setDescription(newMarkdown);
    }, [props.mutator, docOrTempDoc.description]);    // Memoize segment change handlers

    const handleSegmentNameChange = React.useCallback((columnId: string) => (e: any, newName: string) => {
        props.mutator.setColumnName(columnId, newName);
    }, [props.mutator]);

    const handleSegmentPointsChange = React.useCallback((columnId: string) => (e: any, newTotal: number | null) => {
        props.mutator.setColumnAvailablePoints(columnId, newTotal || undefined);
    }, [props.mutator]);

    const handleSegmentCommentChange = React.useCallback((columnId: string) => (newMarkdown: string) => {
        props.mutator.setColumnComment(columnId, newMarkdown);
    }, [props.mutator]);

    const handleSongCommentChange = React.useCallback((rowId: string) => (newMarkdown: string) => {
        props.mutator.setRowComment(rowId, newMarkdown);
    }, [props.mutator]);

    return <div className="SetlistPlannerDocumentEditor">
        <div className="toolbar">
            <ButtonGroup>
                <Button
                    startIcon={gIconMap.Save()}
                    disabled={isTempDoc || !props.isModified}
                    onClick={() => {
                        props.onSave(doc);
                    }}
                >
                    Save
                </Button>
                <Button
                    disabled={isTempDoc}
                    startIcon={gIconMap.Cancel()} onClick={() => {
                        props.onCancel();
                    }}>Close</Button>

                <Button
                    onClick={() => {
                        props.mutator.undo();
                    }}
                    disabled={!props.canUndo}
                >Undo</Button>
                <Button
                    disabled={!props.canRedo}
                    onClick={() => {
                        props.mutator.redo();
                    }}
                >Redo</Button>
                <Divider />
                <MainDropdownMenu doc={doc} mutator={props.mutator} onDelete={props.onDelete} />
                <Divider />
                <Button
                    onClick={() => {
                        props.mutator.clearAllocation();
                    }}
                    disabled={isTempDoc}
                >clear</Button>
                <VisibilityControl
                    value={docOrTempDoc.visiblePermissionId}
                    onChange={(newValue) => {
                        props.mutator.setVisiblePermissionId(newValue?.id || null);
                    }}
                />
            </ButtonGroup>
            <InspectObject src={docOrTempDoc} label="doc" />
            <InspectObject src={stats} label="stats" />
            <div className="nameHeader">{docOrTempDoc.name}</div>
        </div>
        <CMTabPanel
            className="SetlistPlannerDocumentEditorTabPanel"
            handleTabChange={(x, newId) => setSelectedTab(newId as TTabId || "matrix")}
            selectedTabId={selectedTab}
        >
            <CMTab thisTabId="plan" summaryTitle={"plan"}>
                <NameValuePair name="Name" value={
                    <CMTextInputBase
                        className="name"
                        initialValue={docOrTempDoc.name}
                        onChange={handleNameChange}
                    />
                } />
                <NameValuePair name="Group" value={
                    <SetlistPlanGroupSelect
                        onChange={(group) => {
                            props.mutator.setGroupId(group?.id || null);
                        }}
                        selectedGroupId={docOrTempDoc.groupId || null}
                        tableClient={props.groupTableClient}
                    />
                } />
                <Markdown3Editor
                    onChange={handleDescriptionChange}
                    initialValue={docOrTempDoc.description}
                    nominalHeight={75}
                    markdownPreviewLayout="tabbed"
                //beginInPreview={true}
                />
            </CMTab>

            <CMTab thisTabId="segments" summaryTitle={"Columns"}>
                <div className="SetlistPlannerDocumentEditorSegments">
                    <ReactSmoothDndContainer
                        dragHandleSelector=".dragHandle"
                        lockAxis="y"
                        onDrop={onDropSegment}
                    >
                        {docOrTempDoc.payload.columns.map((segment) => {
                            return <ReactSmoothDndDraggable key={segment.columnId}>
                                <div key={segment.columnId} className="SetlistPlannerDocumentEditorSegment">
                                    <div className="dragHandle draggable">
                                        ☰
                                    </div>
                                    <NameValuePair name="Name" value={
                                        <CMTextInputBase
                                            //key={`segment-name-${segment.columnId}`}
                                            className="segmentName"
                                            initialValue={segment.name}
                                            onChange={handleSegmentNameChange(segment.columnId)}
                                        />
                                    } />
                                    <NameValuePair name="Points available" value={
                                        <NumberField
                                            //key={`segment-points-${segment.columnId}`}
                                            initialValue={segment.pointsAvailable || null}
                                            onChange={handleSegmentPointsChange(segment.columnId)} />
                                    } />
                                    <ColorPick
                                        value={segment.color || null}
                                        onChange={(newColor) => {
                                            props.mutator.setColumnColor(segment.columnId, newColor?.id || undefined);
                                        }}
                                        allowNull={true}
                                    />
                                    <Markdown3Editor
                                        //key={`segment-comment-${segment.columnId}`}
                                        onChange={handleSegmentCommentChange(segment.columnId)}
                                        initialValue={segment.commentMarkdown || ""}
                                        markdownPreviewLayout="tabbed"
                                        nominalHeight={75}
                                    />
                                    <AssociationSelect
                                        allowedItemTypes={QuickSearchItemTypeSets.Everything!}
                                        value={!segment.associatedItem ? null : { ...segment.associatedItem, matchStrength: 0, matchingField: undefined }}
                                        onChange={(newAssociation) => {
                                            props.mutator.setColumnAssociatedItem(segment.columnId, newAssociation);
                                        }}
                                    />

                                    <Button startIcon={gIconMap.Delete()} onClick={() => {
                                        props.mutator.deleteColumn(segment.columnId);
                                    }}
                                    ></Button>
                                </div>
                            </ReactSmoothDndDraggable>
                        })}
                    </ReactSmoothDndContainer>
                </div>

                <Button startIcon={gIconMap.Add()} onClick={() => {
                    props.mutator.addColumn();
                }}>Add Segment</Button>
            </CMTab>
            <CMTab thisTabId="columnLeds" summaryTitle={"Column Leds"}>
                <SetlistPlannerLedDefArray doc={doc} mutator={props.mutator} collection="column" />
            </CMTab>
            <CMTab thisTabId="songs" summaryTitle={"Songs"}>
                <div className="SetlistPlannerDocumentEditorSongs">
                    {docOrTempDoc.payload.rows.map((song) => {

                        return <SetlistPlannerRowEditor
                            key={song.rowId}
                            doc={doc}
                            mutator={props.mutator}
                            rowId={song.rowId}
                            onDelete={() => { }}
                        />;


                        // return <div key={song.rowId} className="SetlistPlannerDocumentEditorSong">
                        //     <div>
                        //         {song.type === "song" && <div>
                        //             <h3 className="name">{allSongs.find((x) => x.id === song.songId)?.name}</h3>
                        //         </div>}

                        //         <div style={{ display: "flex", alignItems: "center" }}>
                        //             <Button onClick={() => {
                        //                 props.mutator.deleteRow(song.rowId);
                        //             }}>{gIconMap.Delete()}</Button>
                        //             <div className="type"><CMChip color={song.type === "divider" ? gSwatchColors.brown : gSwatchColors.blue}>{song.type}</CMChip></div>
                        //         </div>
                        //     </div>
                        //     <Markdown3Editor
                        //         nominalHeight={50}
                        //         onChange={handleSongCommentChange(song.rowId)}
                        //         initialValue={song.commentMarkdown || ""}
                        //     />
                        // </div>
                    })}
                </div>

                <AddSongComponent mutator={props.mutator} />

            </CMTab>

            <CMTab thisTabId="songLeds" summaryTitle={"Song Leds"}>
                <SetlistPlannerLedDefArray doc={doc} mutator={props.mutator} collection="row" />
            </CMTab>

            <CMTab thisTabId="matrix" summaryTitle={"Matrix"}>
                <SetlistPlannerMatrix
                    stats={stats!}
                    tempDoc={props.tempValue}
                    //readonly={isTempDoc}
                    costCalcConfig={props.costCalcConfig}
                    colorScheme={props.colorScheme}
                    doc={doc}
                    mutator={props.mutator}
                />
            </CMTab>
            <CMTab thisTabId="graphs" summaryTitle={"Graphs"}>
                <SetlistPlannerVisualizations doc={doc} stats={stats} />
            </CMTab>
        </CMTabPanel>
    </div >
};
