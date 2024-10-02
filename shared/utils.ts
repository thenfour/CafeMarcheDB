import { Ctx } from "@blitzjs/next";
import { randomUUID } from "crypto";
import db from "db"
import { Size } from "src/core/db3/shared/apiTypes";
import { crc32 } from "@foxglove/crc";

export const Date_MIN_VALUE = new Date(-8640000000000000);
export const Date_MAX_VALUE = new Date(8640000000000000);

// allow serializing bigint to json.
// https://github.com/GoogleChromeLabs/jsbi/issues/30
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): number {
    return this.toString();
};

export const gMinImageDimension = 10;

let gUniqueNegativeID = -1;

export function getUniqueNegativeID() {
    return gUniqueNegativeID--;
}



export function concatenateUrlParts(...parts: string[]): string {
    return parts
        .map(part => part.trim())  // Trim whitespace from each part
        .filter(part => part !== '')  // Remove empty parts to avoid extra slashes
        .map(part => part.replace(/^\/+|\/+$/g, ''))  // Remove leading and trailing slashes
        .join('/');  // Join parts with a single slash
}


// CHANGES /////////////////////////////////////////////////////////////////////////////////////////////////////////
export enum ChangeAction {
    insert = "insert",
    update = "update",
    delete = "delete",
}

export interface ChangeContext {
    operationId: string, // when null, will be auto-populated
    changedAt: Date,// when null, will be auto-populated
    contextDescription: string,
};

export const CreateChangeContext = (contextDescription: string): ChangeContext => {
    return {
        operationId: randomUUID(),
        changedAt: new Date(),
        contextDescription,
    };
};

export type RegisterChangeOptions = {
    dontCalculateChanges?: boolean;
};

export type RegisterChangeArgs = {
    action: ChangeAction, // database operation
    changeContext: ChangeContext,
    table: string,
    pkid: number,
    oldValues?: any,
    newValues?: any,
    ctx: Ctx,
    options?: RegisterChangeOptions,
}

export type CalculateChangesResult = {
    hasChanges: boolean;
    oldValues: any,
    newValues: any,
};

export const createEmptyCalculateChangesResult = (): CalculateChangesResult => ({
    oldValues: {},
    newValues: {},
    hasChanges: false,
});

// return an obj of fields which exist in both inputs, and are different.
export function CalculateChanges(oldObj: any, newObj: any): CalculateChangesResult {
    const result: CalculateChangesResult = {
        oldValues: {},
        newValues: {},
        hasChanges: false,
    };

    for (const prop in oldObj) {
        if (oldObj.hasOwnProperty(prop) && newObj.hasOwnProperty(prop)) {
            if (oldObj[prop] !== newObj[prop]) {
                result.oldValues[prop] = oldObj[prop];
                result.newValues[prop] = newObj[prop];
                result.hasChanges = true;
            }
        }
    }

    return result;
}

export async function RegisterChange(args: RegisterChangeArgs) {
    let oldValues: any = null;
    let newValues: any = null;

    if (CoalesceBool(args.options?.dontCalculateChanges, false)) {
        // used by custom change objects like song lists
        oldValues = args.oldValues || {};
        newValues = args.newValues || {};
    } else {
        switch (args.action) {
            case ChangeAction.insert:
                newValues = args.newValues;
                break;
            case ChangeAction.delete:
                oldValues = args.oldValues;
                break;
            case ChangeAction.update:
                const changes = CalculateChanges(args.oldValues, args.newValues);
                if (Object.keys(changes.oldValues).length < 1) {
                    // you didn't change anything.
                    return;
                }
                oldValues = changes.oldValues;
                newValues = changes.newValues;
                break;
            default:
                throw new Error(`unknown change action ${args?.action || "<null>"}`);
        }
    }

    try {

        await db.change.create({
            data: {
                operationId: args.changeContext.operationId,
                sessionHandle: args.ctx?.session?.$handle || null,
                changedAt: args.changeContext.changedAt,
                context: args.changeContext.contextDescription,
                table: args.table,
                recordId: args.pkid,
                action: args.action,
                userId: args.ctx?.session?.userId || null,
                oldValues: JSON.stringify(oldValues),
                newValues: JSON.stringify(newValues),
            }

        });

    } catch (e) {
        debugger;
        throw e;
    }

}

