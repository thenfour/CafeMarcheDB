// todo
// split into:
// - SetlistPlannerComponents
// - break out all util components
// - break out setlist planner client utils into a lib

import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Accordion, AccordionSummary, Backdrop, Button, FormControlLabel, Switch } from "@mui/material";
import { nanoid } from "nanoid";
import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { moveItemInArray } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import { getUniqueNegativeID, groupBy, IsNullOrWhitespace } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { useConfirm } from "src/core/components/ConfirmationDialog";
import { useDashboardContext, useFeatureRecorder } from "src/core/components/DashboardContext";
import { PortableSongList } from "src/core/components/EventSongListComponents";
import { Markdown } from "src/core/components/markdown/Markdown";
import { gSetlistPlannerDefaultColorScheme, SetlistPlannerColorScheme, SetlistPlannerColorSchemeEditor } from "src/core/components/setlistPlan/SetlistPlanColorComponents";
import { SetlistPlannerDocumentEditor } from "src/core/components/setlistPlan/SetlistPlanMainComponents";
import { SetlistPlanCostPenalties, SetlistPlanMutator, SetlistPlanSearchProgressState } from "src/core/components/setlistPlan/SetlistPlanUtilities";
import { AutoSelectingNumberField } from "src/core/components/setlistPlan/SetlistPlanUtilityComponents";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { SongsProvider, useSongsContext } from "src/core/components/SongsContext";
import { gIconMap } from "src/core/db3/components/IconMap";
import deleteSetlistPlan from "src/core/db3/mutations/deleteSetlistPlan";
import upsertSetlistPlan from "src/core/db3/mutations/upsertSetlistPlan";
import getSetlistPlans from "src/core/db3/queries/getSetlistPlans";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { CreateNewSetlistPlan, SetlistPlan, SetlistPlanAssociatedItem, SetlistPlanCell, SetlistPlanLedDef, SetlistPlanLedValue, SetlistPlanRow } from "src/core/db3/shared/setlistPlanTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

function getId(prefix: string) {
    //return `${prefix}${nanoid(3)}`;
    return nanoid(4);
}

//const AutoCompleteSetlistPlan = SetlistPlanAutoFillSA;// SetlistPlanAutoFillAStar;

type Penalty = {
    mul: number;
    add: number;
}

const PenaltyEditor = (props: { value: Penalty, onChange: (value: Penalty) => void }) => {
    const { value, onChange } = props;
    return <>
        <td>
            <AutoSelectingNumberField value={value.mul} onChange={(e, val) => onChange({ ...value, mul: val || 0 })} />
        </td><td>
            <AutoSelectingNumberField value={value.add} onChange={(e, val) => onChange({ ...value, add: val || 0 })} />
        </td>
    </>;
};

const CostConfigEditor = (props: { value: SetlistPlanCostPenalties, onChange: (value: SetlistPlanCostPenalties) => void }) => {
    const snackbar = useSnackbar();
    const { value, onChange } = props;
    return <div className="CostConfigEditor">
        <h2>Cost Configuration</h2>
        <table>
            <tbody>
                <tr>
                    <PenaltyEditor value={value.underRehearsedSong} onChange={val => props.onChange({ ...props.value, underRehearsedSong: val })} />
                    <td>Under-rehearsed song</td>
                </tr>
                <tr>
                    <PenaltyEditor value={value.maxPointsPerRehearsal} onChange={val => props.onChange({ ...props.value, maxPointsPerRehearsal: val })} />
                    <td>Max points per rehearsal</td>
                </tr>
                <tr>
                    <PenaltyEditor value={value.overAllocatedSegment} onChange={val => props.onChange({ ...props.value, overAllocatedSegment: val })} />
                    <td>Over-allocated segment</td>
                </tr>
                {/* <tr>
                    <PenaltyEditor value={value.nonClusteredAllocation} onChange={val => props.onChange({ ...props.value, nonClusteredAllocation: val })} />
                    <td>Non-clustered allocation</td>
                </tr> */}
                <tr>
                    <PenaltyEditor value={value.increasingAllocation} onChange={val => props.onChange({ ...props.value, increasingAllocation: val })} />
                    <td>Increasing allocation</td>
                </tr>
                <tr>
                    <PenaltyEditor value={value.delayedRehearsal} onChange={val => props.onChange({ ...props.value, delayedRehearsal: val })} />
                    <td>Delayed rehearsal</td>
                </tr>
                <tr>
                    <PenaltyEditor value={value.overRehearsedSong} onChange={val => props.onChange({ ...props.value, overRehearsedSong: val })} />
                    <td>Over-rehearsed song</td>

                </tr>
                <tr>
                    <PenaltyEditor value={value.lighterSongRehearsedBeforeHeavierSong} onChange={val => props.onChange({ ...props.value, lighterSongRehearsedBeforeHeavierSong: val })} />
                    <td>Lighter song rehearsed before heavier song</td>
                </tr>
                <tr>
                    <PenaltyEditor value={value.segmentUnderUtilized} onChange={val => props.onChange({ ...props.value, segmentUnderUtilized: val })} />
                    <td>Segment under-utilized</td>
                </tr>
                <tr>
                    <PenaltyEditor value={value.fragmentedSong} onChange={val => props.onChange({ ...props.value, fragmentedSong: val })} />
                    <td>Fragmented song</td>
                </tr>
                <tr>
                    <PenaltyEditor value={value.underAllocatedSegment} onChange={val => props.onChange({ ...props.value, underAllocatedSegment: val })} />
                    <td>Under-allocated segment</td>
                </tr>

            </tbody>
        </table>
        <Button onClick={() => onChange(gDefaultCostCalcConfig)}>Reset to Default</Button>
        <Button
            onClick={() => {
                void snackbar.invokeAsync(async () => {
                    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
                }, "Copied to clipboard");
            }}
        >Copy to clipboard</Button>
        <Button
            onClick={() => {
                void snackbar.invokeAsync(async () => {
                    const text = await navigator.clipboard.readText();
                    const parsed = JSON.parse(text);
                    props.onChange(parsed);
                }, "Pasted from clipboard");
            }}
        >
            Paste from clipboard
        </Button>
    </div>;
};


