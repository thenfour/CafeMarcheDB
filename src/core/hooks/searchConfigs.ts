import { SearchableListConfig } from 'src/core/hooks/useSearchableList';
import * as db3 from 'src/core/db3/db3';
import { SongsFilterSpec } from '../components/song/SongClientBaseTypes';

import { EventsFilterSpec } from '../components/event/EventClientBaseTypes';
import { EnrichedVerboseWikiPage, WikiPagesFilterSpec } from '../components/wiki/WikiClientBaseTypes';
import { UsersFilterSpec } from '../components/user/UserClientBaseTypes';
import { FilesFilterSpec } from '../components/file/FileClientBaseTypes';
import { EnrichedVerboseUser } from '../components/user/UserListItem';
import { enrichUser } from '../db3/shared/schema/enrichedUserTypes';
import { EnrichedVerboseSong, enrichSong } from '../db3/shared/schema/enrichedSongTypes';
import { EnrichedSearchEventPayload, enrichSearchResultEvent } from '../db3/shared/schema/enrichedEventTypes';
import { EnrichedVerboseFile, enrichFile } from '../db3/shared/schema/enrichedFileTypes';

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
        enrichSong(rawItem, dashboardContext),

    errorMessage: 'Failed to load more songs.',
};

// Event search configuration
export const eventSearchConfig: SearchableListConfig<
    EventsFilterSpec,
    db3.EventVerbose_Event,
    EnrichedSearchEventPayload
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
        enrichSearchResultEvent(rawItem, dashboardContext),

    errorMessage: 'Failed to load more events.',
};

// User search configuration
export const userSearchConfig: SearchableListConfig<
    UsersFilterSpec,
    db3.UserPayload,
    EnrichedVerboseUser
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
        enrichUser(rawItem, role, userTag, instrument),

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
        enrichFile(rawItem, dashboardContext),

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
            filterSpec.namespaceFilter,
        ],
    }),

    enrichItem: (rawItem: db3.WikiPagePayload, dashboardContext) => rawItem, // Wiki pages don't need enrichment

    errorMessage: 'Failed to load more wiki pages.',
};
