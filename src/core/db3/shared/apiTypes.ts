import { CalendarWindow, CalendarWindowSchema } from "shared/dateTimePolicy";

import { Prisma } from "db";
import { z } from "zod";

import type { SortDirection, TAnyModel } from "shared/rootroot";

// this really loves to break the typescript compiler... safest to just use "any"
//export type TransactionalPrismaClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
export type TransactionalPrismaClient = any;
//export type TransactionalPrismaClient = PrismaClient;

export interface CMDBTableFilterItem { // from MUI GridFilterItem
    id?: number | string;
    field: string;
    value: any;
    operator: "equals";
}

// allow client users to specify cmdb-specific queries.
// normal filtering & quick filtering is great but this allows for example custom filtering like tagIds.
export interface CMDBTableFilterModel {
    items?: CMDBTableFilterItem[];
    quickFilterValues?: any[];

    // policy: pks only searchable by sysadmins (natural ids are not considered publicly-knowable)
    pks?: number[]; // if specified, find items `where id in (...pks)`
    publicIds?: string[]; // public transport identity for converted tables

    tagIds?: number[];
    tableParams?: TAnyModel;
};


export interface TupdateUserEventAttendanceMutationArgs {
    userId: number;
    eventId: number;
    comment?: string | null; // for event
    instrumentId?: number | null; // for event
    isInvited?: boolean | null; // for event

    // if undefined, attendance is not set.
    // any segment responses listed here are updated. if not listed, its existing record will be ignored.
    // key is segment ID.
    segmentResponses?: Record<number, {
        attendanceId: null | number; // for segments
    }>;

};

const ZPositiveRecordId = z.number().int().positive();

