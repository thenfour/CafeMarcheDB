import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Button, Pagination } from "@mui/material";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { Timing } from "shared/time";
import { SplitQuickFilter, gQueryOptions, toggleValueInArray } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { CMSmallButton, DebugCollapsibleAdminText } from "src/core/components/CMCoreComponents2";
import { SearchInput } from "src/core/components/CMTextField";
import { EventAttendanceControl } from "src/core/components/EventAttendanceComponents";
import { EventDetailContainer } from "src/core/components/EventComponents";
import { CalculateEventMetadata } from "src/core/components/EventComponentsBase";
import { NewEventButton } from "src/core/components/NewEventComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { RenderMuiIcon, gIconMap } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import getEventFilterInfo from "src/core/db3/queries/getEventFilterInfo";
import { GetEventFilterInfoChipInfo, GetEventFilterInfoRet, TimingFilter, gEventFilterTimingIDConstants } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

/// there's a problem with showing calendars.
// while it does show a cool overview, interactivity is a problem.
// 1. how many months? each month is very awkward on screen space.
// 2. interactivity? you can't actually display any info per-day, so interactivity is important but then it massively complicates things.
// therefore: no calendars for the moment.
interface EventsFilterSpec {
    pageSize: number;
    page: number;
    quickFilter: string;

    tagFilter: number[];
    statusFilter: number[];
    typeFilter: number[];
    timingFilter: TimingFilter;

    orderBy: "StartAsc" | "StartDesc";

    refreshSerial: number; // increment this in order to trigger a refetch
};

interface EventsControlsProps {
    filterSpec: EventsFilterSpec;
    filterInfo: GetEventFilterInfoRet;
    onChange: (value: EventsFilterSpec) => void;
};

type EventsControlsValueProps = EventsControlsProps & {
    filterInfo: GetEventFilterInfoRet,
    readonly: boolean;
};

type EventsControlsDynProps = EventsControlsProps & {
    filterInfo: GetEventFilterInfoRet,
};

const EventsFilterControlsValue = ({ filterInfo, ...props }: EventsControlsValueProps) => {

    const toggleTag = (tagId: number) => {
        const newSpec: EventsFilterSpec = { ...props.filterSpec };
        newSpec.tagFilter = toggleValueInArray(newSpec.tagFilter, tagId);
        props.onChange(newSpec);
    };

    const toggleStatus = (id: number) => {
        const newSpec: EventsFilterSpec = { ...props.filterSpec };
        newSpec.statusFilter = toggleValueInArray(newSpec.statusFilter, id);
        props.onChange(newSpec);
    };

    const toggleType = (id: number) => {
        const newSpec: EventsFilterSpec = { ...props.filterSpec };
        newSpec.typeFilter = toggleValueInArray(newSpec.typeFilter, id);
        props.onChange(newSpec);
    };

    const toggleTiming = (t: GetEventFilterInfoChipInfo) => {
        const togglingFuture = t.id === gEventFilterTimingIDConstants.future;
        let newVal: TimingFilter = "all";
        switch (props.filterSpec.timingFilter) {
            case "all":
                newVal = togglingFuture ? "past" : "future";
                break;
            case "future":
                newVal = togglingFuture ? "none" : "all";
                break;
            case "past":
                newVal = togglingFuture ? "all" : "none";
                break;
            default:
            case "none":
                newVal = togglingFuture ? "future" : "past";
                break;
        }
        const newSpec: EventsFilterSpec = { ...props.filterSpec };
        newSpec.timingFilter = newVal;
        props.onChange(newSpec);
    };

    const isTimingSelected = (t: GetEventFilterInfoChipInfo): boolean => {
        switch (props.filterSpec.timingFilter) {
            case "all":
                return true;
            case "future":
                return t.id === gEventFilterTimingIDConstants.future;
            case "past":
                return t.id === gEventFilterTimingIDConstants.past;
            default:
            case "none":
                return false;
        }
    };

    return <div className={`EventsFilterControlsValue ${props.readonly && "HalfOpacity"}`}>

        <div className="row">
            {/* <div className="caption cell">event type</div> */}
            <CMChipContainer className="cell">
                {(filterInfo.timings).map(t => (
                    <CMChip
                        key={t.id}
                        variation={{ ...StandardVariationSpec.Strong, fillOption: "hollow", selected: isTimingSelected(t) }}
                        onClick={props.readonly ? undefined : (() => toggleTiming(t))}
                        color={t.id === gEventFilterTimingIDConstants.past ? null : "purple"}
                        shape="rectangle"
                        size="small"
                    >
                        {gIconMap.CalendarMonth()}{t.label} ({t.rowCount})
                    </CMChip>
                ))}

            </CMChipContainer>
        </div>
        <div className="row">
            {/* <div className="caption cell">event type</div> */}
            <CMChipContainer className="cell">
                {(filterInfo.types).map(type => (
                    <CMChip
                        key={type.id}
                        variation={{ ...StandardVariationSpec.Strong, selected: props.filterSpec.typeFilter.some(id => id === type.id) }}
                        onClick={props.readonly ? undefined : (() => toggleType(type.id))}
                        color={type.color}
                    //tooltip={status.tooltip} // no. it gets in the way and is annoying.
                    >
                        {RenderMuiIcon(type.iconName)}{type.label} ({type.rowCount})
                    </CMChip>
                ))}

            </CMChipContainer>
        </div>

        <div className="row">
            <CMChipContainer className="cell">
                {
                    filterInfo.statuses.map(status => (
                        <CMChip
                            key={status.id}
                            onClick={props.readonly ? undefined : (() => toggleStatus(status.id))}
                            color={status.color}
                            shape="rectangle"
                            variation={{ ...StandardVariationSpec.Strong, selected: props.filterSpec.statusFilter.some(id => id === status.id) }}
                        //tooltip={status.tooltip} // no. it gets in the way and is annoying.
                        >
                            {RenderMuiIcon(status.iconName)}{status.label} ({status.rowCount})
                        </CMChip>
                    ))}
            </CMChipContainer>
        </div >

        <div className="row">
            {/* <div className="caption cell">tags</div> */}
            <CMChipContainer className="cell">
                {filterInfo.tags.map(tag => (
                    <CMChip
                        key={tag.id}
                        size="small"
                        variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.some(id => id === tag.id) }}
                        onClick={props.readonly ? undefined : (() => toggleTag(tag.id))}
                        color={tag.color}
                    //tooltip={status.tooltip} // no. it gets in the way and is annoying.
                    >
                        {RenderMuiIcon(tag.iconName)}{tag.label} ({tag.rowCount})
                    </CMChip>
                ))}
            </CMChipContainer>
        </div>

        <div className="row topDivider">
            <CMChipContainer className="cell">
                <CMChip
                    size="small"
                    variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.orderBy === "StartAsc" }}
                    onClick={props.readonly ? undefined : (() => props.onChange({ ...props.filterSpec, orderBy: "StartAsc" }))}
                >
                    Chronological
                </CMChip>
                <CMChip
                    size="small"
                    variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.orderBy === "StartDesc" }}
                    onClick={props.readonly ? undefined : (() => props.onChange({ ...props.filterSpec, orderBy: "StartDesc" }))}
                >
                    Latest events first
                </CMChip>
            </CMChipContainer>
        </div>
    </div>;
};


