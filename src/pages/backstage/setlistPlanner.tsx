import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Button, ButtonGroup, Tooltip } from "@mui/material";
import { nanoid } from "nanoid";
import React from "react";
import { Permission } from "shared/permissions";
import { getUniqueNegativeID, moveItemInArray } from "shared/utils";
import { CMStandardDBChip } from "src/core/components/CMChip";
import { InspectObject } from "src/core/components/CMCoreComponents";
import { KeyValueTable } from "src/core/components/CMCoreComponents2";
import { CMNumericTextField, CMTextInputBase } from "src/core/components/CMTextField";
import { useConfirm } from "src/core/components/ConfirmationDialog";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { Markdown3Editor } from "src/core/components/MarkdownControl3";
import { Markdown } from "src/core/components/RichTextEditor";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { SongAutocomplete } from "src/core/components/SongAutocomplete";
import { SongsProvider, useSongsContext } from "src/core/components/SongsContext";
import { CMTab, CMTabPanel } from "src/core/components/TabPanel";
import { gIconMap } from "src/core/db3/components/IconMap";
import deleteSetlistPlan from "src/core/db3/mutations/deleteSetlistPlan";
import upsertSetlistPlan from "src/core/db3/mutations/upsertSetlistPlan";
import getSetlistPlans from "src/core/db3/queries/getSetlistPlans";
import { CreateNewSetlistPlan, SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import * as ReactSmoothDnd from "react-smooth-dnd";

interface SetlistPlanMutator {
    setName: (name: string) => void;
    setDescription: (description: string) => void;

    addSong: (songId: number) => void;
    deleteSong: (songId: number) => void;
    setSongMeasureRequired: (songId: number, measure: number | undefined) => void;
    setSongComment: (songId: number, comment: string) => void;
    reorderSongs: (args: ReactSmoothDnd.DropResult) => void;

    addSegment: () => void;
    deleteSegment: (segmentId: number) => void;
    setSegmentName: (segmentId: number, name: string) => void;
    setSegmentComment: (segmentId: number, comment: string) => void;
    setSegmentMeasureTotal: (segmentId: number, total: number | undefined) => void;

    setSongSegmentMeasure: (songId: number, segmentId: number, measure: number | undefined) => void;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// specific input control which
// - allows null values (appears empty)
// - clicking in the field selects all of its text, for 1-keypress single-digit entry.
// - up/down arrow keys will incrument / decrement the value to the nearest fibonnaci number.

// i'm thinking:
// 1 point = just playing through a song once, probably 8 minutes total
// 2 points = playing through a song twice, or needing some brush up. ~16 minutes
// 3 points = a pretty quick runthrough, 24 minutes
// 5 points = a strong rehearsal, 40 minutes
// 8 points = a long rehearsal, 64 minutes
// 13 = effectively an entire rehearsal, 104 minutes. (1 hour 44 minutes).

// a 2-hour rehearsal supports about 15 points

type NumberFieldProps = {
    value: number | null;
    onChange?: (e: React.ChangeEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>, newValue: number | null) => void;
    className?: string;
    readonly?: boolean;
    style?: React.CSSProperties;
};

// Pre-generate Fibonacci numbers up to a certain max (adjust as needed)
const generateFibonacci = (max: number): number[] => {
    const fibs = [0, 1];
    while (true) {
        const next = fibs[fibs.length - 2]! + fibs[fibs.length - 1]!;
        if (next > max) break;
        fibs.push(next);
    }
    return fibs;
};

// For demonstration, we go up to 100000
const FIBONACCI_SEQUENCE = generateFibonacci(100000);

const NumberField = (props: NumberFieldProps) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // If there's no numeric value, treat it like 0 for arrow handling
        const currentValue = props.value ?? 0;

        if (e.key === "ArrowUp") {
            e.preventDefault();
            // Find first Fibonacci number that is strictly greater than currentValue
            const nextFib = FIBONACCI_SEQUENCE.find((fib) => fib > currentValue);
            if (nextFib != null && props.onChange) {
                props.onChange(e, nextFib);
            } else {
                // If currentValue is already above our max precomputed Fibonacci,
                // do nothing or handle it in another way
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            // Find the largest Fibonacci <= currentValue (previous Fib)
            // One approach is to find the index of the first Fibonacci that is >= currentValue,
            // then take one step back
            const idx = FIBONACCI_SEQUENCE.findIndex((fib) => fib >= currentValue);
            if (idx > 0 && props.onChange) {
                props.onChange(e, FIBONACCI_SEQUENCE[idx - 1]!);
            }
        }
    };

    // Standard onChange text -> number (or null) logic
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value ? parseInt(e.target.value) : null;
        props.onChange && props.onChange(e, isNaN(newValue as number) ? null : newValue);
    };

    return (
        <input
            type="text"
            ref={inputRef}
            value={props.value === null ? "" : props.value}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            className={`NumberField ${props.readonly ? "readonly" : "editable"} ${props.className}`}
            readOnly={props.readonly}
            style={props.style}
        />
    );
};