// const SaConfigEditor = (props: { value: SimulatedAnnealingConfig, onChange: (value: SimulatedAnnealingConfig) => void }) => {
//     const snackbar = useSnackbar();
//     const { value, onChange } = props;
//     return <div className="CostConfigEditor">
//         <h2>Simulated Annealing Config</h2>
//         <table>
//             <tbody>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.initialTemp} onChange={(e, val) => onChange({ ...value, initialTemp: val || 0 })} /></td>
//                     <td>initial temp</td>
//                 </tr>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.coolingRate} onChange={(e, val) => onChange({ ...value, coolingRate: val || 0 })} /></td>
//                     <td>coolingRate</td>
//                 </tr>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.cellsToMutatePerIteration} onChange={(e, val) => onChange({ ...value, cellsToMutatePerIteration: val || 0 })} /></td>
//                     <td>cellsToMutatePerIteration</td>
//                 </tr>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.maxIterations} onChange={(e, val) => onChange({ ...value, maxIterations: val || 0 })} /></td>
//                     <td>maxIterations</td>
//                 </tr>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.favorLateIndicesAlpha} onChange={(e, val) => onChange({ ...value, favorLateIndicesAlpha: val || 0 })} /></td>
//                     <td>favorLateIndicesAlpha</td>
//                 </tr>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.probabilityOfEmpty01} onChange={(e, val) => onChange({ ...value, probabilityOfEmpty01: val || 0 })} /></td>
//                     <td>probabilityOfEmpty01</td>
//                 </tr>
//             </tbody>
//         </table>
//         <Button onClick={() => onChange(gDefaultSaConfig)}>Reset to Default</Button>
//         <Button
//             onClick={() => {
//                 void snackbar.invokeAsync(async () => {
//                     await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
//                 }, "Copied to clipboard");
//             }}
//         >Copy to clipboard</Button>
//         <Button
//             onClick={() => {
//                 void snackbar.invokeAsync(async () => {
//                     const text = await navigator.clipboard.readText();
//                     const parsed = JSON.parse(text);
//                     props.onChange(parsed);
//                 }, "Pasted from clipboard");
//             }}
//         >
//             Paste from clipboard
//         </Button>
//     </div>;
// };


// const gDefaultAStarConfig: AStarSearchConfig = {
//     depthsWithoutCulling: 2,
//     cullPercent01: undefined,
//     cullClampMin: undefined,
//     cullClampMax: 1,
// };