const EventsFilterControlsDyn = (props: EventsControlsDynProps) => {
    // React.useEffect(() => {
    //     props.onFilterInfoChanged(filterInfo);
    // }, [filterInfo]);

    return <EventsFilterControlsValue {...props} readonly={false} />;
};


const EventsControls = (props: EventsControlsProps) => {
    const [expanded, setExpanded] = React.useState<boolean>(false);

    const setFilterText = (quickFilter: string) => {
        const newSpec: EventsFilterSpec = { ...props.filterSpec, quickFilter };
        props.onChange(newSpec);
    };

    const handleClearFilter = () => {
        props.onChange({
            ...props.filterSpec,
            quickFilter: "",
            statusFilter: [],
            tagFilter: [],
            typeFilter: [],
            timingFilter: "future",
            orderBy: "StartAsc",
        });
    };

    return <div className="filterControlsContainer">
        <div className="content">
            <div className="row">
                <div className="filterControls">

                    <div className="row quickFilter">
                        <SearchInput
                            onChange={(v) => setFilterText(v)}
                            value={props.filterSpec.quickFilter}
                            autoFocus={true}
                        />
                        <Button onClick={handleClearFilter}>Clear filter</Button>
                        <div className="freeButton headerExpandableButton" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </div>
                    </div>

                    {/* The way we store the filter results here allows the suspense to be less flickry, rendering the same content during fallback. */}
                    {expanded &&
                        <Suspense fallback={<EventsFilterControlsValue {...props} filterInfo={props.filterInfo} readonly={true} />}>
                            <EventsFilterControlsDyn {...props} filterInfo={props.filterInfo} />
                        </Suspense>
                    }
                </div>
            </div>
        </div>{/* content */}
    </div>; // {/* filterControlsContainer */ }
};

interface EventListItemProps {
    event: db3.EventClientPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
    filterSpec: EventsFilterSpec;
};

const EventListItem = (props: EventListItemProps) => {
    const router = useRouter();
    const eventData = CalculateEventMetadata(props.event);

    // can't make these items a link because they contain interactable attendance control
    // return <div className="searchListItem" onClick={() => router.push(API.events.getURIForEvent(props.event.id, props.event.slug))}>
    return <EventDetailContainer
        eventData={eventData}
        fadePastEvents={true}
        readonly={true}
        tableClient={props.tableClient}
        showVisibility={true}
        highlightStatusId={props.filterSpec.statusFilter}
        highlightTypeId={props.filterSpec.typeFilter}
        highlightTagIds={props.filterSpec.tagFilter}
    >
        {eventData.eventTiming !== Timing.Past &&
            <EventAttendanceControl
                eventData={eventData}
                onRefetch={props.tableClient.refetch}
            />
        }
    </EventDetailContainer>
    //</div>;

};

