
import { Prisma } from "db";
import { SortDirection } from "shared/rootroot";
import { z } from "zod";

// types used by mutations and other blitzy-things which can't export more than 1 thing, or just as a "no dependency" base

export type TAnyModel = { [key: string]: any };


export const gNullValue = "__null__498b0049-f883-4c77-9613-c8712e49e183";
export const gIDValue = "__id__498b0049-f883-4c77-9613-c8712e49e183";
export const gNameValue = "__name__498b0049-f883-4c77-9613-c8712e49e183";



export interface CMDBTableFilterItem { // from MUI GridFilterItem
    id?: number | string;
    field: string;
    value?: any;
    operator: "equals";
}

// allow client users to specify cmdb-specific queries.
// normal filtering & quick filtering is great but this allows for example custom filtering like tagIds.
export interface CMDBTableFilterModel {
    items: CMDBTableFilterItem[];
    quickFilterValues?: any[];
    pks?: number[]; // if specified, find items `where id in (...pks)`

    tagIds?: number[];
    tableParams?: TAnyModel;
};



export interface Size {
    width: number;
    height: number;
}

export const SizeToString = (x: Size): string => {
    return `[${x.width.toFixed(0)} x ${x.height.toFixed(0)}]`;
}

export interface Coord2D {
    x: number;
    y: number;
};

export const Coord2DToString = (x: Coord2D): string => {
    return `(${x.x.toFixed(0)}, ${x.y.toFixed(0)})`;
}

export const MulSize = (a: Size, f: number): Size => {
    return {
        width: a.width * f,
        height: a.height * f,
    }
};

export const MulSizeBySize = (a: Size, f: Size): Size => {
    return {
        width: a.width * f.width,
        height: a.height * f.height,
    }
};

export const AddCoord2DSize = (a: Coord2D, b: Size): Coord2D => {
    return {
        x: a.x + b.width,
        y: a.y + b.height,
    }
};


export interface TupdateUserEventAttendanceMutationArgs {
    userId: number;
    eventId?: number; // if not specified, comment & instrumentId are ignored.
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

// export interface TupdateUserEventInvitationMutationArgs {
//     userId: number;
//     eventId: number;
//     //eventSegmentIds: number[];
//     isInvited: boolean;
// };

export interface TupdateEventBasicFieldsArgs {
    eventId: number;
    name?: string;
    slug?: string;
    description?: string;
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
        description: string,
        locationDescription: string | null,
        slug: string,
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

export type TGeneralDeleteArgs = {
    id: number;
};

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

export interface TinsertOrUpdateEventSongListArgs {
    id?: number; // for insertion, this is not used / specified.
    name: string;
    description: string;
    isActuallyPlayed: boolean;
    isOrdered: boolean;
    eventId: number;
    sortOrder: number;
    songs: TinsertOrUpdateEventSongListSong[];
};

export interface TClientFileUploadTags {
    taggedUserId?: number;
    taggedSongId?: number;
    taggedEventId?: number;
    taggedInstrumentId?: number;
    fileTagId?: number;
};

// interface from upload.ts to mutation. files themselves contain much of the data; this is only for associations.
export interface TClientUploadFileArgs extends TClientFileUploadTags {
    visiblePermissionId?: number;
    visiblePermission?: string; // in case you don't have access to an ID.
    externalURI?: string | null;
};

export interface TClientUpdateFile {
    id?: number;
    fileLeafName?: string;
    description?: string;
    isDeleted?: boolean; // allow soft delete via mutation
    visiblePermissionId?: number | null;

