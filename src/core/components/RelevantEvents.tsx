import { useQuery } from "@blitzjs/rpc";
import React from "react";
import { distinctValuesOfArray, toSorted } from "shared/arrayUtils";
import { StandardVariationSpec } from 'shared/color';
import { CalcRelativeTiming, DateTimeRange, RelativeTimingBucket, RelativeTimingInfo } from "shared/time";
import { API } from "src/core/db3/clientAPI";
import * as db3 from "src/core/db3/db3";
import { gIconMap } from "../db3/components/IconMap";
import { useDb3Query } from "../db3/DB3Client";
import getUserTagWithAssignments from "../db3/queries/getUserTagWithAssignments";
import { MakeEmptySearchResultsRet, SearchResultsRet } from "../db3/shared/apiTypes";
import { GetStyleVariablesForColor } from "./Color";
import { useDashboardContext } from "./DashboardContext";
import { EventListItem, gEventDetailTabSlugIndices } from "./EventComponents";
import { simulateLinkClick } from "./CMCoreComponents2";
import { IsNullOrWhitespace } from "shared/utils";
import { SearchItemBigCardLink } from "./SearchItemBigCardLink";
import { EditNote, Info, InfoOutlined, LibraryMusic } from "@mui/icons-material";

// events happening TODAY can be a search result card, maximum 1.
// but all other events should be in a list of smaller cards.

function formatShortDate(date: Date, locale: string = navigator.language): string {
    const formatter = new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        // We deliberately omit the year option.
    });
    // Use formatToParts to filter out punctuation
    const parts = formatter.formatToParts(date);
    return parts
        .filter(part => part.type !== "literal")
        .map(part => part.value)
        .join(" ");
}

export const SubtleEventCard = ({ event, ...props }: { event: db3.EnrichedSearchEventPayload, dateRange: DateTimeRange, relativeTiming: RelativeTimingInfo }) => {
    const dashboardContext = useDashboardContext();
    const visInfo = dashboardContext.getVisibilityInfo(event);
    const typeStyle = GetStyleVariablesForColor({
        ...StandardVariationSpec.Weak,
        color: event.type?.color || null,
    });

    const classes = [
        //`contentSection`,
        "SubtleEventCard",
        event.type?.text,
        visInfo.className,
        `status_${event.status?.significance}`,
    ];

    return <div className={classes.join(" ")} style={typeStyle.style} onClick={() => simulateLinkClick(API.events.getURIForEvent(event))} >
        <div className="SubtleEventCardTitle">
            {/* {gIconMap.CalendarMonth()} */}
            <div>{event.name}</div>
        </div>
        {event.startsAt &&
            <div className="SubtleEventCardDate">
                {formatShortDate(event.startsAt)}
                <span className={`EventDateField container ${props.relativeTiming.bucket}`}><span className="RelativeIndicator">{props.relativeTiming.label}</span></span>
            </div>
        }
        <div className='SearchItemBigCardLinkContainer'>
            {!IsNullOrWhitespace(event.descriptionWikiPage?.currentRevision?.content) && <SearchItemBigCardLink
                icon={<InfoOutlined />}
                title="Info"
                uri={API.events.getURIForEvent(event, gEventDetailTabSlugIndices.info)}
            />
            }
            {event.songLists.length > 0 && <SearchItemBigCardLink
                icon={<LibraryMusic />}
                title="Setlist"
                uri={API.events.getURIForEvent(event, gEventDetailTabSlugIndices.setlists)}
            />
            }
        </div>


    </div>;
};

function MakeMockSearchResultsRetFromEvents(events: db3.EnrichedSearchEventPayload[], userTags: db3.UserTagWithAssignmentPayload[]): SearchResultsRet {
    const customData: db3.EventSearchCustomData = {
        userTags,
    };
    return {
        ...MakeEmptySearchResultsRet(),
        results: events,
        rowCount: events.length,
        customData,
    };
}

const gHighlightEvent = false;

export const RelevantEvents = () => {
    const [now, setNow] = React.useState<Date>(new Date());
    const dashboardContext = useDashboardContext();
    if (!dashboardContext) return null;
    if (dashboardContext.relevantEventIds.length < 1) return null;

    const tableClient = useDb3Query(db3.xEventVerbose, {
        pks: dashboardContext.relevantEventIds,
        items: [],
    });
    const items = tableClient.items as db3.EventVerbose_Event[];

    let enrichedEvents: db3.EnrichedSearchEventPayload[] = items.map(e => db3.enrichSearchResultEvent(e, dashboardContext));

    // relevant user tags
    let relevantUserTagIds = enrichedEvents.map(e => e.expectedAttendanceUserTagId)
        .filter(e => e !== null);
    relevantUserTagIds = distinctValuesOfArray(relevantUserTagIds, (a, b) => a === b);
    const [userTagWithAssignments, _] = useQuery(getUserTagWithAssignments, {
        userTagIds: relevantUserTagIds,
    });

    // allow 1 single "happening now" event.

    let eventsWithTiming = enrichedEvents.map(event => {
        const dateRange = API.events.getEventDateRange(event);
        const relativeTiming = CalcRelativeTiming(now, dateRange);
        let sortValue = 0;
        let worthyOfHighlight = false;
        switch (relativeTiming.bucket) {
            case RelativeTimingBucket.HappeningNow: // prefer to highlight happening now event.
                sortValue = 0;
                worthyOfHighlight = true;
                break;
            case RelativeTimingBucket.Today:
                sortValue = 1;
                worthyOfHighlight = true;
                break;
            default:
                sortValue = 2;
                break;
        }
        return {
            event,
            relativeTiming,
            dateRange,
            sortValue,
            worthyOfHighlight,
        }
    });

    // extract a single event to highlight, if there's one happening now or today.
    eventsWithTiming = toSorted(eventsWithTiming, (a, b) => a.sortValue - b.sortValue);
    let highlightedEvent: typeof eventsWithTiming[0] | undefined;
    if (gHighlightEvent) {
        if (eventsWithTiming[0]?.worthyOfHighlight) {
            highlightedEvent = eventsWithTiming[0];
            eventsWithTiming = eventsWithTiming.slice(1); // remove the highlighted event from the list.
        }
    }

    return <div className="RelevantEvents">
        <div className="RelevantEventsHeader">
            <a href="/backstage/events" rel="noreferrer">            Current Events</a>
        </div>
        {highlightedEvent && <div>
            <EventListItem
                event={highlightedEvent.event}
                refetch={tableClient.refetch}
                results={MakeMockSearchResultsRetFromEvents([highlightedEvent.event], userTagWithAssignments)}
                showTabs={true}
                reducedInfo={true}
            /></div>}
        {eventsWithTiming.length > 0 && <div>
            <div className="RelevantEventsList SubtleEventCardContainer">
                {eventsWithTiming.map((e, i) => <SubtleEventCard key={i} event={e.event} dateRange={e.dateRange} relativeTiming={e.relativeTiming} />)}
            </div>
        </div>
        }
    </div>;
};