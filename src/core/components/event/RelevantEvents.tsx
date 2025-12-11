import { useQuery } from "@blitzjs/rpc";
import { InfoOutlined, LibraryMusic } from "@mui/icons-material";
import { Prisma } from "db";
import React from "react";
import { distinctValuesOfArray, toSorted } from "shared/arrayUtils";
import { CalcRelativeTiming, CalcRelativeTimingFromNow, DateTimeRange, RelativeTimingBucket, RelativeTimingInfo, Timing } from "shared/time";
import { IsNullOrWhitespace } from "shared/utils";
import { API } from "src/core/db3/clientAPI";
import * as db3 from "src/core/db3/db3";
import { useDb3Query } from "../../db3/DB3Client";
import getUserTagWithAssignments from "../../db3/queries/getUserTagWithAssignments";
import { MakeEmptySearchResultsRet, SearchResultsRet } from "../../db3/shared/apiTypes";
import { AppContextMarker } from "../AppContext";
import { CMLink } from "../CMLink";
import { ActivityFeature } from "../featureReports/activityTracking";
import { SearchItemBigCardLink } from "../SearchItemBigCardLink";
import { EventStatusMinimal } from "./EventChips";
import { EventListItem, gEventDetailTabSlugIndices } from "./EventComponents";
import { RelevanceClassOverrideIndicator } from "./EventRelevanceOverrideComponents";
import { StandardVariationSpec } from "../color/palette";
import { GetStyleVariablesForColor } from "../color/ColorClientUtils";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { EnrichedSearchEventPayload, enrichSearchResultEvent } from "../../db3/shared/schema/enrichedEventTypes";

function formatShortDate(date: Date, locale: string = navigator.language): string {
    const now = new Date();
    const showYear = date.getFullYear() !== now.getFullYear();
    const formatter = new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        ...(showYear ? { year: "numeric" } : {})
    });
    // Use formatToParts to filter out punctuation
    const parts = formatter.formatToParts(date);
    return parts
        .filter(part => part.type !== "literal")
        .map(part => part.value)
        .join(" ");
}

export interface EventShortDateProps {
    event: Prisma.EventGetPayload<{
        select: {
            startsAt: true;
        }
    }>;
};

export const EventShortDate = ({ event }: EventShortDateProps) => {
    if (!event.startsAt) return null;
    const relativeTiming = CalcRelativeTimingFromNow(event.startsAt);
    return <>
        {formatShortDate(event.startsAt)}
        <span className={`EventDateField container ${relativeTiming.bucket}`}><span className="RelativeIndicator">{relativeTiming.label}</span></span>
    </>
};


export const SubtleEventCard = ({ event, ...props }: { event: EnrichedSearchEventPayload, dateRange: DateTimeRange, relativeTiming: RelativeTimingInfo }) => {
    const dashboardContext = useDashboardContext();
    const visInfo = dashboardContext.getVisibilityInfo(event);
    const typeStyle = GetStyleVariablesForColor({
        ...StandardVariationSpec.Weak,
        color: event.type?.color || null,
    });

    const dateRange = API.events.getEventDateRange(event);
    const eventTiming = dateRange.hitTestDateTime();

    const classes = [
        "SubtleEventCard",
        event.type?.text,
        visInfo.className,
        `status_${event.status?.significance}`,
        (eventTiming === Timing.Past) ? "past" : "notPast",
    ];

    return <AppContextMarker eventId={event.id}>
        <div className={classes.join(" ")} style={typeStyle.style} >
            <CMLink trackingFeature={ActivityFeature.link_follow_internal} href={dashboardContext.routingApi.getURIForEvent(event)} className="SubtleEventCardLink">
                <div className="SubtleEventCardTitle">
                    <div>{event.name}</div>
                </div>
                <div className="SubtleEventCardDate">
                    <RelevanceClassOverrideIndicator event={event} colorStyle="subtle" />
                    <EventStatusMinimal statusId={event.statusId} />
                    <EventShortDate event={event} />
                </div>
            </CMLink>
            <div className='SearchItemBigCardLinkContainer'>

                {!IsNullOrWhitespace(event.descriptionWikiPage?.currentRevision?.content) && <AppContextMarker name="info inner card"><SearchItemBigCardLink
                    icon={<InfoOutlined />}
                    title="Info"
                    uri={dashboardContext.routingApi.getURIForEvent(event, gEventDetailTabSlugIndices.info)}
                    eventId={event.id}
                />
                </AppContextMarker>
                }
                {event.songLists.length > 0 && <AppContextMarker name="setlist inner card"><SearchItemBigCardLink
                    icon={<LibraryMusic />}
                    title="Setlist"
                    uri={dashboardContext.routingApi.getURIForEvent(event, gEventDetailTabSlugIndices.setlists)}
                    eventId={event.id}
                />
                </AppContextMarker>
                }

            </div>
        </div>
    </AppContextMarker>;
};

function MakeMockSearchResultsRetFromEvents(events: EnrichedSearchEventPayload[], userTags: db3.UserTagWithAssignmentPayload[]): SearchResultsRet {
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

    const tableClient = useDb3Query<db3.EventVerbose_Event>({
        schema: db3.xEventVerbose, filterSpec: {
            pks: dashboardContext.relevantEventIds,
            items: [],
        }
    });
    const items = tableClient.items;

    let enrichedEvents: EnrichedSearchEventPayload[] = items.map(e => enrichSearchResultEvent(e, dashboardContext));

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
        <AppContextMarker name="relevant events">
            {/* <div className="RelevantEventsHeader">
            <a href="/backstage/events" rel="noreferrer">
                Current Events
            </a>
        </div> */}
            {highlightedEvent && <div>
                <AppContextMarker name="highlighted">
                    <EventListItem
                        event={highlightedEvent.event}
                        refetch={tableClient.refetch}
                        results={MakeMockSearchResultsRetFromEvents([highlightedEvent.event], userTagWithAssignments)}
                        showTabs={true}
                        reducedInfo={true}
                    //feature={ActivityFeature.relevant_event_link_click}
                    />
                </AppContextMarker>
            </div>}
            {eventsWithTiming.length > 0 && <div>
                <div className="RelevantEventsList SubtleEventCardContainer">
                    {eventsWithTiming.map((e, i) => <SubtleEventCard key={i} event={e.event} dateRange={e.dateRange} relativeTiming={e.relativeTiming} />)}
                </div>
            </div>
            }
        </AppContextMarker>
    </div>;
};