// SETTINGS /////////////////////////////////////////////////////////////////////////////////////////////////////////
// for use on the server only.
// if you need to get / set settings on client, useQuery is required.

export enum Setting {
    // event dialog text
    EditEventDialogDescription = "EditEventDialogDescription",
    NewEventSegmentDialogTitle = "NewEventSegmentDialogTitle",
    EditEventSegmentDialogTitle = "EditEventSegmentDialogTitle",
    NewEventSegmentDialogDescription = "NewEventSegmentDialogDescription",
    EditEventSegmentDialogDescription = "EditEventSegmentDialogDescription",
    NewEventDialogDescription = "NewEventDialogDescription",
    EditSongDialogDescription = "EditSongDialogDescription",
    IconEditCellDialogDescription = "IconEditCellDialogDescription",
    VisibilityControlSelectDialogDescription = "VisibilityControlSelectDialogDescription",
    EventInviteUsersDialogDescriptionMarkdown = "EventInviteUsersDialogDescriptionMarkdown",
    EventAttendanceEditDialog_TitleMarkdown = "EventAttendanceEditDialog_TitleMarkdown",
    EventAttendanceEditDialog_DescriptionMarkdown = "EventAttendanceEditDialog_DescriptionMarkdown",
    EditEventSongListDialogDescription = "EditEventSongListDialogDescription",
    EditEventSongListDialogTitle = "EditEventSongListDialogTitle",
    EventAttendanceCommentDialog_TitleMarkdown = "EventAttendanceCommentDialog_TitleMarkdown",
    EventAttendanceCommentDialog_DescriptionMarkdown = "EventAttendanceCommentDialog_DescriptionMarkdown",

    // mostly pages or sections of pages...
    HomeDescription = "HomeDescription",
    event_description_mockup_markdown = "event_description_mockup_markdown",
    EditEventAttendancesPage_markdown = "EditEventAttendancesPage_markdown",
    editEvents_markdown = "editEvents_markdown",
    EditEventSegmentsPage_markdown = "EditEventSegmentsPage_markdown",
    EventSegmentUserResponsePage_markdown = "EventSegmentUserResponsePage_markdown",
    EditEventSongListsPage_markdown = "EditEventSongListsPage_markdown",
    EditEventSongListSongsPage_markdown = "EditEventSongListSongsPage_markdown",
    EditEventStatusesPage_markdown = "EditEventStatusesPage_markdown",
    EditEventTagsPage_markdown = "EditEventTagsPage_markdown",
    EditEventTypesPage_markdown = "EditEventTypesPage_markdown",
    EventUserResponsePage_markdown = "EventUserResponsePage_markdown",
    EditFilesPage_markdown = "EditFilesPage_markdown",
    EditFileTagsPage_markdown = "EditFileTagsPage_markdown",
    EditFrontpageGalleryItemsPage_markdown = "EditFrontpageGalleryItemsPage_markdown",
    EditSongCreditsPage_markdown = "EditSongCreditsPage_markdown",
    editSongCreditTypes_markdown = "editSongCreditTypes_markdown",
    editSongs_markdown = "editSongs_markdown",
    editSongTags_markdown = "editSongTags_markdown",
    EditUserTagsPage_markdown = "EditUserTagsPage_markdown",
    events_markdown = "events_markdown",
    frontpage_gallery_markdown = "frontpage_gallery_markdown",
    info_text = "info_text",
    InstrumentFunctionalGroupList_markdown = "InstrumentFunctionalGroupList_markdown",
    instrumentList_markdown = "instrumentList_markdown",
    instrumentTagList_markdown = "instrumentTagList_markdown",
    profile_markdown = "profile_markdown",
    rolePermissionsMatrixPage_markdown = "rolePermissionsMatrixPage_markdown",
    RolesAdminPage_markdown = "RolesAdminPage_markdown",
    settings_markdown = "settings_markdown",
    songs_markdown = "songs_markdown",
    AdminLogsPage_markdown = "AdminLogsPage_markdown",
    UserInstrumentsPage_markdown = "UserInstrumentsPage_markdown",
    EventSongListTabDescription = "EventSongListTabDescription",
    EventAttendanceDetailMarkdown = "EventAttendanceDetailMarkdown",
    EventCompletenessTabMarkdown = "EventCompletenessTabMarkdown",
    FrontpageAgendaPage_markdown = "FrontpageAgendaPage_markdown",
    BackstageFrontpageMarkdown = "BackstageFrontpageMarkdown",
    BackstageFrontpageHeaderMarkdown = "BackstageFrontpageHeaderMarkdown",
    DashboardStats_SongsMarkdown = "DashboardStats_SongsMarkdown",
    DashboardStats_EventsMarkdown = "DashboardStats_EventsMarkdown",
    CustomLinksPageMarkdown = "CustomLinksPageMarkdown",
    MenuLinksPageMarkdown = "MenuLinksPageMarkdown",
    GlobalWikiPage_Markdown = "GlobalWikiPage_Markdown",
    SongHistoryTabDescription = "SongHistoryTabDescription",
    StatsPage_markdown = "StatsPage_markdown",
    Workflow_SelectAssigneesDialogDescription = "Workflow_SelectAssigneesDialogDescription",
    EditEventCustomFieldsPage_markdown = "EditEventCustomFieldsPage_markdown",
    EventEditCustomFieldValuesDialog_TitleMarkdown = "EventEditCustomFieldValuesDialog_TitleMarkdown",
    EventEditCustomFieldValuesDialog_DescriptionMarkdown = "EventEditCustomFieldValuesDialog_DescriptionMarkdown",

