// todo
// split into:
// - SetlistPlannerComponents
// - break out all util components
// - break out setlist planner client utils into a lib

import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Backdrop, Button, FormControlLabel, Switch } from "@mui/material";
import { nanoid } from "nanoid";
import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { Permission } from "shared/permissions";
import { Stopwatch } from "shared/rootroot";
import { getUniqueNegativeID, moveItemInArray } from "shared/utils";
import { useConfirm } from "src/core/components/ConfirmationDialog";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { Markdown } from "src/core/components/RichTextEditor";
import { AStarSearchProgressState, SetlistPlanGetNeighbors } from "src/core/components/setlistPlan/SetlistPlanAutocompleteAStar";
import { AutoCompleteSetlistPlanFracturedBeam } from "src/core/components/setlistPlan/SetlistPlanAutocompleteBeamSearch";
import { gSetlistPlannerDefaultColorScheme, SetlistPlannerColorScheme, SetlistPlannerColorSchemeEditor } from "src/core/components/setlistPlan/SetlistPlanColorComponents";
import { SetlistPlannerDocumentEditor } from "src/core/components/setlistPlan/SetlistPlanMainComponents";
import { CalculateSetlistPlanCost, GetSetlistPlanKey, SetlistPlanCostPenalties, SetlistPlanMutator } from "src/core/components/setlistPlan/SetlistPlanUtilityComponents";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { SongsProvider } from "src/core/components/SongsContext";
import deleteSetlistPlan from "src/core/db3/mutations/deleteSetlistPlan";
import upsertSetlistPlan from "src/core/db3/mutations/upsertSetlistPlan";
import getSetlistPlans from "src/core/db3/queries/getSetlistPlans";
import { CreateNewSetlistPlan, SetlistPlan, SetlistPlanCell, SetlistPlanRow } from "src/core/db3/shared/setlistPlanTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

function getId(prefix: string) {
    //return `${prefix}${nanoid(3)}`;
    return nanoid(4);
}

const AutoCompleteSetlistPlan = AutoCompleteSetlistPlanFracturedBeam;

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
    const dashboardContext = useDashboardContext();
    if (!dashboardContext.currentUser) return <div>you must be logged in to use this feature</div>;

    const [plans, { refetch }] = useQuery(getSetlistPlans, { userId: dashboardContext.currentUser.id });

    return <div className="SetlistPlannerDocumentOverviewList">
        {plans.map((dbPlan) => {
            return <div
                key={dbPlan.id}
                className="SetlistPlannerDocumentOverviewItem"
                onClick={() => {
                    props.onSelect(dbPlan);
                }}
            >
                <div className="name">{dbPlan.name}</div>
                <Markdown markdown={dbPlan.description} />
            </div>
        })}
    </div>;
};

