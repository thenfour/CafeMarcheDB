import { BlitzPage } from "@blitzjs/next";
import {
    Search as SearchIcon
} from '@mui/icons-material';
import { Button, DialogActions, DialogContent, DialogTitle, InputBase } from "@mui/material";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { TAnyModel, gQueryOptions, toggleValueInArray } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard, ReactiveInputDialog } from "src/core/components/CMCoreComponents";
import { EventAttendanceControl } from "src/core/components/EventAttendanceComponents";
import { EventDetailContainer, EventDetailFull, EventTableClientColumns } from "src/core/components/EventComponents";
import { CalculateEventMetadata } from "src/core/components/EventComponentsBase";
import { EventSegmentClientColumns } from "src/core/components/EventSegmentComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { VisibilityControl } from "src/core/components/VisibilityControl";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { RenderMuiIcon, gIconMap } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import { TinsertEventArgs } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

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

interface NewEventDialogProps {
    onCancel: () => void;
    onOK: () => void;
};

const NewEventDialogWrapper = (props: NewEventDialogProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const router = useRouter();
    const mut = API.events.newEventMutation.useToken();
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    // EVENT table bindings
    const eventTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEvent,
        columns: [
            EventTableClientColumns.id,
            EventTableClientColumns.name,
            EventTableClientColumns.slug,
            EventTableClientColumns.type,
            EventTableClientColumns.status,
            EventTableClientColumns.tags,
            //EventTableClientColumns.segmentBehavior,
            EventTableClientColumns.expectedAttendanceUserTag,
            EventTableClientColumns.visiblePermission,
        ],
    });

    // necessary to connect all the columns in the spec.
    const eventTableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec: eventTableSpec,
    });

    const [eventValue, setEventValue] = React.useState<db3.EventPayload>(db3.xEvent.createNew(clientIntention));

    const eventAPI: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...eventValue, ...fieldValues };
            setEventValue(newValue);
        },
    };

    const eventValidationResult = eventTableSpec.args.table.ValidateAndComputeDiff(eventValue, eventValue, "new", clientIntention);


    // EVENT SEGMENT BINDINGS
    const segmentTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSegment,
        columns: [
            EventSegmentClientColumns.id,
            EventSegmentClientColumns.dateRange,
        ],
    });

    // necessary to connect all the columns in the spec.
    const segmentTableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec: segmentTableSpec,
    });

    const [segmentValue, setSegmentValue] = React.useState<db3.EventSegmentPayload>(db3.xEventSegment.createNew(clientIntention));

    const segmentAPI: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...segmentValue, ...fieldValues };
            setSegmentValue(newValue);
        },
    };

    const segmentValidationResult = segmentTableSpec.args.table.ValidateAndComputeDiff(segmentValue, segmentValue, "new", clientIntention);

    const handleSaveClick = () => {
        const payload: TinsertEventArgs = {
            event: eventTableClient.prepareInsertMutation(eventValue),
            segment: segmentTableClient.prepareInsertMutation(segmentValue),
        };
        mut.invoke(payload).then((ret) => {
            showSnackbar({ children: "insert successful", severity: 'success' });
            props.onOK();

            void router.push(API.events.getURIForEvent(ret.event.id, ret.event.slug));

        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "insert error", severity: 'error' });
        });
    };

    const renderColumn = (table: DB3Client.xTableClientSpec, colName: string, row: TAnyModel, validationResult: db3.ValidateAndComputeDiffResult, api: DB3Client.NewDialogAPI) => {
        return table.getColumn(colName).renderForNewDialog!({ key: colName, row, validationResult, api, value: row[colName], clientIntention });
    };

    return <ReactiveInputDialog onCancel={props.onCancel} className="EventSongListValueEditor">

        <DialogTitle>
            Create a new event
        </DialogTitle>
        <DialogContent dividers>
            <SettingMarkdown setting="NewEventDialogDescription" />

            <div className="EventSongListValue">
                <VisibilityControl value={eventValue.visiblePermission} onChange={(newVisiblePermission) => {
                    const newValue: db3.EventPayload = { ...eventValue, visiblePermission: newVisiblePermission, visiblePermissionId: newVisiblePermission?.id || null };
                    setEventValue(newValue);
                }} />

                {renderColumn(eventTableSpec, "name", eventValue, eventValidationResult, eventAPI)}
                {renderColumn(eventTableSpec, "slug", eventValue, eventValidationResult, eventAPI)}
                {renderColumn(eventTableSpec, "type", eventValue, eventValidationResult, eventAPI)}
                {renderColumn(eventTableSpec, "status", eventValue, eventValidationResult, eventAPI)}
                {renderColumn(eventTableSpec, "tags", eventValue, eventValidationResult, eventAPI)}
                {renderColumn(eventTableSpec, "expectedAttendanceUserTag", eventValue, eventValidationResult, eventAPI)}

                {renderColumn(segmentTableSpec, "startsAt", segmentValue, segmentValidationResult, segmentAPI)}

            </div>
        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel} startIcon={gIconMap.Cancel()}>Cancel</Button>
            <Button onClick={handleSaveClick} startIcon={gIconMap.Save()}>OK</Button>
        </DialogActions>

    </ReactiveInputDialog>;
};