//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerMatrixRowProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    songId: number;
};

const SetlistPlannerMatrixRow = (props: SetlistPlannerMatrixRowProps) => {
    const allSongs = useSongsContext().songs;
    const dashboardContext = useDashboardContext();
    const segMeasures = props.doc.payload.segmentSongs.filter((x) => x.songId === props.songId && !!x.measureUsage);
    const totalRehearsalPoints = segMeasures.reduce((acc, x) => acc + x.measureUsage!, 0);
    const song = props.doc.payload.songs.find((x) => x.songId === props.songId)!;
    const balance = song.measureRequired ? totalRehearsalPoints - song.measureRequired : null;
    return <div className="tr">
        <div className="td songName">

            <div className="dragHandle draggable">
                ☰
            </div>

            <NumberField
                value={song.measureRequired || null}
                onChange={(e, newValue) => { props.mutator.setSongMeasureRequired(props.songId, newValue || undefined) }}
            />
            {allSongs.find((x) => x.id === props.songId)?.name}
        </div>
        {props.doc.payload.segments.map((segment, index) => {
            return <div key={index} className="td segment">
                <NumberField
                    value={props.doc.payload.segmentSongs.find((x) => x.segmentId === segment.segmentId && x.songId === props.songId)?.measureUsage || null}
                    onChange={(e, newValue) => {
                        props.mutator.setSongSegmentMeasure(props.songId, segment.segmentId, newValue || undefined);
                    }}
                />
            </div>;
        })}
        <div className="td rehearsalTime"><NumberField readonly value={totalRehearsalPoints} /></div>
        <div className="td balance"><NumberField readonly value={balance} /></div>
    </div>;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerMatrixProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
};