    // not markdown....

    // on the backstage home dashboard, which events to display
    BackstageFrontpageEventMaxAgeDays = "BackstageFrontpageEventMaxAgeDays",

    // on the backstage home dashboard, a song is considered "current" if it's at MOST this long since playing it.
    BackstageFrontpageCurrentSongMaxAgeDays = "BackstageFrontpageCurrentSongMaxAgeDays",

    textPalette = "textPalette",
    //EnableOldPublicHomepageBackstageLink = "EnableOldPublicHomepageBackstageLink",
    //EnableNewPublicHomepageBackstageLink = "EnableNewPublicHomepageBackstageLink",

    // for markdown editor drop images
    maxImageDimension = "maxImageDimension",
};

export type SettingKey = keyof typeof Setting;

export interface SetSettingArgs {
    ctx: Ctx,
    setting: Setting | string,
    value?: any,
};

export async function SetSetting(args: SetSettingArgs) {
    const settingName = args.setting as string;
    if (args.value === null || args.value === undefined) {
        const existing = await db.setting.findFirst({ where: { name: settingName, } });
        if (!existing) return;

        await db.setting.deleteMany({ where: { name: settingName, } });

        await RegisterChange({
            action: ChangeAction.delete,
            ctx: args.ctx,
            changeContext: CreateChangeContext("SetSetting"),
            table: "setting",
            pkid: existing.id,
            oldValues: existing,
        });

        return;
    }

    const obj = await db.setting.create({
        data: {
            name: settingName,
            value: JSON.stringify(args.value),
        }
    });

    await RegisterChange({
        action: ChangeAction.delete,
        ctx: args.ctx,
        changeContext: CreateChangeContext("SetSetting"),
        table: "setting",
        pkid: obj.id,
        newValues: obj,
    });
}

export const CoerceToNumberOr = <Tfallback,>(value, fallbackValue: Tfallback): number | Tfallback => {
    if (value === null) return fallbackValue;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        if (value.trim() === "") {
            return fallbackValue;
        }
        const asNumber = parseFloat(value);
        if (!isNaN(asNumber)) {
            return asNumber;
        }
        return fallbackValue;
    }
    return value;
};



// for use in Zod schemas like
// export const InstrumentTagSortOrderSchema = z.preprocess(utils.CoerceToNumberOrNull, z.number().refine(utils.ValidateInt));
export const CoerceToNumberOrNull = (value): number | null => {
    return CoerceToNumberOr(value, null);
};
export const CoerceToNumber = (value): number => {
    return CoerceToNumberOr(value, 0);
};

export const CoerceToString = (value: any): string => {
    return `${value}`;
};

export const CoerceToBoolean = (value: any, defaultVal: boolean): boolean => {
    if (value == null) return defaultVal;
    return !!value;
};

