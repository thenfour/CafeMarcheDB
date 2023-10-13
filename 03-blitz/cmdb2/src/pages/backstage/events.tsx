import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { EventSummary, RehearsalSummary } from "src/core/components/CMMockupComponents";
import { EventDetail } from "src/core/components/EventComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React, { FC, Suspense } from "react"
import { Button, Chip, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, InputBase, TextField } from "@mui/material";
import {
    Add as AddIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard, EventDetailVerbosity, InspectObject, ReactiveInputDialog } from "src/core/components/CMCoreComponents";
import { API } from "src/core/db3/clientAPI";
import { RenderMuiIcon, gIconMap } from "src/core/db3/components/IconSelectDialog";
import { DB3NewObjectDialog } from "src/core/db3/components/db3NewObjectDialog";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { gQueryOptions } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";

// effectively there are a couple variants of an "event":
// x 1. grid row, for admins
// x 2. card view, for pretty display on home page. not actionable
// x 3. summary view, on events page to give an overview of the status, musicians, attendees, files, etc.
// - 4. detail view, on its own page, for giving full information
// - 5. EDIT view

// let's think also about status. "confirmed" has always been a confusing thing.
// - "new": exists
// - "waiting for agreement" approvals: waiting for some
// - "waiting for musicians" approved or no approval needed
// - musicians: waiting for some
// - "It will happen!" enough musicians - requires another manual step
// - "Happening now"
// - "Done"
// - "Cancelled"

// approvals - there need to be multiple approvals.
// 1. agreement to pursue the event
// 2. 

// NO approvals, because
// 1. it clogs up the GUI
// 2. only 3 people use it, and requires everyone to be diligent
// 3. adoption uncertain
// 4. small impact overall
// therefore: too much investment

function toggleValueInArray(array: number[], id: number): number[] {
    const index = array.indexOf(id);
    if (index === -1) {
        array.push(id);
    } else {
        array.splice(index, 1);
    }
    return array;
}

const NewEventDialogWrapper = ({ onCancel, onOK }: { onCancel: () => void, onOK: () => void }) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEvent,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 150 }),
            new DB3Client.SlugColumnClient({ columnName: "slug", cellWidth: 150 }),
            //new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
            //new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
            //new DB3Client.GenericStringColumnClient({ columnName: "locationDescription", cellWidth: 150 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "locationURL", cellWidth: 150 }),
            //new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 150 }),
            new DB3Client.ForeignSingleFieldClient<db3.EventTypePayload>({ columnName: "type", cellWidth: 150, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.ForeignSingleFieldClient<db3.EventStatusPayload>({ columnName: "status", cellWidth: 150, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.TagsFieldClient<db3.EventTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            //new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120 }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
        ],
    });

    const handleOK = (obj, tableClient) => {
        tableClient.doInsertMutation(obj).then((newRow) => {
            showSnackbar({ children: "insert successful", severity: 'success' });
        }).catch(err => {
            //console.log(err);
            showSnackbar({ children: "insert error", severity: 'error' });
            throw err;
        }).finally(() => {
            if (tableClient.refetch) {
                console.log(`refetching`);
                tableClient.refetch();
            }
        });
        onOK();
    };

    return <DB3NewObjectDialog
        clientIntention={{
            intention: "user",
            customContext: {
                type: db3.xTableClientUsageCustomContextType.UserInsertDialog,
            },
            mode: 'primary'
        }}
        onCancel={onCancel}
        onOK={handleOK}
        table={tableSpec}
    />;
};

const NewEventButton = (props: { onOK: () => void }) => {
    const [open, setOpen] = React.useState<boolean>(false);
    return <>
        <Button onClick={() => setOpen(true)}>{gIconMap.Add()} New event</Button>
        {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
            {/* <NewEventDialogContent onCancel={() => setOpen(false)} onOK={() => setOpen(false)} /> */}
            <NewEventDialogWrapper
                onCancel={
                    () => {
                        setOpen(false);
                    }}
                onOK={() => {
                    setOpen(false);
                    props.onOK();
                }} />
        </ReactiveInputDialog>}
    </>;
};

/// there's a problem with showing calendars.
// while it does show a cool overview, interactivity is a problem.
// 1. how many months? each month is very awkward on screen space.
// 2. interactivity? you can't actually display any info per-day, so interactivity is important but then it massively complicates things.
// therefore: no calendars for the moment.
interface EventsControlsSpec {
    recordCount: number;
    quickFilter: string;
    tagFilter: number[];
    statusFilter: number[];
    typeFilter: number[];
    verbosity: EventDetailVerbosity;
    refreshSerial: number; // increment this in order to trigger a refetch
};

