import { Button, ButtonGroup, Divider, Menu, MenuItem, Tooltip } from "@mui/material";
import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { gGeneralPaletteList, gLightSwatchColors, gSwatchColors } from "shared/color";
import { QuickSearchItemType, QuickSearchItemTypeSets } from "shared/quickFilter";
import { formatSongLength } from "shared/time";
import { getHashedColor } from "shared/utils";
import { CMChip } from "src/core/components/CMChip";
import { InspectObject, ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import { CMSmallButton, KeyValueTable, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { useConfirm } from "src/core/components/ConfirmationDialog";
import { getClipboardSongList, PortableSongList } from "src/core/components/EventSongListComponents";
import { Markdown3Editor } from "src/core/components/markdown/MarkdownControl3";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { SongAutocomplete } from "src/core/components/SongAutocomplete";
import { useSongsContext } from "src/core/components/SongsContext";
import { CMTab, CMTabPanel } from "src/core/components/TabPanel";
import { getURIForSong } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import { SetlistPlan, SetlistPlanColumn } from "src/core/db3/shared/setlistPlanTypes";
import { ColorPick } from "../ColorPick";
import { AssociationSelect, AssociationValueLink } from "./ItemAssociation";
import { LerpColor, SetlistPlannerColorScheme } from "./SetlistPlanColorComponents";
import { SetlistPlannerLedArray, SetlistPlannerLedDefArray } from "./SetlistPlanLedComponents";
import { CalculateSetlistPlanCost, CalculateSetlistPlanStats, CalculateSetlistPlanStatsForCostCalc, SetlistPlanCostPenalties, SetlistPlanMutator, SetlistPlanStats } from "./SetlistPlanUtilities";
import { NumberField } from "./SetlistPlanUtilityComponents";
import { SetlistPlannerVisualizations } from "./SetlistPlanVisualization";




//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerMatrixRowProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    rowId: string;
    stats: SetlistPlanStats;
    colorScheme: SetlistPlannerColorScheme;
};

const SetlistPlannerMatrixSongRow = (props: SetlistPlannerMatrixRowProps) => {
    const allSongs = useSongsContext().songs;
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
    const song = allSongs.find((x) => x.id === songRow.songId!)!;
    const songLengthFormatted = song.lengthSeconds === null ? null : formatSongLength(song.lengthSeconds);

    return <div className="tr">
        <div className="td songName">

            <div className="dragHandle draggable" style={{ fontFamily: "monospace" }}>
                #{(props.doc.payload.rows.findIndex((x) => x.rowId === props.rowId) + 1).toString().padStart(2, " ")}
                ☰
            </div>

            <Tooltip title={`Amount of rehearsal points this song needs`} disableInteractive>
                <div className="numberCell" style={{ backgroundColor: LerpColor(songStats.requiredPoints, props.stats.minSongRequiredPoints, props.stats.maxSongRequiredPoints, props.colorScheme.songRequiredPoints) }}>
                    <NumberField
                        value={songStats.requiredPoints || null}
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
                <div>
                    <Tooltip disableInteractive title={songRow.commentMarkdown ? <Markdown markdown={songRow.commentMarkdown || null} /> : null}>
                        <a href={getURIForSong(song)} target="_blank" rel="noreferrer" style={{
                            "--song-hash-color": getHashedColor(song.name),
                            color: `var(--song-hash-color)`,
                        } as any}>{song.name}</a>
                    </Tooltip>
                </div>
            </div>
        </div>
        <div className="td songLength">
            {songLengthFormatted}
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
                        value={hasPointsAllocated ? pointsAllocated : null}
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
    </div >;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerDividerRowProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    rowId: string;
    stats: SetlistPlanStats;
};

const SetlistPlannerDividerRow = (props: SetlistPlannerDividerRowProps) => {

    const row = props.doc.payload.rows.find((x) => x.rowId === props.rowId)!;

    return <div className="tr divider">
        <div className="td songName">
            <div className="dragHandle draggable" style={{ fontFamily: "monospace" }}>
                #{(props.doc.payload.rows.findIndex((x) => x.rowId === props.rowId) + 1).toString().padStart(2, " ")}
                ☰
            </div>

            <div className="numberCell">
                <NumberField
                    style={{ visibility: "hidden" }}
                    value={0}
                    onChange={(e, newValue) => { props.mutator.setRowPointsRequired(props.rowId, newValue || undefined) }}
                />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
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
    </div>;
}


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

    const handleCopySongNames = async () => {
        await snackbar.invokeAsync(async () => {
            const songNames = props.doc.payload.rows
                .filter((x) => x.type === "song" && props.doc.payload.cells.some((c) => c.rowId === x.rowId && c.columnId === column.columnId && (c.pointsAllocated !== undefined)))
                .map((x) => allSongs.find((s) => s.id === x.songId)!.name);
            await navigator.clipboard.writeText(songNames.join("\n"));
            setAnchorEl(null);
        }, "Copied song names to clipboard");
    };

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
        const cells = props.doc.payload.cells.filter((x) => x.columnId === column.columnId && (x.pointsAllocated !== undefined)).map((x) => x.rowId);
        const songIds = props.doc.payload.rows.filter((x) => x.type === "song" && cells.includes(x.rowId)).map(row => row.songId);
        const songs = allSongs.filter((x) => songIds.includes(x.id));
        return songs.map((s, index) => ({
            sortOrder: index,
            comment: "",
            song: s,
            type: 'song',
        }));
    };

    const handleCopyAsSetlist = async () => {
        await snackbar.invokeAsync(async () => {
            const setlist = columnToSetlist(column);
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
                Copy song names
            </MenuItem>

            <MenuItem onClick={handleCopyAsSetlist}>
                Copy as setlist
            </MenuItem>

            <Divider />
            <MenuItem onClick={handleClearAllocation}>
                Clear allocation for {column.name}
            </MenuItem>
            <Divider />
            {
                props.doc.payload.columns.filter(c => c.columnId != props.columnId).map((c, index) => (
                    <MenuItem key={index} onClick={() => handleSwapAllocationWith(c.columnId)}>
                        Swap allocation with {c.name}
                    </MenuItem>
                ))
            }
        </Menu >
    </>;
};



//////////////////////////////////////////////////////////////////////////////////////////////////
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

    const docOrTempDoc = props.tempDoc || props.doc;
    //const isTempDoc = !!props.tempDoc;

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
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
            <div className="td songName"></div>
            <div className="td songLength">
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
                        value={segment.pointsAvailable || null}
                        onChange={(e, newValue) => {
                            props.mutator.setColumnAvailablePoints(segment.columnId, newValue || undefined);
                        }}
                    />
                </div>
            </div>)}
            <div className="td rehearsalTime">total</div>
            <div className="td balance">bal</div>
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
                        />
                    }
                </ReactSmoothDndDraggable>
                )}
            </ReactSmoothDndContainer>
        </div>

        <div className="footerContainer">
            <div className="tr footer">
                {/* <Tooltip disableInteractive title={`Total required rehearsal points for all songs`}> */}
                <div className="td songName numberCell">
                    {/* <NumberField inert value={props.stats.totalPointsRequired} style={{ backgroundColor: gColors.songRequiredPoints[1] }} /> */}
                </div>
                <Tooltip
                    disableInteractive
                    title={`Total song length for all songs`}
                >
                    <div className="td songLength">
                        {formatSongLength(props.stats.totalSongLengthSeconds)}
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
            </div>

            <div className="tr footer">
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
            </div>

        </div >

        <Markdown3Editor
            //beginInPreview={true}
            value={docOrTempDoc.payload.notes || ""}
            onChange={(newMarkdown) => {
                props.mutator.setNotes(newMarkdown);
            }}
            nominalHeight={300}
        />

        <table style={{ fontFamily: "monospace" }} className="cost-table">
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

        <div className="SetlistPlannerDocumentEditorAddSong">
            Add song...
            <SongAutocomplete
                value={null}
                onChange={(newSong) => {
                    if (newSong) {
                        props.mutator.addSong(newSong.id);
                    }
                }}
            />

            <Button startIcon={gIconMap.Add()} onClick={() => {
                props.mutator.addDivider();
            }}>Add Divider</Button>
        </div>

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
        let newDoc: any

        try {
            newDoc = JSON.parse(text)
        } catch (e) {
            console.error(e)
            snackbar.showError("Failed to parse clipboard contents")
            return
        }

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

    const handleSyncWithClipboardSetlist = async () => {
        // first gather lists of songs to be added & removed,
        // use confirm() to ask the user if they want to proceed,
        // then perform the operations and report the results to the console & snackbar.
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

        console.log(toAdd);
        console.log(toRemove);

        const toAddComponents = toAdd.map((id) => <CMChip key={id}>{allSongs.find((s) => s.id === id)!.name}</CMChip>);
        const toRemoveComponents = toRemove.map((id) => <CMChip key={id}>{allSongs.find((s) => s.id === id)!.name}</CMChip>);

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
            }}>clear</MenuItem>
            <MenuItem onClick={() => {
                setAnchorEl(null);
                props.onDelete();
            }}>delete this plan</MenuItem>
            <Divider />
            <MenuItem onClick={() => {
                setAnchorEl(null);
                props.mutator.autoCompletePlanSA();
            }}>Auto-fill (Simulated annealing)</MenuItem>
            <MenuItem onClick={() => {
                setAnchorEl(null);
                props.mutator.autoCompletePlanAStar();
            }}>Auto-fill (A star)</MenuItem>
            <MenuItem onClick={() => {
                setAnchorEl(null);
                props.mutator.autoCompletePlanDag();
            }}>Auto-fill (DAG)</MenuItem>
            <Divider />
            <MenuItem
                onClick={handleCopyToClipboard}
            >
                Copy plan to clipboard
            </MenuItem>
            <MenuItem
                onClick={handlePasteFromClipboard}
            >
                Paste plan from clipboard
            </MenuItem>
            <MenuItem onClick={handleAddSongsFromClipboardSetlist}>
                Add songs from copied setlist
            </MenuItem>
            <MenuItem onClick={handleSyncWithClipboardSetlist}>
                Sync (add & remove) songs with clipboard setlist
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
    onSave: (doc: SetlistPlan) => void;
    onCancel: () => void;
    onDelete: () => void;
};