export const CoerceToNullableBoolean = (value: any, defaultVal: boolean | null): boolean | null => {
    if (value == null) return defaultVal;
    return !!value;
};

export const ValidateNullableInt = (arg) => {
    return arg === null || Number.isInteger(arg);
};

// only works for true integers, not strings.
// ValidateInt("1") = false
export const ValidateInt = (arg) => {
    return Number.isInteger(arg);
};


// see:
// const ImageFileFormatOptions = {
//     "png": {},
// ...
// } as const;
// validateStringOption(input, ImageFileFormatOptions)
export function validateStringOption<ToptionsObj extends Record<string, any>>(input: string, validOptions: ToptionsObj): keyof ToptionsObj {
    if (!(typeof validOptions).includes(input)) {
        throw new Error(`Invalid input: ${input}`);
    }
    return input;
}




// permissively converts a string or number to integer.
export const parseIntOrNull = (s): (number | null) => {
    if (typeof s === 'number') return s;
    const i = parseInt(s, 10);
    return isNaN(i) ? null : i;
}

export const CoerceNullableNumberToNullableString = (inp: number | null): string | null => {
    if (inp === null) return null;
    return `${inp}`;
};


// permissively converts a string or number to integer.
export const parseFloatOrNull = (s): (number | null) => {
    if (typeof s === 'number') return s;
    const i = parseFloat(s);
    return isNaN(i) ? null : i;
}


// returns whether the string is completely integral.
// parseInt("1etcetc") returns 1. we don't want that here.
// use case: deciding whether a string is a row ID or a string.
export const IsEntirelyIntegral = (arg: string) => {
    // https://stackoverflow.com/questions/1779013/check-if-string-contains-only-digits
    // apparently this is also the most performant
    return /^\d+$/.test(arg);
};

export const IsNullOrWhitespace = (s) => {
    if (s == null) return true;
    if (typeof (s) !== 'string') return false;
    return (s.trim() === "");
};

// utility type to allow strict selection of the keys of a const object
export type KeysOf<T extends Record<string, unknown>> = keyof T;


// utility type
// to make all fields nullable
export type Nullable<T> = { [K in keyof T]: T[K] | null };

// https://stackoverflow.com/questions/58278652/generic-enum-type-guard
// export const isSomeEnum = <T>(e: T) => (token: any): token is T[keyof T] =>
//     Object.values(e).includes(token as T[keyof T]);

export const HasFlag = <T extends number,>(myvar: T, flag: T): boolean => {
    return (myvar & flag) === flag;
}

export function lerp(a, b, t) {
    if (Math.abs(b - a) < 0.0001) return a;
    return a + t * (b - a);
}

let gSequenceId = 0;
export const getNextSequenceId = () => {
    return gSequenceId++;
}

export const clamp01 = (x) => {
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
}

export const Clamp = (x, low, hi) => {
    if (x < low) return low;
    if (x > hi) return hi;
    return x;
}

// this should be synchronized with export const gIconMap.
export const gIconOptions = {
    AccountTree: "AccountTree",
    Add: "Add",
    AddCircleOutline: "AddCircleOutline",
    Alarm: "Alarm",
    AttachFile: "AttachFile",
    AutoAwesome: "AutoAwesome",
    CalendarMonth: "CalendarMonth",
    Campaign: "Campaign",
    Cancel: "Cancel",
    Celebration: "Celebration",
    CheckCircleOutline: "CheckCircleOutline",
    Close: "Close",
    Comment: "Comment",
    ContentCopy: "ContentCopy",
    ContentCut: "ContentCut",
    ContentPaste: "ContentPaste",
    Delete: "Delete",
    Done: "Done",
    Edit: "Edit",
    EditNote: "EditNote",
    Error: "Error",
    ErrorOutline: "ErrorOutline",
    Favorite: "Favorite",
    GraphicEq: "GraphicEq",
    Group: "Group",
    Groups: "Groups",
    // do not use drag handle; users will never need it. use "☰" instead.
    HighlightOff: "HighlightOff",
    Help: "Help",
    Home: "Home",
    HourglassBottom: "HourglassBottom",
    Image: "Image",
    Info: "Info",
    Launch: "Launch",
    LibraryMusic: "LibraryMusic",
    Link: "Link",
    Lock: "Lock",
    Mic: "Mic",
    More: "More",
    MusicNote: "MusicNote",
    Nightlife: "Nightlife",
    Notifications: "Notifications",
    PauseCircleOutline: "PauseCircleOutline",
    Person: "Person",
    PersonSearch: "PersonSearch",
    Place: "Place",
    PlayCircleOutline: "PlayCircleOutline",
    Public: "Public",
    QuestionMark: "QuestionMark",
    RemoveCircleOutline: "RemoveCircleOutline",
    Save: "Save",
    Schedule: "Schedule",
    Search: "Search",
    Security: "Security",
    Settings: "Settings",
    Share: "Share",
    Stars: "Stars",
    Tag: "Tag",
    ThumbDown: "ThumbDown",
    ThumbUp: "ThumbUp",
    Tune: "Tune",
    Visibility: "Visibility",
    VisibilityOff: "VisibilityOff",
    VolumeDown: "VolumeDown",
    VolumeUp: "VolumeUp",
    VolumeOff: "VolumeOff",
} as const;