interface EventsListArgs {
    // in order for callers to be able to tell this to refetch, just increment a value in the filter
    filterSpec: EventsFilterSpec,
    filterInfo: GetEventFilterInfoRet;
    setFilterSpec: (value: EventsFilterSpec) => void, // for pagination
    events: db3.EventClientPayload_Verbose[],
    eventsClient: DB3Client.xTableRenderClient;
};

const EventsList = ({ filterSpec, filterInfo, events, eventsClient, ...props }: EventsListArgs) => {

    const itemBaseOrdinal = filterSpec.page * filterSpec.pageSize;

    return <div className="eventList searchResults">
        {events.map(event => <EventListItem key={event.id} event={event} tableClient={eventsClient} filterSpec={filterSpec} />)}
        <div className="searchRecordCount">
            Displaying items {itemBaseOrdinal + 1}-{itemBaseOrdinal + events.length} of {filterInfo.rowCount} total
        </div>
        <Pagination
            count={Math.ceil(filterInfo.rowCount / filterSpec.pageSize)}
            page={filterSpec.page + 1}
            onChange={(e, newPage) => {
                //console.log(`filterSpec.page: ${filterSpec.page} // setting to ${newPage - 1}`);
                props.setFilterSpec({ ...filterSpec, page: newPage - 1 });
            }} />
    </div>;
};


const MainContentDyn = () => {

    const [filterSpec, setFilterSpec] = React.useState<EventsFilterSpec>({
        pageSize: 20,
        page: 0,
        quickFilter: "",
        tagFilter: [],
        statusFilter: [],
        typeFilter: [],
        refreshSerial: 0,
        timingFilter: "future",
        orderBy: "StartAsc",
    });

    const [filterInfo, filterInfoExtra] = useQuery(getEventFilterInfo, {
        filterSpec: {
            quickFilter: filterSpec.quickFilter,
            statusIds: filterSpec.statusFilter,
            tagIds: filterSpec.tagFilter,
            typeIds: filterSpec.typeFilter,
            orderBy: filterSpec.orderBy,
            pageSize: filterSpec.pageSize,
            timingFilter: filterSpec.timingFilter,
            page: filterSpec.page,
        }
    });

    const handleSpecChange = (value: EventsFilterSpec) => {
        setFilterSpec(value);
    };

    // when anything other than page changes, reset page. refetching on page change is automatic.
    const { page, ...everythingButPage } = filterSpec;

    const specHash = JSON.stringify(everythingButPage);
    //console.log(specHash);
    React.useEffect(() => {
        setFilterSpec({ ...filterSpec, page: 0 });
        //console.log(`refetching...`);
        //eventsClient.refetch();
    }, [specHash]);

    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary' };
    const [currentUser] = useCurrentUser();
    clientIntention.currentUser = currentUser!;

    const tableParams: db3.EventTableParams = {
        eventIds: filterInfo.eventIds
    };

    const eventsClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xEventVerbose,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
        filterModel: {
            quickFilterValues: SplitQuickFilter(filterSpec.quickFilter),
            items: [],
            tagIds: filterSpec.tagFilter,
            tableParams,
        },
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        queryOptions: gQueryOptions.liveData,
    });
    const eventsInWrongOrder = eventsClient.items as db3.EventClientPayload_Verbose[];

    // the db3 query doesn't retain the same order as the filter info ret, put in correct order.
    const eventsWithPossibleNulls = filterInfo.eventIds.map(id => eventsInWrongOrder.find(e => e.id === id));
    const events = eventsWithPossibleNulls.filter(e => !!e) as db3.EventClientPayload_Verbose[];

    return <>
        <NewEventButton onOK={() => {
            setFilterSpec({ ...filterSpec, refreshSerial: filterSpec.refreshSerial + 1 });
        }} />

        <DebugCollapsibleAdminText text={filterInfo.statusesQuery} caption={"statusesQuery"} />
        <DebugCollapsibleAdminText text={filterInfo.tagsQuery} caption={"tagsQuery"} />
        <DebugCollapsibleAdminText text={filterInfo.typesQuery} caption={"typesQuery"} />
        <DebugCollapsibleAdminText text={filterInfo.paginatedEventQuery} caption={"paginatedEventQuery"} />

        <CMSinglePageSurfaceCard className="filterControls">
            <div className="content">
                <div className="header">
                    Search & filter events
                </div>
                <EventsControls onChange={handleSpecChange} filterSpec={filterSpec} filterInfo={filterInfo} />
            </div>
        </CMSinglePageSurfaceCard>
        <EventsList filterSpec={filterSpec} setFilterSpec={handleSpecChange} events={events} eventsClient={eventsClient} filterInfo={filterInfo} />
    </>;
};

const MainContent = () => {
    if (!useAuthorization("events page", Permission.view_events_nonpublic)) {
        throw new Error(`unauthorized`);
    }
    return <div className="eventsMainContent searchPage">

        <Suspense>
            <SettingMarkdown setting="events_markdown"></SettingMarkdown>
        </Suspense>

        <MainContentDyn />
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
