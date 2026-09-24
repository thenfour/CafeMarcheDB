import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { EventOrderByColumnNames, EventOrderByColumnOption, EventOrderByColumnOptions, EventsFilterSpec } from "@/src/core/components/event/EventClientBaseTypes";
import { NewEventButton } from "@/src/core/components/event/NewEventComponents";
import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { SortDirection } from "shared/rootroot";
import { AppContextMarker } from "src/core/components/AppContext";
import { EventListItem } from "src/core/components/event/EventComponents";
import { FilterGroupDefinition, SearchPageContent, SearchPageContentConfig } from "src/core/components/search/SearchPageContent";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";
import { eventSearchConfig } from 'src/core/hooks/searchConfigs';
import { useDiscreteFilter, useSearchPage } from "src/core/hooks/useSearchFilters";
import type { EventStatusPublicId, EventTagPublicId, EventTypePublicId } from "shared/publicId";

// for serializing in compact querystring
interface EventsFilterSpecStatic {
    label: string,
    helpText: string,

    orderByColumn: EventOrderByColumnOption;
    orderByDirection: SortDirection;

    typeFilterEnabled: boolean;
    typeFilterBehavior: DiscreteCriterionFilterType;
    typeFilterOptions: EventTypePublicId[];

    tagFilterEnabled: boolean;
    tagFilterBehavior: DiscreteCriterionFilterType;
    tagFilterOptions: EventTagPublicId[];

    statusFilterEnabled: boolean;
    statusFilterBehavior: DiscreteCriterionFilterType;
    statusFilterOptions: EventStatusPublicId[];

    dateFilterEnabled: boolean;
    dateFilterBehavior: DiscreteCriterionFilterType;
    dateFilterOptions: number[];
};

//////////////////////////////////////////////////////////////////////////////////////////////////

const makeStaticFilters = (
    dashboardContext: ReturnType<typeof useDashboardContext>,
): EventsFilterSpecStatic[] => {
    const rehearsalTypeIds = dashboardContext.eventType
        .filter(type => type.significance === db3.EventTypeSignificance.Rehearsal)
        .map(type => type.publicId);
    const concertTypeIds = dashboardContext.eventType
        .filter(type => type.significance === db3.EventTypeSignificance.Concert)
        .map(type => type.publicId);
    const confirmedStatusIds = dashboardContext.eventStatus
        .filter(status => status.significance === db3.EventStatusSignificance.FinalConfirmation)
        .map(status => status.publicId);

    return [
    {
        label: "All",
        helpText: "Searching all events",
        orderByColumn: EventOrderByColumnOptions.startsAt,
        orderByDirection: "desc",
        typeFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
        typeFilterOptions: [],
        typeFilterEnabled: false,
        tagFilterBehavior: DiscreteCriterionFilterType.hasAllOf,
        tagFilterOptions: [],
        tagFilterEnabled: false,
        statusFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
        statusFilterOptions: [],
        statusFilterEnabled: false,
        dateFilterBehavior: DiscreteCriterionFilterType.hasSomeOf,
        dateFilterOptions: [],
        dateFilterEnabled: false,
    },
    {
        label: "Relevant",
        helpText: "Searching all events no more than 1 week old",
        "orderByColumn": "startsAt",
        "orderByDirection": "asc",
        "statusFilterEnabled": false,
        "statusFilterBehavior": DiscreteCriterionFilterType.hasNone,
        "statusFilterOptions": [],
        "typeFilterEnabled": false,
        "typeFilterBehavior": DiscreteCriterionFilterType.hasSomeOf,
        "typeFilterOptions": [],
        "tagFilterEnabled": false,
        "tagFilterBehavior": DiscreteCriterionFilterType.hasAllOf,
        "tagFilterOptions": [],
        "dateFilterEnabled": true,
        "dateFilterBehavior": DiscreteCriterionFilterType.hasAllOf,
        "dateFilterOptions": [
            10002
        ]
    },
    {
        label: "Hide rehearsals",
        helpText: "",
        "orderByColumn": "startsAt",
        "orderByDirection": "asc",
        "statusFilterEnabled": false,
        "statusFilterBehavior": DiscreteCriterionFilterType.hasNone,
        "statusFilterOptions": [],
        "typeFilterEnabled": true,
        "typeFilterBehavior": DiscreteCriterionFilterType.doesntHaveAnyOf,
        "typeFilterOptions": rehearsalTypeIds,
        "tagFilterEnabled": false,
        "tagFilterBehavior": DiscreteCriterionFilterType.hasAllOf,
        "tagFilterOptions": [],
        "dateFilterEnabled": true,
        "dateFilterBehavior": DiscreteCriterionFilterType.hasAllOf,
        "dateFilterOptions": [
            10002
        ]
    },
    {
        label: "Rehearsals since 60 days",
        helpText: "Searching rehearsals more recent than 60 days",
        "orderByColumn": "startsAt",
        "orderByDirection": "desc",
        "statusFilterEnabled": false,
        "statusFilterBehavior": DiscreteCriterionFilterType.hasNone,
        "statusFilterOptions": [],
        "typeFilterEnabled": true,
        "typeFilterBehavior": DiscreteCriterionFilterType.hasSomeOf,
        "typeFilterOptions": rehearsalTypeIds,
        "tagFilterEnabled": false,
        "tagFilterBehavior": DiscreteCriterionFilterType.hasAllOf,
        "tagFilterOptions": [],
        "dateFilterEnabled": true,
        "dateFilterBehavior": DiscreteCriterionFilterType.hasAllOf,
        "dateFilterOptions": [
            10003
        ]
    },
    {
        "label": "Past concerts",
        "helpText": "",
        "orderByColumn": "startsAt",
        "orderByDirection": "desc",
        "statusFilterEnabled": true,
        "statusFilterBehavior": DiscreteCriterionFilterType.hasSomeOf,
        "statusFilterOptions": confirmedStatusIds,
        "typeFilterEnabled": true,
        "typeFilterBehavior": DiscreteCriterionFilterType.hasSomeOf,
        "typeFilterOptions": concertTypeIds,
        "tagFilterEnabled": false,
        "tagFilterBehavior": DiscreteCriterionFilterType.hasAllOf,
        "tagFilterOptions": [],
        "dateFilterEnabled": true,
        "dateFilterBehavior": DiscreteCriterionFilterType.hasAllOf,
        "dateFilterOptions": [
            10000
        ]
    },
    ];
};

