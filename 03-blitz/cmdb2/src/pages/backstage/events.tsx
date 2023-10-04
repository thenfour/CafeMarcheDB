import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { EventSummary, RehearsalSummary } from "src/core/components/CMMockupComponents";
import { EventDetail, EventDetailVerbosity } from "src/core/components/EventComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React, { FC, Suspense } from "react"
import { Chip, InputBase } from "@mui/material";
import {
    Add as AddIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { API } from "src/core/db3/clientAPI";

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


/// there's a problem with showing calendars.
// while it does show a cool overview, interactivity is a problem.
// 1. how many months? each month is very awkward on screen space.
// 2. interactivity? you can't actually display any info per-day, so interactivity is important but then it massively complicates things.
// therefore: no calendars for the moment.
interface EventsControlsSpec {
    recordCount: number;
    quickFilter: string;
    tagFilter: number[];
    verbosity: EventDetailVerbosity;
};

interface EventsControlsProps {
    spec: EventsControlsSpec;
    onChange: (value: EventsControlsSpec) => void;
};
const EventsControls = (props: EventsControlsProps) => {

    const [popularTags, { refetch }] = API.events.usePopularEventTagsQuery();
    //console.log(popularTags);

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

    // FILTER: [upcoming] [past] [concert] [rehearsals] [majorettes] [__________________]
    // SHOW:   [compact] [default] [full] [verbose]
    // 20 100 all
    return <div className="eventsControls">
        <div className="row">
            <div className="caption">FILTER</div>
            <div className="tagList">
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

const MainContent = () => {
    if (!useAuthorization("events page", Permission.view_events)) {
        throw new Error(`unauthorized`);
    }

    const [controlSpec, setControlSpec] = React.useState<EventsControlsSpec>({
        recordCount: 20,
        quickFilter: "",
        tagFilter: [],
        verbosity: "default",
    });

    const eventsClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xEventVerbose,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.TagsFieldClient<db3.EventTagAssignmentModel>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            ],
        }),
        filterModel: {
            quickFilterValues: controlSpec.quickFilter.split(/\s+/).filter(token => token.length > 0),
            items: [],
            cmdb: {
                tagIds: controlSpec.tagFilter,
            },
        },
        paginationModel: {
            page: 0,
            pageSize: controlSpec.recordCount,
        },
        requestedCaps: DB3Client.xTableClientCaps.Query,
    });

    const handleSpecChange = (value: EventsControlsSpec) => {
        setControlSpec(value);
        eventsClient.refetch();
    };

    return (<>
        <div className="eventsMainContent">

            <SettingMarkdown settingName="events_markdown"></SettingMarkdown>

            <CMSinglePageSurfaceCard>
                showing {eventsClient.items.length} events
                <EventsControls onChange={handleSpecChange} spec={controlSpec} />
            </CMSinglePageSurfaceCard>

            {eventsClient.items.map(event => <EventDetail key={event.id} event={event as db3.EventClientPayload_Verbose} tableClient={eventsClient} verbosity={controlSpec.verbosity} />)}

            <RehearsalSummary asArnold={true} asDirector={false} finalized={true} past={true} />
            <EventSummary asArnold={true} asDirector={true} finalized={true} past={true} />
            <EventSummary asArnold={false} asDirector={false} finalized={false} past={true} />
            <RehearsalSummary asArnold={true} asDirector={false} finalized={true} past={true} />
            <RehearsalSummary asArnold={true} asDirector={false} finalized={true} past={true} />
            <EventSummary asArnold={false} asDirector={false} finalized={true} past={true} />

            <EventSummary asArnold={true} asDirector={false} finalized={true} past={false} />
            <EventSummary asArnold={true} asDirector={true} finalized={true} past={false} />
            <EventSummary asArnold={false} asDirector={false} finalized={false} past={false} />
            <EventSummary asArnold={false} asDirector={false} finalized={true} past={false} />
        </div>
    </>
    )
};

const ViewEventsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Events">
            <MainContent />
        </DashboardLayout>
    )
}

export default ViewEventsPage;