const gDefaultCostCalcConfig: SetlistPlanCostPenalties = {
    // nearly hard requirements.
    underRehearsedSong: { mul: 999, add: 999 },
    maxPointsPerRehearsal: { mul: 899, add: 899 },
    overAllocatedSegment: { mul: 799, add: 799 },

    // // to be avoided, when the above have been satisfied.
    // nonClusteredAllocation: { mul: 63, add: 50 },
    // increasingAllocation: { mul: 61, add: 50 },

    // // nudges
    // delayedRehearsal: { mul: 9, add: 0 },
    // overRehearsedSong: { mul: 9, add: 0 },
    // lighterSongRehearsedBeforeHeavierSong: { mul: 9, add: 0 },
    // segmentUnderUtilized: { mul: 9, add: 0 },
    // underAllocatedSegment: { mul: 9, add: 0 },
    // fragmentedSong: { mul: 9, add: 0 },



    // to be avoided, when the above have been satisfied.
    nonClusteredAllocation: { mul: 9, add: 9 },
    increasingAllocation: { mul: 9, add: 9 },

    delayedRehearsal: { mul: 1, add: 1 },
    overRehearsedSong: { mul: 1, add: 1 },
    lighterSongRehearsedBeforeHeavierSong: { mul: 1, add: 1 },

    // trivial or non-existent penalties
    segmentUnderUtilized: { mul: 0, add: 0 },
    fragmentedSong: { mul: 0, add: 0 },
    underAllocatedSegment: { mul: 0, add: 0 },
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const SetlistPlannerPageContent = () => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const [upsertSetlistPlanToken] = useMutation(upsertSetlistPlan);
    const [deleteSetlistPlanToken] = useMutation(deleteSetlistPlan);
    const [showColorSchemeEditor, setShowColorSchemeEditor] = React.useState(false);

    const [autocompleteProgressState, setAutocompleteProgressState] = React.useState<AStarSearchProgressState<SetlistPlan>>();
    const cancellationTrigger = React.useRef<boolean>(false);

    const [costCalcConfig, setCostCalcConfig] = React.useState<SetlistPlanCostPenalties>(gDefaultCostCalcConfig);

    const confirm = useConfirm();

    if (!dashboardContext.currentUser) return <div>you must be logged in to use this feature</div>;
    const [doc, setDoc] = React.useState<SetlistPlan | null>(null);
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
        setNeighbors([]);
        setDoc(cleanCells(newDoc));
        setModified(setModifiedValue);
    };

    const docOrTempDoc = tempDoc || doc;
    const isTempDoc = !!tempDoc;

    const nullMutator: SetlistPlanMutator = {
        addColumn: () => { },
        addDivider: () => { },
        addSong: () => { },
        addAndRemoveSongs: () => { },
        clearAllocation: () => { },
        clearColumnAllocation: () => { },
        deleteColumn: () => { },
        deleteRow: () => { },
        reorderRows: () => { },
        setCellPoints: () => { },
        setColumnName: () => { },
        setColumnAvailablePoints: () => { },
        setDoc: () => { },
        setName: () => { },
        setDescription: () => { },
        setRowColor: () => { },
        setRowComment: () => { },
        setRowPointsRequired: () => { },
        swapColumnAllocation: () => { },
        autoCompletePlan: () => { },
        setAutocompleteMaxPointsPerRehearsal: () => { },
        setNotes: () => { },
        setColumnComment: () => { },
    };

    const mutator = React.useMemo(() => {
        const ret: SetlistPlanMutator = {
            autoCompletePlan: async () => {
                if (doc) {
                    // remove all 0 allocation cells.
                    const cleanedDoc = {
                        ...doc,
                        payload: {
                            ...doc.payload,
                            cells: doc.payload.cells.filter(x => !!x.pointsAllocated),
                        },
                    };
                    console.log(cleanedDoc);

                    cancellationTrigger.current = false;
                    //const sw = new Stopwatch();
                    const result = await AutoCompleteSetlistPlan(cleanedDoc, costCalcConfig, cancellationTrigger, (progressState) => {
                        //console.log(` iteration: ${progressState.iteration} best cost: ${progressState.bestCost}`);
                        setTempDoc(progressState.bestPlan);
                        setAutocompleteProgressState(progressState);
                    });

                    const newDoc = result.bestPlan;
                    newDoc.payload.autoCompleteDurationSeconds = result.durationSeconds;
                    newDoc.payload.autoCompleteDepth = result.depth;
                    newDoc.payload.autoCompleteIterations = result.iteration;

                    // console.log(`AutoCompleteSetlistPlan took ${sw.ElapsedMillis / 1000} seconds.`);

                    setAutocompleteProgressState(undefined);
                    setTempDoc(undefined);
                    setDocWrapper(newDoc);
                }
            },
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
            setCellPoints: (rowId: string, columnId: string, measure: number | undefined) => {
                if (doc) {
                    const exists = doc.payload.cells.find((x) => x.columnId === columnId && x.rowId === rowId);
                    const newSegmentSongs: SetlistPlanCell[] = doc.payload.cells.map((x) => {
                        if (x.columnId === columnId && x.rowId === rowId) {
                            return {
                                ...x,
                                //measureUsage: measure,
                                pointsAllocated: measure,
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
            setRowColor: (rowId: string, color: string) => {
                if (doc) {
                    setDocWrapper({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: doc.payload.rows.map((x) => {
                                if (x.rowId === rowId) {
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
        };
        return ret;
    }, [doc]);

    return <div className="SetlistPlannerPageContent">
        {doc ? <SetlistPlannerDocumentEditor
            initialValue={doc}
            tempValue={tempDoc}
            costCalcConfig={costCalcConfig}
            mutator={mutator}
            colorScheme={colorScheme}
            isModified={modified}
            onSave={async (doc) => {
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
                setDoc(CreateNewSetlistPlan(getUniqueNegativeID(), `Setlist plan ${nanoid(3)}`, dashboardContext.currentUser!.id));
            }}>Create New Plan</Button>
        </div>
        }

        <div style={{ display: "flex", flexDirection: "column" }}>
            <FormControlLabel control={<Switch checked={showColorSchemeEditor} onChange={(e) => setShowColorSchemeEditor(e.target.checked)} />} label="Edit Color Scheme" />
            {showColorSchemeEditor &&
                <SetlistPlannerColorSchemeEditor value={colorScheme} onChange={(newScheme) => setColorScheme(newScheme)} />
            }

            {isTempDoc && <h1>TEMP</h1>}

            {doc && <>
                <Button onClick={() => {
                    const n = SetlistPlanGetNeighbors(doc, 1, false);
                    n.sort((a, b) => {
                        const aCost = CalculateSetlistPlanCost(a, costCalcConfig);
                        const bCost = CalculateSetlistPlanCost(b, costCalcConfig);
                        return aCost.totalCost - bCost.totalCost;
                    });
                    setNeighbors([doc, ...n]);
                    console.log(n);
                }}>gen neighbors (depth=1)</Button>

                <Button onClick={() => {
                    const n = SetlistPlanGetNeighbors(doc, doc.payload.rows.length, true);
                    n.sort((a, b) => {
                        const aCost = CalculateSetlistPlanCost(a, costCalcConfig);
                        const bCost = CalculateSetlistPlanCost(b, costCalcConfig);
                        return aCost.totalCost - bCost.totalCost;
                    });
                    setNeighbors([doc, ...n]);
                    console.log(n);
                }}>gen neighbors (depth=N)</Button>
            </>
            }
            <ul>
                {neighbors.map((neighbor, index) => {
                    const cost = CalculateSetlistPlanCost(neighbor, costCalcConfig);
                    return <li className="interactable" key={neighbor.id} onClick={() => {
                        setDoc(neighbor);
                    }}>#{index}: {neighbor.name} cost:{cost.totalCost} key:{GetSetlistPlanKey(neighbor).substring(0, 100)}</li>;
                })}
            </ul>

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
                <div>Best Cost: {autocompleteProgressState?.bestCost.toFixed(2)}</div>
                <div>Depth: {autocompleteProgressState?.depth}</div>
            </div>
        </Backdrop>
    </div>
};

const SetlistPlannerPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Setlist Planner" basePermission={Permission.sysadmin}>
            <SongsProvider>
                <SetlistPlannerPageContent />
            </SongsProvider>
        </DashboardLayout>
    )
}

export default SetlistPlannerPage;