const SetlistPlannerMatrix = (props: SetlistPlannerMatrixProps) => {
    const allSongs = useSongsContext().songs;
    const dashboardContext = useDashboardContext();

    const getSegmentTotal = (segmentId: number) => {
        const segMeasures = props.doc.payload.segmentSongs.filter((x) => x.segmentId === segmentId && !!x.measureUsage);
        return segMeasures.reduce((acc, x) => acc + x.measureUsage!, 0);
    };

    // returns the measure/point balance for a segment (total minus points used for all songs in this segment)
    const getSegmentBalance = (segmentId: number) => {//
        const segmentMeasureTotal = props.doc.payload.segments.find((x) => x.segmentId === segmentId)?.measureTotal || 0;
        const segmentMeasureUsed = props.doc.payload.segmentSongs.filter((x) => x.segmentId === segmentId && !!x.measureUsage).reduce((acc, x) => acc + x.measureUsage!, 0);
        return segmentMeasureTotal - segmentMeasureUsed;
    };

    const songTotalPointsRequired = props.doc.payload.songs.reduce((acc, song) => song.measureRequired ? acc + song.measureRequired : acc, 0);

    const getTotalPointsUsed = () => {
        return props.doc.payload.segmentSongs.reduce((acc, x) => acc + (x.measureUsage || 0), 0);
    };

    // total point balance for the whole plan
    const getTotalPlanBalance = () => {
        // total points required
        return getTotalPointsUsed() - songTotalPointsRequired;
    };

    // number of songs with non-zero measure points per segment.
    const songsPerSegment = (() => {
        const totalSongs = props.doc.payload.segmentSongs.filter(ss => !!ss.measureUsage).length;
        return totalSongs / props.doc.payload.segments.length;
    })();

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        props.mutator.reorderSongs(args);
    };


    return <div className="SetlistPlannerMatrix">
        <div className="tr header">
            <div className="td songName"></div>
            {props.doc.payload.segments.map((segment, index) => <div key={index} className="td segment">
                <div>{segment.name}</div>
                <div><NumberField
                    value={segment.measureTotal || null}
                    onChange={(e, newValue) => {
                        props.mutator.setSegmentMeasureTotal(segment.segmentId, newValue || undefined);
                    }}
                /></div>
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
                {props.doc.payload.songs.map((song, index) => <ReactSmoothDndDraggable key={index}>
                    <SetlistPlannerMatrixRow
                        mutator={props.mutator}
                        key={index}
                        doc={props.doc}
                        songId={song.songId}
                    />
                </ReactSmoothDndDraggable>
                )}
            </ReactSmoothDndContainer>
        </div>

        <div className="tr footer">
            <div className="td songName"><NumberField readonly value={songTotalPointsRequired} /></div>
            {props.doc.payload.segments.map((segment, index) => <Tooltip disableInteractive title={`total points used for ${segment.name}`}><div key={index} className="td segment">
                <NumberField value={getSegmentTotal(segment.segmentId)} readonly />
            </div></Tooltip>)}
            <Tooltip disableInteractive title={`total points used in the whole plan`}><div className="td rehearsalTime"><NumberField value={getTotalPointsUsed()} readonly /></div></Tooltip>
            <Tooltip disableInteractive title={`total point balance for the whole plan`}><div className="td balance"><NumberField readonly value={getTotalPlanBalance()} /></div></Tooltip>
        </div>

        <div className="tr footer">
            <div className="td songName"></div>
            {props.doc.payload.segments.map((segment, index) => <Tooltip disableInteractive title={`point balance for ${segment.name}`}><div key={index} className="td segment">
                <NumberField readonly value={getSegmentBalance(segment.segmentId)} />
            </div></Tooltip>)}
            <div className="td rehearsalTime"></div>
            <div className="td balance"></div>
        </div>

        <KeyValueTable
            data={{
                "songs per rehearsal": songsPerSegment,
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
        </div>

    </div>;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerDocumentEditorProps = {
    isModified: boolean;
    initialValue: SetlistPlan;
    mutator: SetlistPlanMutator;
    onSave: (doc: SetlistPlan) => void;
    onCancel: () => void;
    onDelete: () => void;
};

type TTabId = "plan" | "segments" | "songs" | "matrix";

const SetlistPlannerDocumentEditor = (props: SetlistPlannerDocumentEditorProps) => {
    const [doc, setDoc] = React.useState<SetlistPlan>(props.initialValue);
    const [selectedTab, setSelectedTab] = React.useState<TTabId>("matrix");
    const allSongs = useSongsContext().songs;
    React.useEffect(() => {
        setDoc(props.initialValue);
    }, [props.initialValue]);
    return <div className="SetlistPlannerDocumentEditor">
        <div className="toolbar">
            <ButtonGroup>
                <Button
                    startIcon={gIconMap.Save()}
                    onClick={() => {
                        props.onSave(doc);
                    }}
                    disabled={!props.isModified}
                >
                    Save
                </Button>
                <Button startIcon={gIconMap.Cancel()} onClick={() => {
                    props.onCancel();
                }}>Cancel</Button>
                <Button
                    startIcon={gIconMap.Delete()}
                    onClick={() => {
                        props.onDelete();
                    }}
                    disabled={doc.id < 0}
                >
                    Delete
                </Button>
            </ButtonGroup>
            <InspectObject src={doc} />
            <div className="nameHeader">{doc.name}</div>
        </div>
        <CMTabPanel
            className="SetlistPlannerDocumentEditorTabPanel"
            handleTabChange={(x, newId) => setSelectedTab(newId as TTabId || "matrix")}
            selectedTabId={selectedTab}
        >
            <CMTab thisTabId="plan" summaryTitle={"plan"}>
                <CMTextInputBase
                    className="name"
                    value={doc.name}
                    onChange={(e, newName) => {
                        props.mutator.setName(newName);
                    }}
                />
                <Markdown3Editor
                    onChange={(newMarkdown) => {
                        props.mutator.setDescription(newMarkdown);
                    }}
                    value={doc.description}
                    beginInPreview={true}
                />
            </CMTab>

            <CMTab thisTabId="segments" summaryTitle={"segments"}>

                <div className="SetlistPlannerDocumentEditorSegments">
                    {doc.payload.segments.map((segment) => {
                        return <div key={segment.segmentId} className="SetlistPlannerDocumentEditorSegment">
                            <CMTextInputBase
                                className="segmentName"
                                value={segment.name}
                                onChange={(e, newName) => {
                                    props.mutator.setSegmentName(segment.segmentId, newName);
                                }}
                            />
                            <Markdown3Editor
                                onChange={(newMarkdown) => {
                                    props.mutator.setSegmentComment(segment.segmentId, newMarkdown);
                                }}
                                value={segment.commentMarkdown || ""}
                                beginInPreview={true}
                            />
                            <Button startIcon={gIconMap.Delete()} onClick={() => {
                                props.mutator.deleteSegment(segment.segmentId);
                            }}
                            ></Button>
                        </div>
                    })}
                </div>

                <Button startIcon={gIconMap.Add()} onClick={() => {
                    props.mutator.addSegment();
                }}>Add Segment</Button>

            </CMTab>
            <CMTab thisTabId="songs" summaryTitle={"songs"}>
                <div className="SetlistPlannerDocumentEditorSongs">
                    {doc.payload.songs.map((song) => {
                        return <div key={song.songId} className="SetlistPlannerDocumentEditorSong">
                            <div className="name">{allSongs.find((x) => x.id === song.songId)?.name}</div>
                            <NumberField
                                value={song.measureRequired || null}
                                onChange={(e, newMeasure) => {
                                    props.mutator.setSongMeasureRequired(song.songId, newMeasure || undefined);
                                }}
                            />
                            <Markdown3Editor
                                onChange={(newMarkdown) => {
                                    props.mutator.setSongComment(song.songId, newMarkdown);
                                }}
                                value={song.commentMarkdown || ""}
                                beginInPreview={true}
                            />
                            <Button startIcon={gIconMap.Delete()} onClick={() => {
                                props.mutator.deleteSong(song.songId);
                            }}
                            ></Button>
                        </div>
                    })}
                </div>

                <div className="SetlistPlannerDocumentEditorAddSong">
                    Add...
                    <SongAutocomplete
                        value={null}
                        onChange={(newSong) => {
                            if (newSong) {
                                props.mutator.addSong(newSong.id);
                            }
                        }}
                    />
                </div>

            </CMTab>
            <CMTab thisTabId="matrix" summaryTitle={"Matrix"}>
                <SetlistPlannerMatrix
                    doc={doc}
                    mutator={props.mutator}
                />
            </CMTab>
        </CMTabPanel>
    </div>
};


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


//////////////////////////////////////////////////////////////////////////////////////////////////
const SetlistPlannerPageContent = () => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const [upsertSetlistPlanToken] = useMutation(upsertSetlistPlan);
    const [deleteSetlistPlanToken] = useMutation(deleteSetlistPlan);
    const confirm = useConfirm();

    if (!dashboardContext.currentUser) return <div>you must be logged in to use this feature</div>;
    const [doc, setDoc] = React.useState<SetlistPlan | null>(null);
    const [modified, setModified] = React.useState(false);

    const mutator = React.useMemo(() => {
        const ret: SetlistPlanMutator = {
            setName: (name: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        name,
                    });
                }
            },
            setDescription: (description: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        description,
                    });
                }
            },
            addSong: (songId: number) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            songs: [...doc.payload.songs, {
                                songId,
                                measureRequired: 0,
                                commentMarkdown: "",
                            }],
                        },
                    });
                }
            },
            deleteSong: (songId: number) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            songs: doc.payload.songs.filter((x) => x.songId !== songId),
                        },
                    });
                }
            },
            setSongMeasureRequired: (songId: number, measure: number | undefined) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            songs: doc.payload.songs.map((x) => {
                                if (x.songId === songId) {
                                    return {
                                        ...x,
                                        measureRequired: measure,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            setSongComment: (songId: number, comment: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            songs: doc.payload.songs.map((x) => {
                                if (x.songId === songId) {
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
            addSegment: () => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segments: [...doc.payload.segments, {
                                segmentId: doc.payload.segments.length + 1,
                                measureTotal: 0,
                                name: `New Segment ${nanoid(3)}`,
                                commentMarkdown: "",
                            }],
                        },
                    });
                }
            },
            deleteSegment: (segmentId: number) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segments: doc.payload.segments.filter((x) => x.segmentId !== segmentId),
                        },
                    });
                }
            },
            setSegmentName: (segmentId: number, name: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segments: doc.payload.segments.map((x) => {
                                if (x.segmentId === segmentId) {
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
            setSegmentComment: (segmentId: number, comment: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segments: doc.payload.segments.map((x) => {
                                if (x.segmentId === segmentId) {
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
            setSongSegmentMeasure: (songId: number, segmentId: number, measure: number | undefined) => {
                if (doc) {
                    setModified(true);
                    const exists = doc.payload.segmentSongs.find((x) => x.segmentId === segmentId && x.songId === songId);
                    const newSegmentSongs = doc.payload.segmentSongs.map((x) => {
                        if (x.segmentId === segmentId && x.songId === songId) {
                            return {
                                ...x,
                                measureUsage: measure,
                            };
                        }
                        return x;
                    });

                    // if there's no entry in segmentSongs yet, create one.
                    if (!exists) {
                        newSegmentSongs.push({
                            segmentId,
                            songId,
                            measureUsage: measure,
                            commentMarkdown: "",
                        });
                    }

                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segmentSongs: newSegmentSongs,
                        },
                    });
                }
            },
            setSegmentMeasureTotal: (segmentId: number, total: number | undefined) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segments: doc.payload.segments.map((x) => {
                                if (x.segmentId === segmentId) {
                                    return {
                                        ...x,
                                        measureTotal: total,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            reorderSongs: (args: ReactSmoothDnd.DropResult) => {
                if (doc) {
                    setModified(true);
                    // removedIndex is the previous index; the original item to be moved
                    // addedIndex is the new index where it should be moved to.
                    if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
                    const newSongs = moveItemInArray(doc.payload.songs, args.removedIndex, args.addedIndex);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            songs: newSongs,
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
            mutator={mutator}
            isModified={modified}
            onSave={async (doc) => {
                snackbar.invokeAsync(async () => {
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
                    snackbar.invokeAsync(async () => {
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