type TTabId = "plan" | "segments" | "songs" | "matrix";

export const SetlistPlannerDocumentEditor = (props: SetlistPlannerDocumentEditorProps) => {
    const [doc, setDoc] = React.useState<SetlistPlan>(props.initialValue);
    const [selectedTab, setSelectedTab] = React.useState<TTabId>("matrix");
    const allSongs = useSongsContext().songs;
    const snackbar = useSnackbar();
    const confirm = useConfirm();

    const docOrTempDoc = props.tempValue || doc;
    const isTempDoc = !!props.tempValue;

    const [stats, setStats] = React.useState<SetlistPlanStats>(() => CalculateSetlistPlanStats(docOrTempDoc, allSongs));
    React.useEffect(() => {
        setDoc(props.initialValue);
    }, [props.initialValue]);

    React.useEffect(() => {
        setStats(CalculateSetlistPlanStats(docOrTempDoc, allSongs));
    }, [docOrTempDoc]);

    const onDropSegment = (args: ReactSmoothDnd.DropResult) => {
        props.mutator.reorderColumns(args);
    };

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
            </ButtonGroup>
            <MainDropdownMenu doc={doc} mutator={props.mutator} onDelete={props.onDelete} />
            <ButtonGroup>
                <Button
                    onClick={() => {
                        props.mutator.clearAllocation();
                    }}
                    disabled={isTempDoc}
                >clear</Button>
                <Divider />
                <Button
                    onClick={() => {
                        props.mutator.autoCompletePlanSA();
                    }}
                    disabled={isTempDoc}
                >SA</Button>
                <Button
                    onClick={() => {
                        props.mutator.autoCompletePlanAStar();
                    }}
                    disabled={isTempDoc}
                >A*</Button>
                <Button
                    onClick={() => {
                        props.mutator.autoCompletePlanAStar2();
                    }}
                    disabled={isTempDoc}
                >A*2</Button>
                <Button
                    onClick={() => {
                        props.mutator.autoCompletePlanDag();
                    }}
                    disabled={isTempDoc}
                >DAG</Button>
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
                        value={doc.name}
                        onChange={(e, newName) => {
                            props.mutator.setName(newName);
                        }}
                    />
                } />
                <NameValuePair name="Group" value={
                    <CMTextInputBase
                        className="group"
                        value={doc.groupName}
                        onChange={(e, newGroup) => {
                            props.mutator.setGroupName(newGroup);
                        }}
                    />
                } />
                <Markdown3Editor
                    onChange={(newMarkdown) => {
                        props.mutator.setDescription(newMarkdown);
                    }}
                    value={doc.description}
                    nominalHeight={75}
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
                                            className="segmentName"
                                            value={segment.name}
                                            onChange={(e, newName) => {
                                                props.mutator.setColumnName(segment.columnId, newName);
                                            }}
                                        />
                                    } />
                                    <NameValuePair name="Points available" value={
                                        <NumberField
                                            value={segment.pointsAvailable || null}
                                            onChange={(e, newTotal) => {
                                                props.mutator.setColumnAvailablePoints(segment.columnId, newTotal || undefined);
                                            }} />
                                    } />
                                    <ColorPick
                                        value={segment.color || null}
                                        onChange={(newColor) => {
                                            props.mutator.setColumnColor(segment.columnId, newColor?.id || undefined);
                                        }}
                                        allowNull={true}
                                    />
                                    <Markdown3Editor
                                        onChange={(newMarkdown) => {
                                            props.mutator.setColumnComment(segment.columnId, newMarkdown);
                                        }}
                                        value={segment.commentMarkdown || ""}
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
                        return <div key={song.rowId} className="SetlistPlannerDocumentEditorSong">
                            <div>

                                {song.type === "song" && <div>
                                    <h2 className="name">{allSongs.find((x) => x.id === song.songId)?.name}</h2>
                                    <NumberField
                                        value={song.pointsRequired || null}
                                        onChange={(e, newMeasure) => {
                                            props.mutator.setRowPointsRequired(song.rowId, newMeasure || undefined);
                                        }}
                                    />
                                    <span>rehearsal points required</span>
                                </div>}

                                <div style={{ display: "flex", alignItems: "center" }}>
                                    <Button onClick={() => {
                                        props.mutator.deleteRow(song.rowId);
                                    }}>{gIconMap.Delete()}</Button>
                                    <div className="type"><CMChip color={song.type === "divider" ? gSwatchColors.brown : gSwatchColors.blue}>{song.type}</CMChip></div>
                                    {/* <ColorPick
                                    value={song.color || null}

                                    onChange={(newColor) => {
                                        props.mutator.setRowColor(song.rowId, newColor?.id || undefined);
                                    }}
                                /> */}
                                </div>
                            </div>
                            <Markdown3Editor
                                nominalHeight={75}
                                onChange={(newMarkdown) => {
                                    props.mutator.setRowComment(song.rowId, newMarkdown);
                                }}
                                value={song.commentMarkdown || ""}
                            //beginInPreview={true}
                            />
                        </div>
                    })}
                </div>

                <div className="SetlistPlannerDocumentEditorAddSong">
                    Add a song...
                    <SongAutocomplete
                        value={null}
                        onChange={(newSong) => {
                            if (newSong) {
                                props.mutator.addSong(newSong.id);
                            }
                        }}
                    />

                    <Button startIcon={gIconMap.Add()} onClick={() => {
                        props.mutator.addDivider();
                    }}>Add Divider</Button>
                </div>

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