interface EventsControlsProps {
    spec: EventsControlsSpec;
    onChange: (value: EventsControlsSpec) => void;
};
const EventsControls = (props: EventsControlsProps) => {

    const [popularTags, { refetch }] = API.events.usePopularEventTagsQuery();
    //console.log(popularTags);

    const statusesClient = API.events.getEventStatusesClient();
    const typesClient = API.events.getEventTypesClient();

    const setFilterText = (quickFilter: string) => {
        const newSpec: EventsControlsSpec = { ...props.spec, quickFilter };
        props.onChange(newSpec);
    };

    const setRecordCount = (recordCount: number) => {
        const newSpec: EventsControlsSpec = { ...props.spec, recordCount };
        props.onChange(newSpec);
    };

    const setVerbosity = (verbosity: EventDetailVerbosity) => {
        const newSpec: EventsControlsSpec = { ...props.spec, verbosity };
        props.onChange(newSpec);
    };

    const toggleTag = (tagId: number) => {
        const newSpec: EventsControlsSpec = { ...props.spec };
        newSpec.tagFilter = toggleValueInArray(newSpec.tagFilter, tagId);
        props.onChange(newSpec);
    };

    const toggleStatus = (id: number) => {
        const newSpec: EventsControlsSpec = { ...props.spec };
        newSpec.statusFilter = toggleValueInArray(newSpec.statusFilter, id);
        props.onChange(newSpec);
    };

    const toggleType = (id: number) => {
        const newSpec: EventsControlsSpec = { ...props.spec };
        newSpec.typeFilter = toggleValueInArray(newSpec.typeFilter, id);
        props.onChange(newSpec);
    };

    // FILTER: [upcoming] [past] [concert] [rehearsals] [majorettes] [__________________]
    // SHOW:   [compact] [default] [full] [verbose]
    // 20 100 all
    return <div className="eventsControls">
        <div className="row">
            <div className="caption">FILTER</div>
            <div className="tagList">
                status: <CMChipContainer>
                    {(statusesClient.items as db3.EventStatusPayload[]).filter(i => i.events.length > 0).map(status => (
                        <CMChip
                            key={status.id}
                            selected={props.spec.statusFilter.some(id => id === status.id)}
                            onClick={() => toggleStatus(status.id)}
                            color={status.color}
                        >
                            {RenderMuiIcon(status.iconName)}{status.label} ({status.events.length})
                        </CMChip>
                    ))}
                </CMChipContainer>

                event type: <CMChipContainer>
                    {(typesClient.items as db3.EventTypePayload[]).filter(i => i.events.length > 0).map(type => (
                        <CMChip
                            key={type.id}
                            selected={props.spec.typeFilter.some(id => id === type.id)}
                            onClick={() => toggleType(type.id)}
                            color={type.color}
                        >
                            {RenderMuiIcon(type.iconName)}{type.text} ({type.events.length})
                        </CMChip>
                    ))}
                </CMChipContainer>

                tags:
                <CMChipContainer>
                    {popularTags.filter(t => t.events.length > 0).map(tag => (
                        <CMChip
                            key={tag.id}
                            selected={props.spec.tagFilter.some(id => id === tag.id)}
                            onClick={() => toggleTag(tag.id)}
                            color={tag.color}
                        >
                            {tag.text} ({tag.events.length})
                        </CMChip>
                    ))}
                </CMChipContainer>

                <InputBase
                    size="small"
                    placeholder="Filter"
                    sx={{
                        backgroundColor: "#f0f0f0",
                        borderRadius: 3,
                    }}
                    value={props.spec.quickFilter}
                    onChange={(e) => setFilterText(e.target.value)}
                    startAdornment={<SearchIcon />}
                />

            </div>
        </div>
        <div className="row">
            <div className="caption">SHOW</div>
            <CMChipContainer>
                <CMChip selected={props.spec.verbosity === "compact"} onClick={() => setVerbosity("compact")}>Compact</CMChip>
                <CMChip selected={props.spec.verbosity === "default"} onClick={() => setVerbosity("default")}>Default</CMChip>
                <CMChip selected={props.spec.verbosity === "verbose"} onClick={() => setVerbosity("verbose")}>Full</CMChip>
            </CMChipContainer>
        </div>
        <div className="row">
            <div className="caption">#</div>
            <CMChipContainer>
                <CMChip selected={props.spec.recordCount === 5} onClick={() => setRecordCount(5)}>5</CMChip>
                <CMChip selected={props.spec.recordCount === 20} onClick={() => setRecordCount(20)}>20</CMChip>
                <CMChip selected={props.spec.recordCount === 100} onClick={() => setRecordCount(100)}>100</CMChip>
            </CMChipContainer>
        </div>

    </div>;
};

