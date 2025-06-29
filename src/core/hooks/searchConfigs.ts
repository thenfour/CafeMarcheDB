import { SearchableListConfig } from 'src/core/hooks/useSearchableList';
import * as db3 from 'src/core/db3/db3';
import { SongsFilterSpec, EnrichedVerboseSong } from 'src/core/components/SongComponentsBase';
import { EventsFilterSpec } from 'src/core/components/EventComponentsBase';
import { UsersFilterSpec } from 'src/core/components/UserComponents';
import { FilesFilterSpec, EnrichedVerboseFile } from 'src/core/components/FileComponentsBase';
import { WikiPagesFilterSpec, EnrichedVerboseWikiPage } from 'src/core/components/WikiPageComponentsBase';

// Song search configuration
export const songSearchConfig: SearchableListConfig<
    SongsFilterSpec,
    db3.SongPayload_Verbose,
    EnrichedVerboseSong
> = {
    getQueryArgs: (filterSpec: SongsFilterSpec, offset: number, take: number) => ({
        offset,
        take,
        tableID: db3.xSong_Verbose.tableID,
        refreshSerial: filterSpec.refreshSerial,
        sort: [{
            db3Column: filterSpec.orderByColumn,
            direction: filterSpec.orderByDirection,
        }],
        quickFilter: filterSpec.quickFilter,
        discreteCriteria: [
            filterSpec.tagFilter,
        ],
    }),

    enrichItem: (rawItem: db3.SongPayload_Verbose, dashboardContext) =>
        db3.enrichSong(rawItem, dashboardContext),

    errorMessage: 'Failed to load more songs.',
};

// Event search configuration
export const eventSearchConfig: SearchableListConfig<
    EventsFilterSpec,
    db3.EventVerbose_Event,
    db3.EnrichedSearchEventPayload
> = {
    getQueryArgs: (filterSpec: EventsFilterSpec, offset: number, take: number) => ({
        offset,
        take,
        tableID: db3.xEvent.tableID,
        refreshSerial: filterSpec.refreshSerial,
        sort: [{
            db3Column: filterSpec.orderByColumn,
            direction: filterSpec.orderByDirection,
        }],
        quickFilter: filterSpec.quickFilter,
        discreteCriteria: [
            filterSpec.dateFilter,
            filterSpec.typeFilter,
            filterSpec.statusFilter,
            filterSpec.tagFilter,
        ],
    }),

    enrichItem: (rawItem: db3.EventVerbose_Event, dashboardContext) =>
        db3.enrichSearchResultEvent(rawItem, dashboardContext),

    errorMessage: 'Failed to load more events.',
};

// User search configuration
export const userSearchConfig: SearchableListConfig<
    UsersFilterSpec,
    db3.UserPayload,
    db3.EnrichedVerboseUser
> = {
    getQueryArgs: (filterSpec: UsersFilterSpec, offset: number, take: number) => ({
        offset,
        take,
        tableID: db3.xUser.tableID,
        refreshSerial: filterSpec.refreshSerial,
        sort: [{
            db3Column: filterSpec.orderByColumn,
            direction: filterSpec.orderByDirection,
        }],
        quickFilter: filterSpec.quickFilter,
        discreteCriteria: [
            filterSpec.tagFilter,
            filterSpec.roleFilter,
            filterSpec.instrumentFilter,
        ],
    }),

    enrichItem: (rawItem: db3.UserPayload, dashboardContext, role, userTag, instrument) =>
        db3.enrichUser(rawItem, role, userTag, instrument),

    getEnrichmentArgs: (dashboardContext) => [
        dashboardContext.role,
        dashboardContext.userTag,
        dashboardContext.instrument
    ],

    errorMessage: 'Failed to load more users.',
};

// File search configuration  
export const fileSearchConfig: SearchableListConfig<
    FilesFilterSpec,
    db3.FilePayload,
    EnrichedVerboseFile
> = {
    getQueryArgs: (filterSpec: FilesFilterSpec, offset: number, take: number) => ({
        offset,
        take,
        tableID: db3.xFile.tableID,
        refreshSerial: filterSpec.refreshSerial,
        sort: [{
            db3Column: filterSpec.orderByColumn,
            direction: filterSpec.orderByDirection,
        }],
        quickFilter: filterSpec.quickFilter,
        discreteCriteria: [
            filterSpec.tagFilter,
            filterSpec.taggedInstrumentFilter,
        ],
    }),

    enrichItem: (rawItem: db3.FilePayload, dashboardContext) =>
        db3.enrichFile(rawItem, dashboardContext),

    errorMessage: 'Failed to load more files.',
};

// Wiki page search configuration
export const wikiPageSearchConfig: SearchableListConfig<
    WikiPagesFilterSpec,
    db3.WikiPagePayload,
    EnrichedVerboseWikiPage
> = {
    getQueryArgs: (filterSpec: WikiPagesFilterSpec, offset: number, take: number) => ({
        offset,
        take,
        tableID: db3.xWikiPage.tableID,
        refreshSerial: filterSpec.refreshSerial,
        sort: [{
            db3Column: filterSpec.orderByColumn,
            direction: filterSpec.orderByDirection,
        }],
        quickFilter: filterSpec.quickFilter,
        discreteCriteria: [
            filterSpec.tagFilter,
            //filterSpec.namespaceFilter,
            //filterSpec.visibilityFilter,
        ],
    }),

    enrichItem: (rawItem: db3.WikiPagePayload, dashboardContext) => rawItem, // Wiki pages don't need enrichment

    errorMessage: 'Failed to load more wiki pages.',
};