// const AStarConfigEditor = (props: { value: AStarSearchConfig, onChange: (value: AStarSearchConfig) => void }) => {
//     const snackbar = useSnackbar();
//     const { value, onChange } = props;
//     return <div className="CostConfigEditor">
//         <h2>A Star Config</h2>
//         <table>
//             <tbody>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.depthsWithoutCulling} onChange={(e, val) => onChange({ ...value, depthsWithoutCulling: val || 0 })} /></td>
//                     <td>depthsWithoutCulling</td>
//                 </tr>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.cullPercent01 || null} onChange={(e, val) => onChange({ ...value, cullPercent01: val || undefined })} /></td>
//                     <td>cullPercent01</td>
//                 </tr>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.cullClampMin || null} onChange={(e, val) => onChange({ ...value, cullClampMin: val || undefined })} /></td>
//                     <td>cullClampMin</td>
//                 </tr>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.cullClampMax || null} onChange={(e, val) => onChange({ ...value, cullClampMax: val || undefined })} /></td>
//                     <td>cullClampMax</td>
//                 </tr>
//             </tbody>
//         </table>
//         <Button onClick={() => onChange(gDefaultAStarConfig)}>Reset to Default</Button>
//         <Button
//             onClick={() => {
//                 void snackbar.invokeAsync(async () => {
//                     await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
//                 }, "Copied to clipboard");
//             }}
//         >Copy to clipboard</Button>
//         <Button
//             onClick={() => {
//                 void snackbar.invokeAsync(async () => {
//                     const text = await navigator.clipboard.readText();
//                     const parsed = JSON.parse(text);
//                     props.onChange(parsed);
//                 }, "Pasted from clipboard");
//             }}
//         >
//             Paste from clipboard
//         </Button>
//     </div>;
// };



const gDefaultCostCalcConfig: SetlistPlanCostPenalties = {
    // hard requirements.
    underRehearsedSong: { mul: 999, add: 999 },
    maxPointsPerRehearsal: { mul: 899, add: 899 },
    overAllocatedSegment: { mul: 799, add: 799 },

    // to be avoided, when the above have been satisfied.
    //nonClusteredAllocation: { mul: 0, add: 0 }, // this is not good; see #363. there are good reasons to add spaces between rehearsals, and it COUNTERS the delayedRehearsal penalty.
    increasingAllocation: { mul: 9, add: 9 },

    delayedRehearsal: { mul: 5, add: 5 },
    fragmentedSong: { mul: 5, add: 5 }, // this is necessary otherwise [1,1,1,1] is the same as [4] which is obviously not correct
    overRehearsedSong: { mul: 1, add: 1 },
    lighterSongRehearsedBeforeHeavierSong: { mul: 0, add: 0 },

    // trivial or non-existent penalties
    segmentUnderUtilized: { mul: 0, add: 1 },
    underAllocatedSegment: { mul: 0, add: 1 },
};

// const gDefaultSaConfig: SimulatedAnnealingConfig = {
//     initialTemp: 9999,
//     coolingRate: 0.99,
//     maxIterations: 1000,
//     cellsToMutatePerIteration: 2,
//     favorLateIndicesAlpha: 1,
//     probabilityOfEmpty01: 0.5,
// };

// const gDefaultRetainConfig: SetlistPlanRetentionConfig = {
//     factor: 0.05,
//     minAmt: 150,
//     maxAmt: 300,
// };


// const RetainConfigEditor = (props: { value: SetlistPlanRetentionConfig, onChange: (value: SetlistPlanRetentionConfig) => void }) => {
//     const { value, onChange } = props;
//     return <div className="RetainConfigEditor">
//         <h2>Retain Configuration</h2>

//         <table>
//             <tbody>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.minAmt} onChange={(e, v) => onChange({ ...value, minAmt: v || 0 })} /></td>
//                     <td>min amount</td>
//                 </tr>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.maxAmt || null} onChange={(e, v) => onChange({ ...value, maxAmt: (v === null) ? undefined : v })} /></td>
//                     <td>max amount</td>
//                 </tr>
//                 <tr>
//                     <td><AutoSelectingNumberField value={value.factor || null} onChange={(e, v) => onChange({ ...value, factor: (v === null) ? undefined : v })} /></td>
//                     <td>factor</td>
//                 </tr>

//             </tbody>
//         </table>

//         <Button onClick={() => onChange({ ...gDefaultRetainConfig })}>Reset to Default</Button>
//     </div>;
// }

/*

rehearsal points are similar to agile points.
they are a measure of how much rehearsal *time* is needed to rehearse a song to be performance-ready.
the idea is to plan a series of rehearsal setlists to prepare for a performance.
each column (segment / rehearsal) has a number of points available (similar to an agile sprint).
a user allocates rehearsal points to songs
balancing available rehearsal time against the time needed for each song.

*/

// songs = rows
// segments = columns


//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerDocumentOverviewProps = {
    onSelect: (doc: SetlistPlan) => void;
};