export const ZupdateUserEventAttendanceMutationArgs = z.object({
    userId: ZPositiveRecordId,
    eventId: ZPositiveRecordId,
    comment: z.string().nullable().optional(),
    instrumentId: ZPositiveRecordId.nullable().optional(),
    isInvited: z.boolean().nullable().optional(),
    segmentResponses: z.record(z.object({
        attendanceId: ZPositiveRecordId.nullable(),
    }).strict()).superRefine((responses, ctx) => {
        const segmentIds = Object.keys(responses);
        if (segmentIds.length > 1000) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "At most 1000 segment responses may be updated at once",
            });
        }
        segmentIds.forEach(segmentId => {
            const parsed = Number(segmentId);
            if (!/^\d+$/.test(segmentId) || !Number.isSafeInteger(parsed) || parsed <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Invalid event segment ID '${segmentId}'`,
                });
            }
        });
    }).optional(),
}).strict().superRefine((args, ctx) => {
    const hasSegmentResponse = Object.keys(args.segmentResponses || {}).length > 0;
    if (args.comment === undefined
        && args.instrumentId === undefined
        && args.isInvited === undefined
        && !hasSegmentResponse) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "At least one attendance or invitation field is required",
        });
    }
}) as z.ZodType<TupdateUserEventAttendanceMutationArgs>;

// export interface TupdateUserEventInvitationMutationArgs {
//     userId: number;
//     eventId: number;
//     //eventSegmentIds: number[];
//     isInvited: boolean;
// };

export interface TupdateEventBasicFieldsArgs {
    eventId: number;
    name?: string;
    //slug?: string;
    //description?: string;
    typeId?: number;
    locationDescription?: string;
    locationURL?: string;
    isDeleted?: boolean;
    statusId?: number;
    expectedAttendanceUserTagId?: number | null;
    visiblePermissionId?: number | null;
    createdByUserId?: number;

    frontpageVisible?: boolean;
    frontpageDate?: string;  // e.g. "Zaterdag 11 november"
    frontpageTime?: string; // e.g. 14u
    frontpageTitle?: string | null; // null = use normal one
    frontpageDetails?: string;
    frontpageLocation?: string | null; // null = use normal
    frontpageLocationURI?: string | null; // null = use normal
    frontpageTags?: string | null; // null, use normal

    frontpageDate_nl?: string;  // e.g. "Zaterdag 11 november"
    frontpageTime_nl?: string; // e.g. 14u
    frontpageTitle_nl?: string | null; // null = use normal one
    frontpageDetails_nl?: string;
    frontpageLocation_nl?: string | null; // null = use normal
    frontpageLocationURI_nl?: string | null; // null = use normal
    frontpageTags_nl?: string | null; // null, use normal

    frontpageDate_fr?: string;  // e.g. "Zaterdag 11 november"
    frontpageTime_fr?: string; // e.g. 14u
    frontpageTitle_fr?: string | null; // null = use normal one
    frontpageDetails_fr?: string;
    frontpageLocation_fr?: string | null; // null = use normal
    frontpageLocationURI_fr?: string | null; // null = use normal
    frontpageTags_fr?: string | null; // null, use normal
}



export interface TupdateSongBasicFieldsArgs {
    songId: number;
    description?: string;
}




export interface TupdateUserPrimaryInstrumentMutationArgs {
    userId: number;
    instrumentId: number;
};

export interface TinsertEventCommentArgs {
    eventId: number;
    text: string;
    visiblePermissionId: number | null;
    // created by user id = current user always
    // created at, updated at = automatic
};

export interface TinsertEventSong {
    songId: number;
    songName?: string; // not always used; context-dependent.
    comment: string;
};

export interface TinsertEventResponse {
    userId: number;
    userName?: string; // not always used; context-dependent.
    attendanceId: number;
};

export interface TinsertEventArgs {
    event: {
        name: string,
        //description: string,
        locationDescription: string | null,
        //slug: string,
        typeId: number | null,
        statusId: number | null,
        tags: number[],
        expectedAttendanceUserTagId: number | null,
        visiblePermissionId: number | null;
    },
    segment: {
        startsAt: Date | null,
        durationMillis: number,
        isAllDay: boolean,
        name: string,
        description: string,
    },
    songList?: TinsertEventSong[],
    responses?: TinsertEventResponse[],
}

export interface TupdateEventCommentArgs {
    id: number;
    text?: string;
    visiblePermissionId?: number | null;
    // cannot change:
    // - event id
    // - user id
    // - created at
    // updated at = automatic
};


export const TGeneralDeleteArgsSchema = z.object({
    id: z.number(),
});

export type TGeneralDeleteArgs = z.infer<typeof TGeneralDeleteArgsSchema>;

// export type TGeneralDeleteArgs = {
//     id: number;
// };

export interface TdeleteEventCommentArgs {
    id: number;
};


export interface TinsertOrUpdateEventSongListSong {
    id?: number;
    // don't rely on array ordering because it's shuffled etc during the change plan computation
    sortOrder: number;
    songId: number;
    subtitle: string;
};

export interface TinsertOrUpdateEventSongListDivider {
    id?: number;
    // don't rely on array ordering because it's shuffled etc during the change plan computation
    sortOrder: number;
    color: string | null | undefined;
    isInterruption: boolean;
    subtitleIfSong: string | null;
    isSong: boolean;
    lengthSeconds: number | null;
    textStyle: null | string; // EventSongListDividerTextStyle
    subtitle: string;
};

export interface TinsertOrUpdateEventSongListArgs {
    id?: number; // for insertion, this is not used / specified.
    name: string;
    description: string;
    isActuallyPlayed: boolean;
    isOrdered: boolean;
    eventId: number;
    sortOrder: number;
    songs: TinsertOrUpdateEventSongListSong[];
    dividers: TinsertOrUpdateEventSongListDivider[];
};

export const ZupdateGenericSortOrderArgs = z.object({
    tableID: z.string().min(1).max(128).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    tableName: z.string().min(1).max(128).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    movingItemId: ZPositiveRecordId, // pk of the item being moved
    newPositionItemId: ZPositiveRecordId, // pk of the item this should replace.
    scopeRowIds: z.array(ZPositiveRecordId).min(1).max(1000),
    groupByColumn: z.string().min(1).max(128).regex(/^[A-Za-z][A-Za-z0-9_]*$/).optional(),
    groupValue: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]).optional(),
}).strict().superRefine((args, ctx) => {
    const hasGroupingColumn = args.groupByColumn !== undefined;
    const hasGroupValue = args.groupValue !== undefined;
    if (hasGroupingColumn !== hasGroupValue) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "groupByColumn and groupValue must be supplied together",
        });
    }

    if (new Set(args.scopeRowIds).size !== args.scopeRowIds.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scopeRowIds"],
            message: "scopeRowIds must not contain duplicates",
        });
    }

    if (!args.scopeRowIds.includes(args.movingItemId)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["movingItemId"],
            message: "movingItemId must be included in scopeRowIds",
        });
    }

    if (!args.scopeRowIds.includes(args.newPositionItemId)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["newPositionItemId"],
            message: "newPositionItemId must be included in scopeRowIds",
        });
    }
});

export type TupdateGenericSortOrderArgs = z.infer<typeof ZupdateGenericSortOrderArgs>;


export interface GetEventFilterInfoChipInfo {
    rowCount: number;

    id: number;

    label: string;
    color: string | null;
    iconName: string | null;
    tooltip: string | null;
};

// exclusive
export type TimingFilter = "past" | "since 60 days" | "relevant" | "future" | "all";

export const gEventFilterTimingIDConstants = {
    past: 0,
    future: 1,
};
export interface GetEventFilterInfoRet {
    rowCount: number;
    eventIds: number[];

    types: GetEventFilterInfoChipInfo[];
    statuses: GetEventFilterInfoChipInfo[];
    tags: GetEventFilterInfoChipInfo[];
    //timings: GetEventFilterInfoChipInfo[];

    typesQuery: string;
    statusesQuery: string;
    tagsQuery: string;
    paginatedEventQuery: string;

    totalExecutionTimeMS: number;

    fullEvents: unknown[],
    userTags: unknown[],
};

export const MakeGetEventFilterInfoRet = (): GetEventFilterInfoRet => ({
    statuses: [],
    tags: [],
    types: [],
    //timings: [],
    eventIds: [],
    rowCount: 0,
    typesQuery: "",
    statusesQuery: "",
    tagsQuery: "",
    paginatedEventQuery: "",

    totalExecutionTimeMS: 0,
    fullEvents: [],
    userTags: [],
});

export const EventRelevantFilterExpression = (args: { startsAtExpr: string }) => `((${args.startsAtExpr} >= DATE_SUB(curdate(), INTERVAL 6 day)) OR (${args.startsAtExpr} IS NULL))`;
export const EventPast60DaysFilterExpression = (args: { startsAtExpr: string }) => `((${args.startsAtExpr} >= DATE_SUB(curdate(), INTERVAL 60 day)) OR (${args.startsAtExpr} IS NULL))`;
export const EventPastFilterExpression = (args: { startsAtExpr: string }) => `(${args.startsAtExpr} <= curdate())`;
export const EventFutureFilterExpression = (args: { startsAtExpr: string }) => `(${args.startsAtExpr} > curdate())`;
export const EventThisYearFilterExpression = (args: { startsAtExpr: string }) => `(year(${args.startsAtExpr}) = year(curdate()))`;


export type SongSelectionFilter = "relevant" | "all";

export interface GetSongFilterInfoRet {
    rowCount: number;
    songIds: number[];

    tags: GetEventFilterInfoChipInfo[];
    tagsQuery: string;
    paginatedResultQuery: string;
    totalRowCountQuery: string;

    fullSongs: any[];
};



export const GetFilteredSongsItemSongSelect = Prisma.validator<Prisma.SongSelect>()({
    name: true,
    id: true,
    aliases: true,
    startBPM: true,
    endBPM: true,
    tags: true,
    //visiblePermission: true,
    lengthSeconds: true,
    introducedYear: true,
});

export type GetFilteredSongsItemSongPayload = Prisma.SongGetPayload<{
    select: typeof GetFilteredSongsItemSongSelect,
}>;

export interface GetFilteredSongsRet {
    matchingItem: GetFilteredSongsItemSongPayload | null;
};

export const MakeGetSongFilterInfoRet = (): GetSongFilterInfoRet => ({
    rowCount: 0,
    songIds: [],

    tags: [],

    tagsQuery: "",
    paginatedResultQuery: "",
    totalRowCountQuery: "",
    fullSongs: [],
});

// UIDs need to be url path compatible. So a slash cannot be used because it would break routing.
// we use:
// event uid is like "48f0e9ad-9354-4664-8a6d-a4681e14e75c"
// user uid is another uuid like "d290f1ee-6c54-4b01-90e6-d701748f0851"
// https://datatracker.ietf.org/doc/html/rfc7986#section-5.3
// original RFC described an email like <uuid>@example.com format, but newer RFC
// discourages identifiability.
export function MakeICalEventUid(eventUid: string, userUid: string | null) {
    return `${eventUid}_${userUid || "public"}`;
}

export function GetICalRelativeURIForUserUpcomingEvents(args: { calendarFeedToken: string | null }) {
    return `/api/ical/user/${encodeURIComponent(args.calendarFeedToken || "public")}/upcoming`;
}

interface AutoAssignInstrumentPartitionArgs {
    allInstruments: Prisma.InstrumentGetPayload<{}>[];
    fileLeafWithoutExtension: string;
};

interface AutoAssignInstrumentPartitionRet {
    matchingInstrumentIds: number[];
};

export const AutoAssignInstrumentPartition = ({ allInstruments, fileLeafWithoutExtension }: AutoAssignInstrumentPartitionArgs): AutoAssignInstrumentPartitionRet => {
    const matchingInstrumentIds: number[] = [];
    if (!fileLeafWithoutExtension) return {
        matchingInstrumentIds,
    };

    const localIsNullOrWhitespace = (s) => {
        if (s == null) return true;
        if (typeof (s) !== 'string') return false;
        return (s.trim() === "");
    };

    // Iterate over all instruments and check if the file leaf matches the regex
    allInstruments.forEach(instrument => {
        if (localIsNullOrWhitespace(instrument.autoAssignFileLeafRegex)) return;
        const regex = new RegExp(instrument.autoAssignFileLeafRegex!, 'i'); // case insensitive
        if (regex.test(fileLeafWithoutExtension)) {
            matchingInstrumentIds.push(instrument.id);
        }
    });

    return {
        matchingInstrumentIds
    };
};


export enum GetSongActivityReportFilterSpecTimingFilter {
    "All past",
    "Past 5 years",
    "Past year",
    "Future",
    "All",
};

export interface GetSongActivityReportFilterSpec {
    eventTypeIds: number[];
    timing: keyof typeof GetSongActivityReportFilterSpecTimingFilter;
    eventTagIds: number[];
    eventStatusIds: number[];
};

export interface GetSongActivityReportArgs {
    songId: number;
    filterSpec: GetSongActivityReportFilterSpec;
};

export interface GetSongActivityReportRetEvent {
    id: number,
    name: string,
    startsAt: null | Date,
    durationMillis: bigint,
    isAllDay: boolean,
    endDateTime: null | Date,
};

export interface GetSongActivityReportRet {
    events: GetSongActivityReportRetEvent[];
    query: string;
};





export interface GetGlobalStatsFilterSpec {
    eventTypeIds: number[];
    timing: keyof typeof GetSongActivityReportFilterSpecTimingFilter;
    eventTagIds: number[];
    eventStatusIds: number[];
    songTagIds: number[];
};

export interface GetGlobalStatsArgs {
    filterSpec: GetGlobalStatsFilterSpec;
};

export interface GetGlobalStatsRetEvent {
    id: number,
    name: string,
    startsAt: null | Date,
    durationMillis: bigint,
    isAllDay: boolean,
    endDateTime: null | Date,
    typeId: number | null,
    statusId: number | null,
};

export interface GetGlobalStatsRetPopularSongOccurrance {
    songId: number,
    songName: string,
    eventId: number,
    eventName: string,
    typeId: number | null,
    statusId: number | null,
    startsAt: null | Date,
    durationMillis: bigint,
    isAllDay: boolean,
    endDateTime: null | Date,
};

export interface GetGlobalStatsRet {
    allEvents: GetGlobalStatsRetEvent[];
    popularSongsOccurrances: GetGlobalStatsRetPopularSongOccurrance[];
    eventsQuery: string;
    popularSongsQuery: string;
};

export interface TGetImportEventDataArgs {
    text: string;
    config: string;
};

export interface TGetImportEventDataRet {
    log: string[],
    event: {
        name: string,
        //description: string;
        typeId: number | null,
        statusId: number | null,
        tags: number[],
        expectedAttendanceUserTagId: number | null,
        visiblePermissionId: number | null;
    },
    segment: {
        startsAt: Date | null,
        durationMillis: number,
        isAllDay: boolean,
        name: string,
    },
    songList: TinsertEventSong[],
    responses: TinsertEventResponse[],
};


///////////////////////////////////////////////////////

export interface SearchResultsFacetOption {
    id: number | string;
    rowCount: number;
    extraInfo?: unknown; // for things like filtering by date facets, this could specify what kind of facet it is, or additional type-specific info about the facet.

    label: string | null;
    color: string | null;
    iconName: string | null;
    tooltip: string | null;
    shape: "rounded" | "rectangle" | undefined;
};

export interface SearchResultsFacet {
    db3Column: string;
    items: SearchResultsFacetOption[];
};

export interface SearchResultsFacetQuery {
    sql: string;
    transformResult: (row: TAnyModel) => SearchResultsFacetOption;
};

export interface SearchQueryMetric {
    title: string;
    millis: number;
    query: string;
    rowCount: number;
};


export interface CalculateFilterQueryResult {
    sqlSelect: string;
    errors: { column: string, error: string }[];
};


export interface SearchResultsRet {
    rowCount: number;
    allIdsInOrder: number[];
    results: any[];
    facets: SearchResultsFacet[];
    filterQueryResult: CalculateFilterQueryResult;

    // use case: events search results also want to do some extra querying
    // to avoid further query roundtrips. in particular, more info about invited
    // users, user tags, etc, to be returned separate from the main search results array.
    customData: unknown;

    queryMetrics: SearchQueryMetric[];
};

export function MakeEmptySearchResultsRet(): SearchResultsRet {
    return {
        facets: [],
        allIdsInOrder: [],
        results: [],
        rowCount: 0,
        customData: null,
        queryMetrics: [],
        filterQueryResult: {
            errors: [],
            sqlSelect: "",
        },
    }
};

export interface CriterionQueryElements {
    error: string | undefined;
    whereAnd: string;
    // joins
    // havings
    // ...?
};

export interface SortQuerySelectElement {
    expression: string;
    alias: string;
    direction: SortDirection;
};

export interface SortQueryJoinElement {
    expression: string;
    alias: string;
};

export interface SortQueryElements {
    select: SortQuerySelectElement[];
    join: SortQueryJoinElement[];
    // havings
    // ...?
};

export enum DiscreteCriterionFilterType {
    alwaysMatch = "alwaysMatch",
    hasNone = "hasNone",// no options required
    hasSomeOf = "hasSomeOf",
    hasAllOf = "hasAllOf",
    hasAny = "hasAny", // no options required
    doesntHaveAnyOf = "doesntHaveAnyOf",
    doesntHaveAllOf = "doesntHaveAllOf",
};

// criterion for discrete items like tags or foreign references.
// could also be integers, boolean, enum values, that kind of thing.
// but would not work for dates, strings, floats, etc.
export interface DiscreteCriterion {
    // the db3 column name. for a foreign ref for example this would be "type" or "tag", NOT "typeId" etc;
    // because SQL query is passed to the column where the correct SQL column would be used.
    db3Column: string;

    // which items has the user selected for filtering.
    options: (number | boolean | string)[];

    // type of filtering
    behavior: DiscreteCriterionFilterType;
};


export enum SearchCustomDataHookId {
    Events = "Events",
};

export interface GetSearchResultsSortModel {
    db3Column: string; // the db3 column name to use for sorting
    direction: SortDirection,
};

export interface GetSearchResultsInput {
    calendarWindow?: CalendarWindow;
    tableID: string;
    includeDeleted?: boolean;

    // pageSize: number;
    // page: number;
    offset: number;
    take: number;

    sort: GetSearchResultsSortModel[];

    quickFilter: string,
    discreteCriteria: DiscreteCriterion[],
};



// alphanumerics or underscores only.
const ZDBSymbol = z.string().regex(/^[a-zA-Z0-9_]+$/);

// Enum for SortDirection as a Zod enum
const ZSortDirection = z.enum(["asc", "desc"]);

// Zod schema for DiscreteCriterionFilterType using enum values
const ZDiscreteCriterionFilterType = z.nativeEnum(DiscreteCriterionFilterType);

// Zod schema for DiscreteCriterion
const ZDiscreteCriterion = z.object({
    db3Column: ZDBSymbol,
    options: z.array(z.union([z.number(), z.boolean(), ZDBSymbol])),
    behavior: ZDiscreteCriterionFilterType,
});

// Zod schema for GetSearchResultsSortModel
const ZGetSearchResultsSortModel = z.object({
    db3Column: ZDBSymbol,
    direction: ZSortDirection,
});

// Zod schema for GetSearchResultsInput
export const ZGetSearchResultsInput = z.object({
    calendarWindow: CalendarWindowSchema.optional(),
    tableID: ZDBSymbol,
    includeDeleted: z.boolean().optional(),

    offset: z.number(),
    take: z.number(),

    sort: z.array(ZGetSearchResultsSortModel),

    quickFilter: z.string(),
    discreteCriteria: z.array(ZDiscreteCriterion),
});




export type TableStatsQueryRowRaw = {
    TABLE_NAME: string,
    TABLE_ROWS: BigInt,
    INDEX_LENGTH: BigInt,
    DATA_LENGTH: BigInt,
}

export type TableStatsQueryRow = {
    table_name: string,
    table_rows: number,
    index_length: number,
    data_length: number,
}

export type FileStatResult = {
    fileName: string,
    size: number,
    modified: Date,
    isDirectory: boolean,
}

export type ServerHealthFileResult = FileStatResult & {
    fileId: number | undefined;
    leafName: string | undefined;
    isDeleted: boolean | undefined;
    mimeType: string | undefined;
    uploadedByUserId: number | undefined;
    uploadedAt: Date | undefined;
    externalURI: string | undefined;

};

export type GetServerHealthResult = {
    database: {
        tableStats: TableStatsQueryRow[],
        tableStatsQuery: string,
    },
    uploads: {
        files: ServerHealthFileResult[],
    },
    env: Record<string, string | undefined>,
};


export interface ICalEventJSON {
    start: Date;
    end?: Date;
    summary: string;
    uid: string,
    description?: {
        plain?: string;
        html?: string;
    };
    location?: string;
    organizer?: {
        name: string;
        email?: string;
        mailto?: string;
        sentBy?: string;
    };
    //attendees?: string[]; complex and we don't do this anyway so ignore.
    allDay: boolean;
    url?: string;
    status?: string;
    sequence?: number;

}

export interface ICalCalendarJSON {
    executionTimeMillis: number,
    prodId?: string;// { company: string; product: string; language: string };
    name: string;
    timezone?: string;

    description?: string;
    method?: string;
    scale?: string;
    source?: string;
    url?: string;

    iCalText: string;
    events: ICalEventJSON[];
}






export type GetUserAttendanceArgs = {
    userId: number;
    eventId: number;
}

export type GetUserAttendanceRet = {
    userId: number;
    eventId: number;
    comment: string | null;
    instrumentId: number | null;
    segmentResponses: {
        segmentId: number,
        name: string,
        attendanceId: number | null,
        statusId: number | null,
        startsAt: Date | null,
        durationMillis: number | null,
        isAllDay: boolean,
    }[];

};


export const PermissionSignificance = {
    General: "General",
    Visibility_Public: "Visibility_Public",
    Visibility_LoggedInUsers: "Visibility_LoggedInUsers",
    Visibility_Members: "Visibility_Members",
    Visibility_Editors: "Visibility_Editors",
} as const satisfies Record<string, string>;

export type TSongPinnedRecording = Prisma.FileGetPayload<{}>;


// sorts by start date, from newest to latest, NULL = future.
export function sortEvents<T extends { startsAt: null | Date }>(events: T[]): T[] {
    const ret = [...events];
    ret.sort((a, b) => {
        if (a.startsAt === null || b.startsAt === null) {
            return a.startsAt === null ? 1 : -1;
        }
        return a.startsAt.valueOf() - b.startsAt.valueOf();
    });

    return ret;
}