export type TIconOptions = keyof typeof gIconOptions;

// https://stackoverflow.com/a/51399781/402169
export type ArrayElement<ArrayType extends readonly unknown[]> =
    ArrayType extends readonly (infer ElementType)[] ? ElementType : never;


export const gQueryOptions = {
    // default will go stale periodically
    default: {
        staleTime: Infinity,
        cacheTime: Infinity,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
    },
    static: {
        staleTime: Infinity,
        cacheTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: true,
    },
    liveData: {
        staleTime: 0,
        cacheTime: 0,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
    }
};


export function assertIsNumberArray(value: any): asserts value is number[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'number')) {
        console.log(`{ the following value is not a number array`);
        console.log(value);
        console.log(`}`);
        throw new Error('Value is not a number array; see console');
    }
}

export function assertIsStringArray(value: any): asserts value is string[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
        console.log(`{ the following value is not a string array`);
        console.log(value);
        console.log(`}`);
        throw new Error('Value is not a string array');
    }
}

export function isEmptyArray(obj: any) {
    if (!Array.isArray(obj)) return false;
    return 0 === ((obj as any[]).length);
}

export function moveItemInArray<T>(array: T[], oldIndex: number, newIndex: number): T[] {
    if (oldIndex === newIndex) {
        return array; // No need to move if oldIndex and newIndex are the same
    }

    if (oldIndex < 0 || oldIndex >= array.length || newIndex < 0 || newIndex >= array.length) {
        throw new Error("Invalid oldIndex or newIndex");
    }

    const itemToMove = array[oldIndex]!;
    const newArray = [...array]; // Create a copy of the original array

    // Remove the item from the old position
    newArray.splice(oldIndex, 1);

    // Insert the item at the new position
    newArray.splice(newIndex, 0, itemToMove);

    return newArray;
}

export function existsInArray<T>(
    array: T[],
    id: T,
    compareFn: (a: T, b: T) => boolean = (a, b) => a === b
): boolean {
    const index = array.findIndex(item => compareFn(item, id));
    return (index !== -1);
}

// adds or removes a value in an array. ordering is assumed to not matter.
// returns a new array with the change made.
export function toggleValueInArray<T>(
    array: T[],
    id: T,
    compareFn: (a: T, b: T) => boolean = (a, b) => a === b
): T[] {
    const index = array.findIndex(item => compareFn(item, id));
    const newArray = [...array];  // Create a copy of the array to avoid mutating the original array

    if (index === -1) {
        newArray.push(id);
    } else {
        newArray.splice(index, 1);
    }

    return newArray;
};


export function distinctValuesOfArray<T>(items: T[], areEqual: (a: T, b: T) => boolean): T[] {
    return items.reduce<T[]>((acc, current) => {
        if (!acc.some(item => areEqual(item, current))) {
            acc.push(current);
        }
        return acc;
    }, []);
};


export function arraysContainSameValues<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    const sortFunc = (a: T, b: T) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    };

    const sortedArr1 = [...arr1].sort(sortFunc);
    const sortedArr2 = [...arr2].sort(sortFunc);

    for (let i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] !== sortedArr2[i]) {
            return false;
        }
    }

    return true;
}