const SetlistPlannerDocumentOverview = (props: SetlistPlannerDocumentOverviewProps) => {
    const [expandedGroup, setExpandedGroup] = React.useState<string | false>(false);


    const dashboardContext = useDashboardContext();
    if (!dashboardContext.currentUser) return <div>you must be logged in to use this feature</div>;

    const [plans, { refetch }] = useQuery(getSetlistPlans, { userId: dashboardContext.currentUser.id });

    // group by groupName
    const groupedPlans = groupBy(plans, (x) => x.groupName || "");

    return <div className="SetlistPlannerDocumentOverviewList">

        {Object.keys(groupedPlans).map((groupName) => {
            const groupPlans = groupedPlans[groupName]!;
            return <Accordion key={groupName} expanded={expandedGroup === groupName} onChange={() => setExpandedGroup(expandedGroup === groupName ? false : groupName)}>
                <AccordionSummary
                    expandIcon={gIconMap.ExpandMore()}
                    className="SetlistPlannerDocumentOverviewGroupHeader"
                >
                    <span className="title">{IsNullOrWhitespace(groupName) ? "Ungrouped" : groupName}</span>
                    <span className="subtitle">{groupPlans.length} plan(s)</span>
                </AccordionSummary>
                <div className="SetlistPlannerDocumentOverviewGroupItemList">
                    {groupPlans.map((dbPlan) => {
                        return <div
                            key={dbPlan.id}
                            className="SetlistPlannerDocumentOverviewItem"
                            onClick={() => {
                                props.onSelect(dbPlan);
                            }}
                        >
                            <div className="name">{dbPlan.name}</div>
                            <Markdown
                                markdown={dbPlan.description}
                                compact
                            />
                        </div>;
                    })}
                </div>
                {!IsNullOrWhitespace(groupName) && <div className="actionButtons">
                    <Button
                        onClick={() => {
                            const newDoc = CreateNewSetlistPlan(getUniqueNegativeID(), "New Setlist Plan", groupName, dashboardContext.currentUser!.id);
                            props.onSelect(newDoc);
                        }}
                    >Create new "{groupName}"</Button>
                </div>}
            </Accordion>;
        })}
    </div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const SetlistPlannerPageContent = () => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const [upsertSetlistPlanToken] = useMutation(upsertSetlistPlan);
    const [deleteSetlistPlanToken] = useMutation(deleteSetlistPlan);
    const [showColorSchemeEditor, setShowColorSchemeEditor] = React.useState(false);
    //const [showAutocompleteConfig, setShowAutocompleteConfig] = React.useState(false);
    const recordFeature = useFeatureRecorder();

    const [autocompleteProgressState, setAutocompleteProgressState] = React.useState<SetlistPlanSearchProgressState>();
    const cancellationTrigger = React.useRef<boolean>(false);

    const [costCalcConfig, setCostCalcConfig] = React.useState<SetlistPlanCostPenalties>(gDefaultCostCalcConfig);
    // const [saConfig, setSaConfig] = React.useState<SimulatedAnnealingConfig>(gDefaultSaConfig);
    // const [aStarConfig, setAStarConfig] = React.useState<AStarSearchConfig>(gDefaultAStarConfig);

    const confirm = useConfirm();
    const allSongs = useSongsContext().songs;

    if (!dashboardContext.currentUser) return <div>you must be logged in to use this feature</div>;
    const [doc, setDoc] = React.useState<SetlistPlan | null>(null);
    const [undoStack, setUndoStack] = React.useState<SetlistPlan[]>([]);
    const [redoStack, setRedoStack] = React.useState<SetlistPlan[]>([]);

    const [tempDoc, setTempDoc] = React.useState<SetlistPlan>();
    const [modified, setModified] = React.useState(false);

    const [colorScheme, setColorScheme] = React.useState<SetlistPlannerColorScheme>(gSetlistPlannerDefaultColorScheme);

    const [neighbors, setNeighbors] = React.useState<SetlistPlan[]>([]);

    // removes cells where rowId or columnId is not found in the document.
    const cleanCells = (doc: SetlistPlan): SetlistPlan => {
        const rowIds = doc.payload.rows.map(x => x.rowId);
        const columnIds = doc.payload.columns.map(x => x.columnId);
        const rows = doc.payload.rows.filter(x => rowIds.includes(x.rowId));
        const columns = doc.payload.columns.filter(x => columnIds.includes(x.columnId));
        return { ...doc, payload: { ...doc.payload, rows, columns } };
    };

    const setDocWrapper = (newDoc: SetlistPlan, setModifiedValue: boolean = true) => {
        if (doc) {
            const maxUndoStack = 99;
            setUndoStack([...undoStack, doc].slice(-maxUndoStack));
            setRedoStack([]);
        }
        setNeighbors([]);
        setDoc(cleanCells(newDoc));
        setModified(setModifiedValue);
    };

    const docOrTempDoc = tempDoc || doc;
    const isTempDoc = !!tempDoc;

    const doAutoFill = async (autoFillProc: (progressHandler: (progressState: SetlistPlanSearchProgressState) => void) => Promise<SetlistPlanSearchProgressState>) => {
        if (doc) {
            // remove all null allocation cells.
            const cleanedDoc = {
                ...doc,
                payload: {
                    ...doc.payload,
                    cells: doc.payload.cells.filter(x => x.pointsAllocated !== undefined),
                },
            };
            //console.log(cleanedDoc);

            cancellationTrigger.current = false;
            const startTime = performance.now();
            let lastFrameTime = startTime;
            let lastIterations = 0;

            const progressHandler = (progressState: SetlistPlanSearchProgressState) => {
                const now = performance.now();
                const iterationsSinceLast = progressState.iteration - lastIterations;
                const iterationsPerSecond = iterationsSinceLast / ((now - lastFrameTime) / 1000);
                lastIterations = progressState.iteration;
                lastFrameTime = now;
                setTempDoc(progressState.currentState.plan);
                setAutocompleteProgressState({
                    ...progressState,
                    iterationsPerSecond,
                });
            };

            const result = await autoFillProc(progressHandler);

            // const result = await SetlistPlanAutoFillSA(saConfig, cleanedDoc, costCalcConfig, allSongs, cancellationTrigger, (progressState) => {
            // });

            const newDoc = result.bestState?.plan || result.currentState.plan;
            newDoc.payload.autoCompleteDurationSeconds = result.elapsedMillis / 1000;
            newDoc.payload.autoCompleteDepth = result.depth;
            newDoc.payload.autoCompleteIterations = result.iteration;

            setAutocompleteProgressState(undefined);
            setTempDoc(undefined);
            setDocWrapper(newDoc);
        }
    };

    const mutator = React.useMemo(() => {
        const ret: SetlistPlanMutator = {
            undo: () => {
                if (doc) {
                    const last = undoStack.pop();
                    if (last) {
                        setRedoStack([...redoStack, doc]);
                        setDoc(last);
                        setNeighbors([]);
                        setModified(true);
                    }
                }
            },
            redo: () => {
                if (doc) {
                    const last = redoStack.pop();
                    if (last) {
                        setUndoStack([...undoStack, doc]);
                        setDoc(last);
                        setNeighbors([]);
                        setModified(true);
                    }
                }
            },
            setVisiblePermissionId: (permissionId: number) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        visiblePermissionId: permissionId,
                    });
                }
            },
            // autoCompletePlanAStar: async () => {
            //     if (!doc) return;
            //     await doAutoFill(async (progressHandler) => {
            //         return await SetlistPlanAutoFillAStar(aStarConfig, doc, costCalcConfig, cancellationTrigger, progressHandler);
            //     });
            // },
            // autoCompletePlanAStar2: async () => {
            //     if (!doc) return;
            //     await doAutoFill(async (progressHandler) => {
            //         return await SetlistPlanAutoFillAStar2(aStarConfig, doc, costCalcConfig, cancellationTrigger, progressHandler);
            //     });
            // },
            // autoCompletePlanDag: async () => {
            //     if (!doc) return;
            //     await doAutoFill(async (progressHandler) => {
            //         return await SetlistPlanAutoFillDAG(doc, costCalcConfig, cancellationTrigger, progressHandler);
            //     });
            // },
            // autoCompletePlanSA: async () => {
            //     if (!doc) return;
            //     await doAutoFill(async (progressHandler) => {
            //         return await SetlistPlanAutoFillSA(saConfig, doc, costCalcConfig, cancellationTrigger, progressHandler);
            //     });
            // },
            setAutocompleteMaxPointsPerRehearsal: (maxPoints: number) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            autoCompleteMaxPointsPerRehearsal: maxPoints,
                        },
                    });
                }
            },
            setNotes: (notes: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            notes,
                        },
                    });
                }
            },
            setDoc: (newDoc: SetlistPlan) => {
                // do not clobber the existing document's id.
                setDocWrapper({ ...newDoc, id: doc?.id || getUniqueNegativeID() });
            },
            setName: (name: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        name,
                    });
                }
            },
            setGroupName: (groupName: string | null) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        groupName,
                    });
                }
            },
            setDescription: (description: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        description,
                    });
                }
            },
            addSong: (songId: number) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: [...doc.payload.rows, {
                                rowId: getId("row"),
                                songId,
                                commentMarkdown: "",
                                type: "song",
                                pointsRequired: 0,
                            }],
                        },
                    });
                }
            },
            addAndRemoveSongs: (add: number[], remove: number[]) => {
                if (doc) {
                    const newRows: SetlistPlanRow[] = add.map(songId => ({
                        rowId: getId("row"),
                        songId,
                        commentMarkdown: "",
                        type: "song",
                        pointsRequired: 0,
                    }));
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: [...doc.payload.rows, ...newRows].filter((x) => !remove.includes(x.songId!)),
                        },
                    });
                }
            },
            addDivider: () => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: [...doc.payload.rows, {
                                rowId: getId("row"),
                                type: "divider",
                            }],
                        },
                    });
                }
            },
            addPortableSongList: (songList: PortableSongList) => {
                if (doc) {

                    const newRows: SetlistPlanRow[] = songList.map(item => {
                        if (item.type === "song") {
                            return {
                                rowId: getId("row"),
                                songId: item.song.id,
                                commentMarkdown: "",
                                type: "song",
                                pointsRequired: 0,
                            };
                        } else {
                            return {
                                rowId: getId("row"),
                                type: "divider",
                            };
                        }
                    });

                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: [...doc.payload.rows, ...newRows],
                        },
                    });
                }
            },
            deleteRow: (rowId: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: doc.payload.rows.filter((x) => x.rowId !== rowId),
                        },
                    });
                }
            },
            setRowPointsRequired: (rowId: string, measure: number | undefined) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: doc.payload.rows.map((x) => {
                                if (x.rowId === rowId) {
                                    return {
                                        ...x,
                                        pointsRequired: measure,
                                        //measureRequired: measure,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            setRowComment: (rowId: string, comment: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: doc.payload.rows.map((x) => {
                                if (x.rowId === rowId) {
                                    return {
                                        ...x,
                                        commentMarkdown: comment,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            addColumn: () => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: [...doc.payload.columns, {
                                columnId: getId("col"),
                                pointsAvailable: 0,
                                name: `New Segment ${nanoid(3)}`,
                                commentMarkdown: "",
                            }],
                        },
                    });
                }
            },
            deleteColumn: (columnId: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: doc.payload.columns.filter((x) => x.columnId !== columnId),
                        },
                    });
                }
            },
            setColumnName: (columnId: string, name: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: doc.payload.columns.map((x) => {
                                if (x.columnId === columnId) {
                                    return {
                                        ...x,
                                        name,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            setColumnComment: (columnId: string, comment: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: doc.payload.columns.map((x) => {
                                if (x.columnId === columnId) {
                                    return {
                                        ...x,
                                        commentMarkdown: comment,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            setColumnColor: (columnId: string, color: string | undefined | null) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: doc.payload.columns.map((x) => {
                                if (x.columnId === columnId) {
                                    return {
                                        ...x,
                                        color,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            setColumnAssociatedItem: (columnId: string, associatedItem: SetlistPlanAssociatedItem | null) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: doc.payload.columns.map((x) => {
                                if (x.columnId === columnId) {
                                    return {
                                        ...x,
                                        associatedItem,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            setManualCellPoints: (rowId: string, columnId: string, measure: number | undefined) => {
                if (doc) {
                    const exists = doc.payload.cells.find((x) => x.columnId === columnId && x.rowId === rowId);
                    const newSegmentSongs: SetlistPlanCell[] = doc.payload.cells.map((x) => {
                        if (x.columnId === columnId && x.rowId === rowId) {
                            return {
                                ...x,
                                //measureUsage: measure,
                                pointsAllocated: measure,
                                autoFilled: false,
                            };
                        }
                        return x;
                    });

                    // if there's no entry in segmentSongs yet, create one.
                    if (!exists) {
                        newSegmentSongs.push({
                            columnId,
                            rowId,
                            pointsAllocated: measure,
                            commentMarkdown: "",
                            autoFilled: false,
                        });
                    }

                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            cells: newSegmentSongs,
                        },
                    });
                }
            },
            setColumnAvailablePoints: (columnId: string, total: number | undefined) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: doc.payload.columns.map((x) => {
                                if (x.columnId === columnId) {
                                    return {
                                        ...x,
                                        pointsAvailable: total,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            reorderRows: (args: ReactSmoothDnd.DropResult) => {
                if (doc) {
                    // removedIndex is the previous index; the original item to be moved
                    // addedIndex is the new index where it should be moved to.
                    if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
                    if (args.addedIndex === args.removedIndex) return; // no change
                    const newSongs = moveItemInArray(doc.payload.rows, args.removedIndex, args.addedIndex);
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: newSongs,
                        },
                    });
                }
            },
            reorderColumns: (args: ReactSmoothDnd.DropResult) => {
                if (doc) {
                    if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
                    if (args.addedIndex === args.removedIndex) return; // no change
                    const newSegments = moveItemInArray(doc.payload.columns, args.removedIndex, args.addedIndex);
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: newSegments,
                        },
                    });
                }
            },
            reorderColumnLeds: (args: ReactSmoothDnd.DropResult) => {
                if (doc) {
                    if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
                    if (args.addedIndex === args.removedIndex) return; // no change
                    const newLeds = moveItemInArray(doc.payload.columnLeds || [], args.removedIndex, args.addedIndex);
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columnLeds: newLeds,
                        },
                    });
                }
            },

            reorderRowLeds: (args: ReactSmoothDnd.DropResult) => {
                if (doc) {
                    if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
                    if (args.addedIndex === args.removedIndex) return; // no change
                    const newLeds = moveItemInArray(doc.payload.rowLeds || [], args.removedIndex, args.addedIndex);
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rowLeds: newLeds,
                        },
                    });
                }
            },

            clearAllocation: () => {
                if (doc) {
                    // Also re-generate IDs of rows and columns; when ID scheme changes this is a convenient way to update them.
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            cells: [],
                            rows: doc.payload.rows.map(x => ({ ...x, rowId: getId("row") })),
                            columns: doc.payload.columns.map(x => ({ ...x, columnId: getId("col") })),
                            //emptyLeftRowIndex: 0,
                            //emptyTopRowIndex: 0,
                        },
                    });
                }
            },
            clearColumnAllocation: (columnId: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            cells: doc.payload.cells.filter((x) => x.columnId !== columnId),
                        },
                    });
                }
            },
            swapColumnAllocation: (columnId: string, otherColumnId: string) => {
                if (doc) {
                    //const columnSongs = doc.payload.cells.filter((x) => x.columnId === columnId);
                    //const otherColumnSongs = doc.payload.cells.filter((x) => x.columnId === otherColumnId);
                    const newCells = doc.payload.cells.map((x) => {
                        if (x.columnId === columnId) {
                            return {
                                ...x,
                                columnId: otherColumnId,
                            };
                        }
                        if (x.columnId === otherColumnId) {
                            return {
                                ...x,
                                columnId: columnId,
                            };
                        }
                        return x;
                    });
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            cells: newCells,
                        },
                    });
                }
            },

            addRowLedDef: () => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rowLeds: [...(doc.payload.rowLeds || []), {
                                ledId: getId("led"),
                                name: ``,
                                //sortOrder: (doc.payload.rowLeds || []).length + 1,
                            }],
                        },
                    });
                }
            },
            addColumnLedDef: () => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columnLeds: [...(doc.payload.columnLeds || []), {
                                ledId: getId("led"),
                                name: ``,
                                //sortOrder: (doc.payload.columnLeds || []).length + 1,
                            }],
                        },
                    });
                }
            },
            deleteRowLedDef: (ledId: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rowLeds: (doc.payload.rowLeds || []).filter(x => x.ledId !== ledId),
                        },
                    });
                }
            },
            deleteColumnLedDef: (ledId: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columnLeds: (doc.payload.columnLeds || []).filter(x => x.ledId !== ledId),
                        },
                    });
                }
            },
            updateRowLedDef: (ledId: string, def: SetlistPlanLedDef) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rowLeds: (doc.payload.rowLeds || []).map(x => x.ledId === ledId ? def : x),
                        },
                    });
                }
            },
            updateColumnLedDef: (ledId: string, def: SetlistPlanLedDef) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columnLeds: (doc.payload.columnLeds || []).map(x => x.ledId === ledId ? def : x),
                        },
                    });
                }
            },
            setRowLedValue: (rowId: string, ledId: string, val: SetlistPlanLedValue | null) => {
                if (!doc) return;
                // for the row specified by rowId,
                // set its led value specified by ledId to the value.
                // if the rowId - ledId mapping doesn't exist yet, create it. if it exists, update it.
                // if val is null, remove it.

                const newRows = doc.payload.rows.map(row => {
                    if (row.rowId === rowId) {
                        if (val === null) {
                            const newLeds = (row.leds || []).filter(x => x.ledId !== ledId);
                            return { ...row, leds: newLeds };
                        }
                        const existingLeds = row.leds || [];
                        const existingMapping = existingLeds.find(x => x.ledId === ledId);
                        const newLeds = existingMapping ? existingLeds.map(x => x.ledId === ledId ? val : x) : [...existingLeds, val];
                        return { ...row, leds: newLeds };
                    }
                    return row;
                });

                setDocWrapper({
                    ...doc,
                    payload: {
                        ...doc.payload,
                        rows: newRows,
                    },
                });
            },
            setColumnLedValue: (columnId: string, ledId: string, val: SetlistPlanLedValue | null) => {
                if (!doc) return;
                const newColumns = doc.payload.columns.map(column => {
                    if (column.columnId === columnId) {
                        if (val === null) {
                            const newLeds = (column.leds || []).filter(x => x.ledId !== ledId);
                            return { ...column, leds: newLeds };
                        }
                        const existingLeds = column.leds || [];
                        const existingMapping = existingLeds.find(x => x.ledId === ledId);
                        const newLeds = existingMapping ? existingLeds.map(x => x.ledId === ledId ? val : x) : [...existingLeds, val];
                        return { ...column, leds: newLeds };
                    }
                    return column;
                });

                setDocWrapper({
                    ...doc,
                    payload: {
                        ...doc.payload,
                        columns: newColumns,
                    },
                });
            },


        };
        return ret;
    }, [doc]);

    return <div className="SetlistPlannerPageContent">
        {doc ? <SetlistPlannerDocumentEditor
            initialValue={doc}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            tempValue={tempDoc}
            costCalcConfig={costCalcConfig}
            mutator={mutator}
            colorScheme={colorScheme}
            isModified={modified}
            onSave={async (doc) => {
                void recordFeature({
                    feature: doc.id <= 0 ? ActivityFeature.setlist_plan_create : ActivityFeature.setlist_plan_save,
                    setlistPlanId: doc.id <= 0 ? undefined : doc.id,
                });
                void snackbar.invokeAsync(async () => {
                    const newDoc = await upsertSetlistPlanToken(doc);
                    // because PKs change
                    setDoc(newDoc);
                    setModified(false);
                },
                    "Setlist plan saved",
                    "Error saving setlist plan",
                );
            }}
            onCancel={() => {
                setModified(false);
                setDoc(null);
            }}
            onDelete={async () => {
                if (await confirm({ title: "Are you sure you want to delete this setlist plan?" })) {
                    void recordFeature({
                        feature: ActivityFeature.setlist_plan_delete,
                        setlistPlanId: doc.id <= 0 ? undefined : doc.id,
                    });
                    void snackbar.invokeAsync(async () => {
                        await deleteSetlistPlanToken({ id: doc.id });
                        setModified(false);
                        setDoc(null);
                    },
                        "Setlist plan deleted",
                        "Error deleting setlist plan",
                    );
                }
            }}
        /> : <div>
            <SetlistPlannerDocumentOverview onSelect={(doc) => {
                setModified(false);
                setDoc(doc);
            }}
            />
            <Button onClick={() => {
                setModified(true);
                setDoc(CreateNewSetlistPlan(getUniqueNegativeID(), `Setlist plan ${nanoid(3)}`, "", dashboardContext.currentUser!.id));
            }}>Create New Plan</Button>
        </div>
        }

        <div style={{ display: "flex", flexDirection: "column" }}>
            <FormControlLabel control={<Switch checked={showColorSchemeEditor} onChange={(e) => setShowColorSchemeEditor(e.target.checked)} />} label="Edit Color Scheme" />
            {showColorSchemeEditor &&
                <SetlistPlannerColorSchemeEditor value={colorScheme} onChange={(newScheme) => setColorScheme(newScheme)} />
            }

            {isTempDoc && <h1>SHOWING TEMP VALUES</h1>}

        </div>

        <Backdrop
            open={!!autocompleteProgressState}
            onClick={() => {
                cancellationTrigger.current = true;
            }}
        >
            <div className="SetlistPlannerAutocompleteProgress">
                <div>Auto-allocating...</div>
                <div>Iteration: {autocompleteProgressState?.iteration.toLocaleString()}</div>
                <div>Depth: {autocompleteProgressState?.depth}</div>
                <div>Current Cost: {autocompleteProgressState?.currentState.cost.totalCost.toFixed(2)}</div>
                {autocompleteProgressState?.bestState && <div>Best Cost: {autocompleteProgressState?.bestState.cost.totalCost.toFixed(2)}</div>}
                <div>Duration: {((autocompleteProgressState?.elapsedMillis || 0) / 1000).toFixed(2)}</div>
                <div>Iterations/sec: {((autocompleteProgressState?.iterationsPerSecond || 0) / (autocompleteProgressState?.elapsedMillis || 1) * 1000).toFixed(2)}</div>
            </div>
        </Backdrop>
    </div >
};

// const NumberThingTester = () => {
//     const [value, setValue] = React.useState<number | null>(null);
//     return <div>
//         <NumberField value={value} onChange={(e, val) => setValue(val)} />
//         <Pre text={JSON.stringify(value)} />
//     </div>;
// };

const SetlistPlannerPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Setlist Planner" basePermission={Permission.sysadmin}>
            <AppContextMarker name="Setlist plan page">
                <SongsProvider>
                    {/* <NumberThingTester /> */}
                    <SetlistPlannerPageContent />
                </SongsProvider>
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default SetlistPlannerPage;
