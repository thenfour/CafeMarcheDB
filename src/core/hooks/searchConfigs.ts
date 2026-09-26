import { defineLegacySearchConfig, defineViewSearchConfig } from 'src/core/hooks/useSearchableList';
import * as db3 from 'src/core/db3/db3';
import { SongsFilterSpec } from '../components/song/SongClientBaseTypes';

import { EventsFilterSpec } from '../components/event/EventClientBaseTypes';
import { WikiPagesFilterSpec } from '../components/wiki/WikiClientBaseTypes';
import { UsersFilterSpec } from '../components/user/UserClientBaseTypes';
import { FilesFilterSpec } from '../components/file/FileClientBaseTypes';
import { enrichUser } from '../db3/shared/schema/enrichedUserTypes';

// Song search configuration
export const songSearchConfig = defineViewSearchConfig({
    view: db3.songSearchView,
    getQueryArgs: (filterSpec: SongsFilterSpec, offset: number, take: number) => ({
        offset,
        take,
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

    errorMessage: 'Failed to load more songs.',
});

// Event search configuration
export const eventSearchConfig = defineViewSearchConfig({
    view: db3.eventSearchView,
    getQueryArgs: (filterSpec: EventsFilterSpec, offset: number, take: number) => ({
        calendarWindow: filterSpec.calendarWindow,
        offset,
        take,
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

    errorMessage: 'Failed to load more events.',
});

// User search configuration
export const userSearchConfig = defineLegacySearchConfig({
    getQueryArgs: (filterSpec: UsersFilterSpec, offset: number, take: number) => ({
        offset,
        take,
        tableID: db3.xUser.tableID,
        includeDeleted: filterSpec.includeDeleted,
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

    enrichItem: (rawItem: db3.UserClientPayload, dashboardContext) => enrichUser(
        rawItem,
        dashboardContext.role,
        dashboardContext.userTag,
        dashboardContext.instrument,
    ),
    getItemKey: item => item.publicId,

    errorMessage: 'Failed to load more users.',
});

// File search configuration  
export const fileSearchConfig = defineViewSearchConfig({
    view: db3.fileSearchView,
    getQueryArgs: (filterSpec: FilesFilterSpec, offset: number, take: number) => ({
        offset,
        take,
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

    errorMessage: 'Failed to load more files.',
});

// Wiki page search configuration
export const wikiPageSearchConfig = defineViewSearchConfig({
    view: db3.wikiPageSearchView,
    getQueryArgs: (filterSpec: WikiPagesFilterSpec, offset: number, take: number) => ({
        offset,
        take,
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

    errorMessage: 'Failed to load more wiki pages.',
});
