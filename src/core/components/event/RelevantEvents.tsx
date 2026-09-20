import { InfoOutlined, LibraryMusic } from "@mui/icons-material";
import React from "react";
import { toSorted } from "shared/arrayUtils";
import { CalcRelativeTiming, DateTimeRange, RelativeTimingBucket, Timing } from "shared/time";
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";
import { useDb3Query } from "../../db3/DB3Client";
import { AppContextMarker } from "../AppContext";
import { CMLink } from "../CMLink";
import { GetStyleVariablesForColor } from "../color/ColorClientUtils";
import { StandardVariationSpec } from "../color/palette";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { SearchItemBigCardLink } from "../SearchItemBigCardLink";
import { EventStatusMinimal } from "./EventChips";
import { EventListItem, gEventDetailTabSlugIndices } from "./EventComponents";
import { RelevanceClassOverrideIndicator } from "./EventRelevanceOverrideComponents";
import { EventShortDate } from "./EventShortDate";

export const SubtleEventCard = ({ event, dateRange, now }: { event: db3.EventSearchClient, dateRange: DateTimeRange, now: Date }) => {
    const dashboardContext = useDashboardContext();
    const visibilityClassName = event.visiblePermissionId === undefined
        ? ""
        : dashboardContext.getVisibilityInfo({ visiblePermissionId: event.visiblePermissionId }).className;
    const typeStyle = GetStyleVariablesForColor({
        ...StandardVariationSpec.Weak,
        color: event.type?.color || null,
    });

    const eventTiming = dateRange.hitTestDateTime(now);

    const classes = [
        "SubtleEventCard",
        event.type?.text,
        visibilityClassName,
        `status_${event.status?.significance}`,
        (eventTiming === Timing.Past) ? "past" : "notPast",
    ];

    return <AppContextMarker eventId={event.id}>
        <div className={classes.join(" ")} style={typeStyle.style} >
            <CMLink trackingFeature={ActivityFeature.link_follow_internal} href={dashboardContext.routingApi.getURIForEvent({ id: event.id, name: event.name || "" })} className="SubtleEventCardLink">
                <div className="SubtleEventCardTitle">
                    {event.relevanceClassOverride !== undefined && <RelevanceClassOverrideIndicator
                        event={{ relevanceClassOverride: event.relevanceClassOverride }}
                        colorStyle="subtle"
                    />}
                    <div>{event.name}</div>
                </div>
                <div className="SubtleEventCardDate">
                    <EventStatusMinimal statusId={event.statusId} />
                    <EventShortDate dateRange={dateRange} now={now} />
                </div>
            </CMLink>
            <div className='SearchItemBigCardLinkContainer'>

                {!IsNullOrWhitespace(event.descriptionWikiPage?.currentRevision?.content) && <AppContextMarker name="info inner card"><SearchItemBigCardLink
                    icon={<InfoOutlined />}
                    title="Info"
                    uri={dashboardContext.routingApi.getURIForEvent({ id: event.id, name: event.name || "" }, gEventDetailTabSlugIndices.info)}
                    eventId={event.id}
                />
                </AppContextMarker>
                }
                {(event.songLists?.length || 0) > 0 && <AppContextMarker name="setlist inner card"><SearchItemBigCardLink
                    icon={<LibraryMusic />}
                    title="Setlist"
                    uri={dashboardContext.routingApi.getURIForEvent({ id: event.id, name: event.name || "" }, gEventDetailTabSlugIndices.setlists)}
                    eventId={event.id}
                />
                </AppContextMarker>
                }

            </div>
        </div>
    </AppContextMarker>;
};

const gHighlightEvent = false;

const RelevantEventsWithDashboardContext = ({
    dashboardContext,
}: {
    dashboardContext: NonNullable<ReturnType<typeof useDashboardContext>>,
}) => {
    const [now, setNow] = React.useState<Date>(new Date());

    const tableClient = useDb3Query({
        view: db3.eventSearchView, filterSpec: {
            pks: dashboardContext.relevantEventIds,
        }
    });
    const enrichedEvents = tableClient.items;

    if (dashboardContext.relevantEventIds.length < 1) return null;

    // allow 1 single "happening now" event.

    let eventsWithTiming = enrichedEvents.flatMap(event => {
        const dateRange = event.dateRange;
        if (!dateRange) return [];
        const relativeTiming = CalcRelativeTiming(
            now,
            dateRange,
            dashboardContext.eventDatePresentation,
        );
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
        return [{
            event,
            relativeTiming,
            dateRange,
            sortValue,
            worthyOfHighlight,
        }];
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
                        showTabs={true}
                        reducedInfo={true}
                    //feature={ActivityFeature.relevant_event_link_click}
                    />
                </AppContextMarker>
            </div>}
            {eventsWithTiming.length > 0 && <div>
                <div className="RelevantEventsList SubtleEventCardContainer">
                    {eventsWithTiming.map((e, i) => <SubtleEventCard key={i} event={e.event} dateRange={e.dateRange} now={now} />)}
                </div>
            </div>
            }
        </AppContextMarker>
    </div>;
};

export const RelevantEvents = () => {
    const dashboardContext = useDashboardContext();
    if (!dashboardContext) return null;
    return <RelevantEventsWithDashboardContext dashboardContext={dashboardContext} />;
};