interface EventsListArgs {
    // in order for callers to be able to tell this to refetch, just increment a value in the filter
    filterSpec: EventsControlsSpec,
};

const EventsList = ({ filterSpec }: EventsListArgs) => {
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const filterModel: db3.CMDBTableFilterModel = {
        quickFilterValues: filterSpec.quickFilter.split(/\s+/).filter(token => token.length > 0),
        items: [],
        tagIds: filterSpec.tagFilter,
        tableParams: {
            eventTypeIds: filterSpec.typeFilter,
            eventStatusIds: filterSpec.statusFilter,
        }
    };
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;
    const where = db3.xEventVerbose.CalculateWhereClause({
        filterModel,
        clientIntention,
    });
    const include = db3.xEventVerbose.CalculateInclude(clientIntention);
    const eventsClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xEventVerbose,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.TagsFieldClient<db3.EventTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            ],
        }),
        filterModel: {
            quickFilterValues: filterSpec.quickFilter.split(/\s+/).filter(token => token.length > 0),
            items: [],
            tagIds: filterSpec.tagFilter,
            tableParams: {
                eventTypeIds: filterSpec.typeFilter,
                eventStatusIds: filterSpec.statusFilter,
            }
        },
        paginationModel: {
            page: 0,
            pageSize: filterSpec.recordCount,
        },
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        queryOptions: gQueryOptions.liveData,
    });

    React.useEffect(() => {
        eventsClient.refetch();
    }, [filterSpec]);

    return <>
        <InspectObject src={where} tooltip={`inspect where clause for events query`} />
        <InspectObject src={include} tooltip={`inspect include clause for events query`} />
        <InspectObject src={eventsClient.items} tooltip={`inspect events raw results`} />
        {eventsClient.items.map(event => <EventDetail key={event.id} event={event as db3.EventClientPayload_Verbose} tableClient={eventsClient} verbosity={filterSpec.verbosity} allowRouterPush={false} />)}
    </>;
};

const MainContent = () => {
    if (!useAuthorization("events page", Permission.view_events)) {
        throw new Error(`unauthorized`);
    }

    const [controlSpec, setControlSpec] = React.useState<EventsControlsSpec>({
        recordCount: 20,
        quickFilter: "",
        tagFilter: [],
        verbosity: "default",
        statusFilter: [],
        typeFilter: [],
        refreshSerial: 0,
    });

    const handleSpecChange = (value: EventsControlsSpec) => {
        setControlSpec(value);
    };

    return <div className="eventsMainContent">

        <Suspense>
            <SettingMarkdown settingName="events_markdown"></SettingMarkdown>
        </Suspense>

        <Suspense>
            <CMSinglePageSurfaceCard>
                {/* showing {eventsClient.items.length} events */}
                <EventsControls onChange={handleSpecChange} spec={controlSpec} />
            </CMSinglePageSurfaceCard>
        </Suspense>

        <NewEventButton onOK={() => {
            setControlSpec({ ...controlSpec, refreshSerial: controlSpec.refreshSerial + 1 });
        }} />

        <Suspense>
            <EventsList filterSpec={controlSpec} />
        </Suspense>
        {/* 
            <RehearsalSummary asArnold={true} asDirector={false} finalized={true} past={true} />
            <EventSummary asArnold={true} asDirector={true} finalized={true} past={true} />
            <EventSummary asArnold={false} asDirector={false} finalized={false} past={true} />
            <RehearsalSummary asArnold={true} asDirector={false} finalized={true} past={true} />
            <RehearsalSummary asArnold={true} asDirector={false} finalized={true} past={true} />
            <EventSummary asArnold={false} asDirector={false} finalized={true} past={true} />

            <EventSummary asArnold={true} asDirector={false} finalized={true} past={false} />
            <EventSummary asArnold={true} asDirector={true} finalized={true} past={false} />
            <EventSummary asArnold={false} asDirector={false} finalized={false} past={false} />
            <EventSummary asArnold={false} asDirector={false} finalized={true} past={false} /> */}
    </div>;
};

const ViewEventsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Events">
            <MainContent />
        </DashboardLayout>
    )
}

//ViewEventsPage.suppressFirstRenderFlicker = true;

export default ViewEventsPage;