export const sleep = (ms: number, seed?: any) => new Promise((resolve) => setTimeout(() => {
    resolve(`you slept for ${ms} millis with seed ${seed}`);
}, ms));




export function pickFromObject<T extends object, K extends keyof T>(obj: T, keys: K[]): T[K][] {
    return keys.map(key => obj[key]);
}



// thanks chatgpt
export interface ParsedMimeType {
    type: string | null;
    subtype: string | null;
    parameters: Record<string, string>;
    forDisplay: string; // custom filtering for chip display, grouping, etc.
}

// common values to consider:
// *     = (null)
// .gform = (null)

// .gdoc = application/vnd.google-apps.document
// .gsheet = application/vnd.google-apps.spreadsheet
// .pages = application/vnd.apple.pages
// .xls  = application/vnd.ms-excel
// .xlsx = application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
// .docx = application/vnd.openxmlformats-officedocument.wordprocessingml.document
// .pdf  = application/pdf
// .doc  = application/msword
// .json = application/json
// .xml  = application/xml

// .txt  = text/plain
// .html = text/html
// .wav  = audio/wav
// .mp3  = audio/mpeg
// .ogg  = audio/ogg
// .png  = image/png
// .svg  = image/svg+xml
// .m4v  = video/x-m4v
// .avi  = video/x-msvideo
export function parseMimeType(mimeTypeStringOrNullish: string | null | undefined): ParsedMimeType | null {
    if (!mimeTypeStringOrNullish) return null;
    const mimeTypeString = mimeTypeStringOrNullish as string;
    const regex = /^([^/]+)\/([^;\s]+)(?:\s*;\s*(.*))?$/;
    const matches = mimeTypeString.match(regex);

    if (!matches) {
        return null;
    }

    const type = matches[1] || null;
    const subtype = matches[2] || null;
    const parameterString = matches[3] || '';
    const parameters: Record<string, string> = {};

    parameterString.split(';').forEach((param) => {
        const [key, value] = param.split('=').map((s) => s.trim());
        if (key && value) {
            parameters[key] = value;
        }
    });

    let display = type || "--";

    if ((type === "application") && ((subtype || "").length < 10)) {
        // we want some better granularity here.
        display = subtype || type;
    }

    return {
        type,
        subtype,
        parameters,
        forDisplay: display,
    };
}

export const areAllEqual = <T,>(arr: T[]): boolean => arr.every(v => v === arr[0]);


// tests >= start and < end. start and end can be swapped
export const isInRange = (number: number, a: number, b: number): boolean => {
    return number >= Math.min(a, b) && number < Math.max(a, b);
};

// retains repeating pattern into the negative.
export function modulo(x: number, n: number): number {
    return ((x % n) + n) % n;
};

// using x || v with booleans is not going to work. but the intention is good. use this.
export function Coalesce<T>(value: null | undefined | T, defaultValue: T) {
    if (value === null) return defaultValue;
    if (value === undefined) return defaultValue;
    return value;
}

// this just has a better name.
export function CoalesceBool<T>(value: null | undefined | T, defaultValue: T) {
    if (value === null) return defaultValue;
    if (value === undefined) return defaultValue;
    return value;
}
export function valueOr<T, U, V>(
    value: T | undefined | null,
    valueIfUndefined: U,
    valueIfNull: V
): T | U | V {
    if (value === undefined) return valueIfUndefined;
    if (value === null) return valueIfNull;
    return value;
}

////////////////////////////////////////////////////////////////
// const getImageDimensions = (url: string): Promise<Size> => {
//     return new Promise((resolve, reject) => {
//         const img = new Image();
//         img.onload = () => resolve({
//             width: img.width,
//             height: img.height,
//         });
//         img.onerror = (error) => reject(error);
//         img.src = url;
//     });
// };



export const gDefaultImageArea = 1500000; // 1500 x 1000

////////////////////////////////////////////////////////////////
export function calculateNewDimensions(originalDimensions: Size, maxArea: number): Size {
    const originalArea = originalDimensions.width * originalDimensions.height;
    if (originalArea <= maxArea) {
        return { ...originalDimensions };
    }

    // Calculate the scaling factor to maintain the aspect ratio
    const scalingFactor = Math.sqrt(maxArea / originalArea);
    const newWidth = originalDimensions.width * scalingFactor;
    const newHeight = originalDimensions.height * scalingFactor;

    return { width: newWidth, height: newHeight };
}