const gDefaultStaticFilterName = "Relevant" as const;


//////////////////////////////////////////////////////////////////////////////////////////////////
const EventListOuter = () => {
    const dashboardContext = useDashboardContext();
    const staticFilters = makeStaticFilters(dashboardContext);
    const defaultStaticFilterValue = staticFilters.find(x => x.label === gDefaultStaticFilterName)!;

    // Individual filter hooks - still needed for the search page hook
    const tagFilter = useDiscreteFilter({
        urlPrefix: "tg",
        db3Column: "tags",
        defaultBehavior: defaultStaticFilterValue.tagFilterBehavior,
        defaultOptions: defaultStaticFilterValue.tagFilterOptions,
        defaultEnabled: defaultStaticFilterValue.tagFilterEnabled,
    });

    const statusFilter = useDiscreteFilter({
        urlPrefix: "st",
        db3Column: "status",
        defaultBehavior: defaultStaticFilterValue.statusFilterBehavior,
        defaultOptions: defaultStaticFilterValue.statusFilterOptions,
        defaultEnabled: defaultStaticFilterValue.statusFilterEnabled,
    });

    const typeFilter = useDiscreteFilter({
        urlPrefix: "tp",
        db3Column: "type",
        defaultBehavior: defaultStaticFilterValue.typeFilterBehavior,
        defaultOptions: defaultStaticFilterValue.typeFilterOptions,
        defaultEnabled: defaultStaticFilterValue.typeFilterEnabled,
    });

    const dateFilter = useDiscreteFilter({
        urlPrefix: "dt",
        db3Column: "startsAt",
        defaultBehavior: defaultStaticFilterValue.dateFilterBehavior,
        defaultOptions: defaultStaticFilterValue.dateFilterOptions,
        defaultEnabled: defaultStaticFilterValue.dateFilterEnabled,
    });

    // Using useSearchPage hook for centralized search page logic
    const searchPage = useSearchPage<EventsFilterSpecStatic, EventsFilterSpec>({
        staticFilters,
        defaultStaticFilter: defaultStaticFilterValue,
        sortColumnKey: "orderByColumn",
        sortDirectionKey: "orderByDirection",
        filterMappings: [
            { filterHook: tagFilter, columnKey: "tagFilter" },
            { filterHook: statusFilter, columnKey: "statusFilter" },
            { filterHook: typeFilter, columnKey: "typeFilter" },
            { filterHook: dateFilter, columnKey: "dateFilter" },
        ],
        buildFilterSpec: ({ refreshSerial, quickFilter, sortColumn, sortDirection, filterMappings }) => {
            // Build the filter spec using the hook's filter mappings
            const filterSpec: EventsFilterSpec = {
                refreshSerial,
                quickFilter,
                orderByColumn: sortColumn as any,
                orderByDirection: sortDirection,
                tagFilter: tagFilter.enabled ? tagFilter.criterion : { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
                statusFilter: statusFilter.enabled ? statusFilter.criterion : { db3Column: "status", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
                typeFilter: typeFilter.enabled ? typeFilter.criterion : { db3Column: "type", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
                dateFilter: dateFilter.enabled ? dateFilter.criterion : { db3Column: "startsAt", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
            };
            return filterSpec;
        },
        buildStaticFilterSpec: ({ sortColumn, sortDirection, filterMappings }) => {
            const staticSpec: EventsFilterSpecStatic = {
                label: "(n/a)",
                helpText: "",
                orderByColumn: sortColumn as any,
                orderByDirection: sortDirection,
                statusFilterEnabled: statusFilter.enabled,
                statusFilterBehavior: statusFilter.criterion.behavior,
                statusFilterOptions: statusFilter.criterion.options,
                typeFilterEnabled: typeFilter.enabled,
                typeFilterBehavior: typeFilter.criterion.behavior,
                typeFilterOptions: typeFilter.criterion.options,
                tagFilterEnabled: tagFilter.enabled,
                tagFilterBehavior: tagFilter.criterion.behavior,
                tagFilterOptions: tagFilter.criterion.options,
                dateFilterEnabled: dateFilter.enabled,
                dateFilterBehavior: dateFilter.criterion.behavior,
                dateFilterOptions: dateFilter.criterion.options as number[],
            };
            return staticSpec;
        }
    });

    // Configuration for the generic SearchPageContent component
    const config: SearchPageContentConfig<EventsFilterSpecStatic, EventsFilterSpec, db3.EventSearchDto, db3.EventSearchClient> = {
        staticFilters,
        defaultStaticFilter: defaultStaticFilterValue,
        sortColumnOptions: EventOrderByColumnOptions,
        sortColumnNames: EventOrderByColumnNames,
        searchConfig: eventSearchConfig,
        renderItem: (event, index, filterSpec, results, refetch) => (
            <EventListItem
                event={event}
                filterSpec={filterSpec}
                refetch={refetch}
            />
        ),
        getItemKey: (event) => event.id,
        contextMarkerName: "EventList", csvExporter: {
            itemToCSVRow: (event, index) => {
                const dateRange = event.dateRange;
                const dateRangeSpec = dateRange?.getSpec();
                return {
                    Order: index.toString(),
                    ID: event.id.toString(),
                    Name: event.name || "",
                    Type: event.type?.text || "",
                    Status: event.status?.label || "",
                    StartsAt: dateRange
                        ? dateRange.getStartDateTime()?.toISOString() || "TBD"
                        : "",
                    IsAllDay: dateRangeSpec ? (dateRangeSpec.isAllDay ? "yes" : "no") : "",
                    DurationMinutes: dateRangeSpec
                        ? (dateRangeSpec.durationMillis / 60000).toString()
                        : "",
                    Location: event.locationDescription || "",
                    LocationURL: event.locationURL || "",
                    URL: dashboardContext.routingApi.getURIForEvent({ id: event.id, name: event.name || "" }),
                };
            },
            filename: "events"
        },
        showAdminControls: true,
    };

    // Filter hooks for passing to the generic component
    const filterHooks = {
        status: statusFilter,
        type: typeFilter,
        tags: tagFilter,
        date: dateFilter,
    };

    // Filter group definitions
    const filterGroupDefinitions: FilterGroupDefinition[] = [
        {
            key: "status",
            label: "Status",
            type: "foreignSingle",
            column: "status",
        },
        {
            key: "type",
            label: "Type",
            type: "foreignSingle",
            column: "type",
        },
        {
            key: "tags",
            label: "Tags",
            type: "tags",
            column: "tags",
        },
        {
            key: "date",
            label: "Date",
            type: "radio",
            column: "startsAt",
        },
    ];

    return (
        <SearchPageContent
            config={config}
            filterHooks={filterHooks}
            filterGroupDefinitions={filterGroupDefinitions}
            searchPageHook={searchPage}
        />
    );
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const SearchEventsPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Events">
            <AppContextMarker name="Event search page">
                <div className="eventsMainContent searchPage">
                    <Suspense>
                        <SettingMarkdown setting="events_markdown"></SettingMarkdown>
                    </Suspense>
                    <NewEventButton />

                    <EventListOuter />
                </div>
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default SearchEventsPage;