    tagsIds?: number[];
    taggedUserIds?: number[];
    taggedSongIds?: number[];
    taggedEventIds?: number[];
    taggedInstrumentIds?: number[];
};


// https://stackoverflow.com/questions/36836011/checking-validity-of-string-literal-union-type-at-runtime
export const ImageFileFormatOptions = {
    "png": {},
    "jpg": {},
    "heic": {},
    "webp": {},
} as const;

export type ImageFileFormat = keyof typeof ImageFileFormatOptions;



export interface ImageEditParams {
    cropBegin: Coord2D;
    cropSize: Size | null; // if null use image end bound.
    rotate: number;
};

export const MakeDefaultImageEditParams = (): ImageEditParams => ({
    cropBegin: { x: 0, y: 0 },
    cropSize: null,
    rotate: 0
});

export interface ImageMetadata {
    width?: number | undefined;
    height?: number | undefined;
};

export interface FileCustomData {
    // each physical file gets its own File record, therefore this should explain what its relationship is to its parent / related file(s).
    // JSON of FileCustomData that will depend how i feel like using it based on mimetype. links to thumbnails, metadata, pdf series of thumbnails, whatev.
    relationToParent?: "thumbnail" | "forkedImage";
    forkedImage?: { // when relationToParent is forkedImage.
        creationEditParams: ImageEditParams, // the parameters that were used to generate this forked image.
    };
    imageMetadata?: ImageMetadata;
    audioMetadata?: {
        bitrate: string;
        lengthMillis?: number;
    };
};

export const MakeDefaultFileCustomData = (): FileCustomData => ({});

// always returns valid due to having createDefault
export const parsePayloadJSON = <T,>(value: null | undefined | string, createDefault: (val: null | undefined | string) => T, onError?: (e) => void): T => {
    if (value === null || value === undefined || (typeof value !== 'string') || value.trim() === "") {
        return createDefault(value);
    }
    try {
        return JSON.parse(value) as T;
    } catch (err) {
        if (onError) onError(err);
        console.log(err);
        return createDefault(value);
    }
};

// always returns valid
export const getFileCustomData = (f: Prisma.FileGetPayload<{}>): FileCustomData => {
    return parsePayloadJSON<FileCustomData>(f.customData, MakeDefaultFileCustomData, (e) => {
        console.log(`failed to parse file custom data for file id ${f.id}, storedLeafName:${f.storedLeafName}, mime:${f.mimeType}`);
    });
};

export interface TupdateGenericSortOrderArgs {
    tableID: string;
    tableName: string;
    movingItemId: number; // pk of the item being moved
    newPositionItemId: number; // pk of the item this should replace.
};


export interface UploadResponsePayload {
    files: Prisma.FileGetPayload<{}>[];
    isSuccess: boolean;
    errorMessage?: string;
};

export const MakeErrorUploadResponsePayload = (errorMessage: string): UploadResponsePayload => ({
    files: [],
    isSuccess: false,
    errorMessage,
});


export interface ForkImageParams {
    parentFileId: number; // which image file to use. for gallery items it may be different than the previous one.
    outputType: ImageFileFormat;
    quality: number; // 0-100 corresponds with jpeg quality / https://sharp.pixelplumbing.com/api-output options.quality.
    editParams: ImageEditParams;
    newDimensions?: Size;
};

export interface UpdateGalleryItemImageParams {
    galleryItemId: number;
    imageParams: ForkImageParams;
};



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
    matchingItems: GetFilteredSongsItemSongPayload[];
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


export function GetICalRelativeURIForUserAndEvent(args: { userAccessToken: string | null, eventUid: string | null }) {
    if (!args.eventUid) throw new Error("invalid event for ical");
    return `/api/ical/user/${args.userAccessToken || "public"}/event/${args.eventUid}`;
}

export function GetICalRelativeURIForUserUpcomingEvents(args: { userAccessToken: string | null }) {
    return `/api/ical/user/${args.userAccessToken || "public"}/upcoming`;
}

const ZWikiSlug = z.string().min(1).transform((str) => str.toLowerCase().trim());
const ZWikiName = z.string().min(1);

export interface TGetWikiPageArgs {
    slug: string;
};

export interface TUpdateWikiPageArgs {
    slug: string;
    content: string;
    name: string;
    visiblePermissionId: number | null;
};

export const ZTUpdateWikiPageArgs = z.object({
    slug: ZWikiSlug,
    name: ZWikiName,
    content: z.string(),
    visiblePermissionId: z.number().nullable(),
});



export interface MatchingSlugItem {
    id: number,
    name: string,
    slug: string,
    itemType: "event" | "song" | "user" | "instrument";
};
export const MakeMatchingSlugItem = (value: MatchingSlugItem) => ({ ...value });



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
};

export interface GetGlobalStatsRetPopularSongOccurrance {
    songId: number,
    songName: string,
    eventId: number,
    eventName: string,
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
        description: string;
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
    id: number;
    rowCount: number;
    extraInfo?: unknown; // for things like filtering by date facets, this could specify what kind of facet it is, or additional type-specific info about the facet.

    label: string | null;
    color: string | null;
    iconName: string | null;
    tooltip: string | null;
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
    results: any[];
    facets: SearchResultsFacet[];
    filterQueryResult: CalculateFilterQueryResult;

    // use case: events search results also want to do some extra querying
    // to avoid further query roundtrips. in particular, more info about invited
    // users, user tags, etc, to be returned separate from the main search results array.
    customData: unknown;

    queryMetrics: SearchQueryMetric[];
};

export function MakeEmptySearchResultsRet() {
    return {
        facets: [],
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
    tableID: string;

    pageSize: number;
    page: number;

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
    tableID: ZDBSymbol,

    pageSize: z.number(),
    page: z.number(),

    sort: z.array(ZGetSearchResultsSortModel),

    quickFilter: z.string(),
    discreteCriteria: z.array(ZDiscreteCriterion),
});

export type TupdateEventCustomFieldValue = Prisma.EventCustomFieldValueGetPayload<{}>;

export interface TupdateEventCustomFieldValuesArgs {
    eventId: number;
    values: TupdateEventCustomFieldValue[];
};