export function AreAllDefined(items: any[]) {
    return !(items.some(i => i === undefined));
}

export function AreAnyDefined(items: any[]) {
    return (items.some(i => i !== undefined));
}

export function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}


export function smartTruncate(url: string, maxLength: number = 120) {
    if (url.length <= maxLength) return url;

    const start = url.slice(0, maxLength / 2);
    const end = url.slice(-maxLength / 2);
    return `${start}...${end}`;
}

export function getExcelColumnName(index: number): string {
    let columnName = '';
    while (index > 0) {
        const remainder = (index - 1) % 26;
        columnName = String.fromCharCode(65 + remainder) + columnName;
        index = Math.floor((index - 1) / 26);
    }
    return columnName;
}

// https://stackoverflow.com/questions/7744912/making-a-javascript-string-sql-friendly
export function MysqlEscape(str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\" + char; // prepends a backslash to backslash, percent,
            // and double/single quotes
            default:
                return char;
        }
    });
}

export function SplitQuickFilter(quickFilter: string): string[] {
    return quickFilter.toLowerCase().split(/\s+/).filter(token => !IsNullOrWhitespace(token));
}



export function arrayToTSV(data: Record<string, string>[]): string {
    if (data.length === 0) {
        return "";
    }

    // Extract headers
    const headers = Object.keys(data[0]!);

    // Map each object to a CSV string
    const rows = data.map(obj => {
        return headers.map(fieldName => {
            // Handle potential commas in data
            let field = obj[fieldName] || ""; // default to empty string if undefined
            if (field.includes('\t') || field.includes('"')) {
                // Escape double quotes and wrap field in double quotes
                field = `"${field.replace(/"/g, '""')}"`;
            }
            return field;
        }).join('\t');
    });

    // Combine headers and rows
    return [headers.join('\t'), ...rows].join('\n');
}



// Function to get unique enum values
export function getEnumValues<E extends { [key: string]: any }>(enumObject: E): string[] {
    return Object.values(enumObject).filter(value => typeof value === 'string') as string[];
}

export function SqlCombineAndExpression(expressions: string[]): string {
    if (expressions.length === 0) return "(true)";
    if (expressions.length === 1) return expressions[0]!;
    return `(${expressions.join(`\n    AND `)})`;
};

export function SqlCombineOrExpression(expressions: string[]): string {
    if (expressions.length === 0) return "(true)";
    if (expressions.length === 1) return expressions[0]!;
    return `(${expressions.join(`\n    OR `)})`;
};


// Returns a partial extract of oldValues, where the fields appear in newObject
export function getIntersectingFields(newValues: { [key: string]: any }, oldValues: { [key: string]: any }) {
    return Object.keys(newValues).reduce((acc, key) => {
        if (key in oldValues) {
            acc[key] = oldValues[key];
        }
        return acc;
    }, {} as { [key: string]: any });
}


const str2ab = function (str: string): ArrayBufferView {
    const array = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
        array[i] = str.charCodeAt(i)
    }
    return array
}

export function hashString(inp: string) {
    return crc32(str2ab(inp));
}

export const getHashedColor = (text: string, options?: { saturation?: string, luminosity?: string, alpha?: string }): string => {
    let hash = hashString(text);
    const color = `hsla(${hash % 360}, ${options?.saturation || '100%'}, ${options?.luminosity || "35%"}, ${options?.alpha || "100%"})`;
    //console.log(color);
    return color;
};


// array sort by selector
export function sortBy<T, U>(array: T[], selector: (item: T) => U): T[] {
    return array.slice().sort((a, b) => {
        const aValue = selector(a);
        const bValue = selector(b);

        if (aValue < bValue) {
            return -1;
        }
        if (aValue > bValue) {
            return 1;
        }
        return 0;
    });
}

// https://stackoverflow.com/questions/39419170/how-do-i-check-that-a-switch-block-is-exhaustive-in-typescript
export function assertUnreachable(x: never, msg?: string | undefined): never {
    throw new Error(msg || "Didn't expect to get here");
}