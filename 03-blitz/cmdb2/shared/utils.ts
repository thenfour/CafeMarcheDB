import { Ctx } from "@blitzjs/next";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { randomUUID } from "crypto";
import db from "db"
import { Size } from "src/core/db3/shared/apiTypes";

export const Date_MIN_VALUE = new Date(-8640000000000000);
export const Date_MAX_VALUE = new Date(8640000000000000);


export const gMinImageDimension = 10;

let gUniqueNegativeID = -1;

export function getUniqueNegativeID() {
    return gUniqueNegativeID--;
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

export type RegisterChangeArgs = {
    action: ChangeAction, // database operation
    changeContext: ChangeContext,
    table: string,
    pkid: number,
    oldValues?: any,
    newValues?: any,
    ctx: Ctx,
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
    HomeDescription = "HomeDescription",
};

export interface SetSettingArgs {
    ctx: Ctx,
    setting: Setting | string,
    value?: any,
};

export async function SetSetting(args: SetSettingArgs) {
    if (args.value === null || args.value === undefined) {
        const existing = await db.setting.findFirst({ where: { name: args.setting, } });
        if (!existing) return;

        await db.setting.deleteMany({ where: { name: args.setting, } });

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
            name: args.setting,
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

// export async function GetSetting(setting: Setting) {
//     const existing = await db.setting.findFirst({ where: { name: setting, } });
//     if (!existing) return null;
//     return JSON.parse(existing!.value);
// }


// ACTIONS /////////////////////////////////////////////////////////////////////////////////////////////////////////

export enum Action {
    SignIn = "SignIn",
    SignOut = "SignOut",
    VisitRoute = "VisitRoute",
}

export type RegisterActionArgs = {
    action: Action, // user operation
    data?: any, // additional data depending on action. will be serialized as JSON.
    ctx: Ctx,
}

export async function RegisterActivity(args: RegisterActionArgs) {
    return await db.activity.create({
        data: {
            userId: args.ctx?.session?.userId || null,
            sessionHandle: args.ctx?.session?.$handle || null,
            happenedAt: new Date(),
            action: args.action,
            data: JSON.stringify(args.data),
        }
    });
}


export const CoerceToNumberOr = <Tfallback,>(value, fallbackValue: Tfallback): number | Tfallback => {
    if (typeof value === "string") {
        if (value.trim() === "") {
            return fallbackValue;
        }
        const asNumber = parseFloat(value);
        if (!isNaN(asNumber)) {
            return asNumber;
        }
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

export type TAnyModel = { [key: string]: any };

// https://stackoverflow.com/questions/58278652/generic-enum-type-guard
// export const isSomeEnum = <T>(e: T) => (token: any): token is T[keyof T] =>
//     Object.values(e).includes(token as T[keyof T]);

export const HasFlag = <T extends number,>(myvar: T, flag: T): boolean => {
    return (myvar & flag) === flag;
}


export const gNullValue = "__null__498b0049-f883-4c77-9613-c8712e49e183";
export const gIDValue = "__id__498b0049-f883-4c77-9613-c8712e49e183";
export const gNameValue = "__name__498b0049-f883-4c77-9613-c8712e49e183";


export function lerp(a, b, alpha) {
    if (Math.abs(b - a) < 0.0001) return a;
    return a + alpha * (b - a);
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
    Add: "Add",
    AddCircleOutline: "AddCircleOutline",
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
    Stars: "Stars",
    Tag: "Tag",
    ThumbDown: "ThumbDown",
    ThumbUp: "ThumbUp",
    Tune: "Tune",
    Visibility: "Visibility",
    VisibilityOff: "VisibilityOff",
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
        throw new Error('Value is not a number array');
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



export const sleep = (ms: number, seed?: any) => new Promise((resolve) => setTimeout(() => {
    resolve(`you slept for ${ms} millis with seed ${seed}`);
}, ms));



// thanks chatgpt
export interface ParsedMimeType {
    type: string | null;
    subtype: string | null;
    parameters: Record<string, string>;
}

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

    return {
        type,
        subtype,
        parameters,
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

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return bytes + ' Bytes';
    }
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + ' KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
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