const NewEventButton = (props: { onOK: () => void }) => {
    const [open, setOpen] = React.useState<boolean>(false);
    return <>
        <Button onClick={() => setOpen(true)}>{gIconMap.Add()} Create a new event</Button>
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
    //verbosity: EventDetailVerbosity;
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

    // const setVerbosity = (verbosity: EventDetailVerbosity) => {
    //     const newSpec: EventsControlsSpec = { ...props.spec, verbosity };
    //     props.onChange(newSpec);
    // };

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
    return <div className="filterControlsContainer">
        {/* <div className="header">FILTER</div> */}
        <div className="content">
            <div className="row">
                <div className="filterControls">

                    <div className="row quickFilter">
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

                    <div className="row">
                        {/* <div className="caption cell">status</div> */}
                        <CMChipContainer className="cell">
                            {(statusesClient.items as db3.EventStatusPayload[]).filter(i => i.events.length > 0).map(status => (
                                <CMChip
                                    key={status.id}
                                    //selected={props.spec.statusFilter.some(id => id === status.id)}
                                    onClick={() => toggleStatus(status.id)}
                                    color={status.color}
                                    shape="rectangle"
                                    variation={{ ...StandardVariationSpec.Strong, selected: props.spec.statusFilter.some(id => id === status.id) }}
                                >
                                    {RenderMuiIcon(status.iconName)}{status.label} ({status.events.length})
                                </CMChip>
                            ))}
                        </CMChipContainer>
                    </div>

                    <div className="row">
                        {/* <div className="caption cell">event type</div> */}
                        <CMChipContainer className="cell">
                            {(typesClient.items as db3.EventTypePayload[]).filter(i => i.events.length > 0).map(type => (
                                <CMChip
                                    key={type.id}
                                    //selected={props.spec.typeFilter.some(id => id === type.id)}
                                    variation={{ ...StandardVariationSpec.Strong, selected: props.spec.typeFilter.some(id => id === type.id) }}
                                    onClick={() => toggleType(type.id)}
                                    color={type.color}
                                >
                                    {RenderMuiIcon(type.iconName)}{type.text} ({type.events.length})
                                </CMChip>
                            ))}
                        </CMChipContainer>
                    </div>

                    <div className="row">
                        {/* <div className="caption cell">tags</div> */}
                        <CMChipContainer className="cell">
                            {popularTags.filter(t => t.events.length > 0).map(tag => (
                                <CMChip
                                    key={tag.id}
                                    //selected={props.spec.tagFilter.some(id => id === tag.id)}
                                    variation={{ ...StandardVariationSpec.Strong, selected: props.spec.tagFilter.some(id => id === tag.id) }}
                                    onClick={() => toggleTag(tag.id)}
                                    color={tag.color}
                                >
                                    {tag.text} ({tag.events.length})
                                </CMChip>
                            ))}
                        </CMChipContainer>
                    </div>


                </div>
            </div>
        </div>{/* content */}
    </div>; // {/* filterControlsContainer */ }
};

interface EventListItemProps {
    event: db3.EventClientPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
};

const EventListItem = (props: EventListItemProps) => {

    const eventData = CalculateEventMetadata(props.event);

    return <EventDetailContainer eventData={eventData} fadePastEvents={true} readonly={true} tableClient={props.tableClient} showVisibility={false}>
        <EventAttendanceControl
            eventData={eventData}
            onRefetch={props.tableClient.refetch}
        />
    </EventDetailContainer>;

};

interface EventsListArgs {
    // in order for callers to be able to tell this to refetch, just increment a value in the filter
    filterSpec: EventsControlsSpec,
};

const EventsList = ({ filterSpec }: EventsListArgs) => {
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;

    const eventsClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xEventVerbose,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
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
        requestedCaps: DB3Client.xTableClientCaps.Query,// | DB3Client.xTableClientCaps.Mutation,
        clientIntention,
        queryOptions: gQueryOptions.liveData,
    });

    React.useEffect(() => {
        eventsClient.refetch();
    }, [filterSpec]);

    const items = eventsClient.items as db3.EventClientPayload_Verbose[];

    return <div className="eventList searchResults">
        {items.map(event => <EventListItem key={event.id} event={event} tableClient={eventsClient} />)}
    </div>;
};

const MainContent = () => {
    if (!useAuthorization("events page", Permission.view_events)) {
        throw new Error(`unauthorized`);
    }

    const [controlSpec, setControlSpec] = React.useState<EventsControlsSpec>({
        recordCount: 20,
        quickFilter: "",
        tagFilter: [],
        statusFilter: [],
        typeFilter: [],
        refreshSerial: 0,
    });

    const handleSpecChange = (value: EventsControlsSpec) => {
        setControlSpec(value);
    };

    return <div className="eventsMainContent">

        <Suspense>
            <SettingMarkdown setting="events_markdown"></SettingMarkdown>
        </Suspense>

        <NewEventButton onOK={() => {
            setControlSpec({ ...controlSpec, refreshSerial: controlSpec.refreshSerial + 1 });
        }} />

        <Suspense>
            <CMSinglePageSurfaceCard className="filterControls">
                {/* showing {eventsClient.items.length} events */}
                <div className="header">
                    Search events
                </div>
                <div className="content">
                    <EventsControls onChange={handleSpecChange} spec={controlSpec} />
                </div>
            </CMSinglePageSurfaceCard>
        </Suspense>

        <Suspense>
            <EventsList filterSpec={controlSpec} />
        </Suspense>
    </div>;
};

const ViewEventsPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Events">
            <MainContent />
        </DashboardLayout>
    )
}

export default ViewEventsPage;