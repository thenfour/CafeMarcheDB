import { crc32 } from "@foxglove/crc";
import db from "db";
import { Size } from "src/core/db3/shared/apiTypes";
import z from "zod";

export const Date_MIN_VALUE = new Date(-8640000000000000);
export const Date_MAX_VALUE = new Date(8640000000000000);



// Function that takes a JSON string, parses it, and validates it with Zod
export function ZodJsonParseAndValidate<T>(jsonString: string, schema: z.ZodSchema<T>): T {
    let parsedData;
    try {
        parsedData = JSON.parse(jsonString);
    } catch (error) {
        throw new Error(`Invalid JSON format: ${error}`);
    }

    const validation = schema.safeParse(parsedData);
    if (!validation.success) {
        // Log or handle the error as necessary
        console.error(validation.error.format());
        throw new Error('Schema validation failed.');
    }
    return validation.data;
}




// Pre-generate Fibonacci numbers up to a certain max (adjust as needed)
export const generateFibonacci = (max: number): number[] => {
    const fibs = [1, 2];
    while (true) {
        const next = fibs[fibs.length - 2]! + fibs[fibs.length - 1]!;
        if (next > max) break;
        fibs.push(next);
    }
    return fibs;
};


// allow serializing bigint to json.
// https://github.com/GoogleChromeLabs/jsbi/issues/30
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): number {
    return this.toString();
};
export function BigintToNumber(x: BigInt): number {
    return new Number(x).valueOf();
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

// maps x from range [a,b] to range [c,d]
export function mapRange(x: number, a: number, b: number, c: number, d: number): number {
    const t = (x - a) / (b - a);
    return lerp(c, d, t);
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
    Article: "Article",
    AttachFile: "AttachFile",
    AutoAwesome: "AutoAwesome",
    Blank: "Blank",
    CalendarMonth: "CalendarMonth",
    Campaign: "Campaign",
    Cancel: "Cancel",
    Celebration: "Celebration",
    Check: "Check",
    CheckCircleOutline: "CheckCircleOutline",
    Close: "Close",
    Comment: "Comment",
    ContentCopy: "ContentCopy",
    ContentCut: "ContentCut",
    ContentPaste: "ContentPaste",
    Delete: "Delete",
    DirectionsCar: "DirectionsCar",
    Done: "Done",
    Edit: "Edit",
    EditNote: "EditNote",
    Error: "Error",
    ErrorOutline: "ErrorOutline",
    ExpandMore: "ExpandMore",
    Equalizer: "Equalizer",
    Favorite: "Favorite",
    GraphicEq: "GraphicEq",
    Group: "Group",
    Groups: "Groups",
    // do not use drag handle; users will never need it. use "☰" instead (in gChars)
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
    Pause: "Pause",
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
    Terminal: "Terminal",
    ThumbDown: "ThumbDown",
    ThumbUp: "ThumbUp",
    Trumpet: "Trumpet",
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


export const sleep = (ms: number, seed?: any) => new Promise((resolve) => setTimeout(() => {
    resolve(`you slept for ${ms} millis with seed ${seed}`);
}, ms));




// export function pickFromObject<T extends object, K extends keyof T>(obj: T, keys: K[]): T[K][] {
//     return keys.map(key => obj[key]);
// }



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

export function isValidDate(date) {
    return date && Object.prototype.toString.call(date) === "[object Date]" && !isNaN(date);
}


// aka smart shorten
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
    return color;
};



// https://stackoverflow.com/questions/39419170/how-do-i-check-that-a-switch-block-is-exhaustive-in-typescript
export function assertUnreachable(x: never, msg?: string | undefined): never {
    throw new Error(msg || "Didn't expect to get here");
}


export type ObjectDiffResult<T extends Object> = {
    areDifferent: boolean;
    differences: { lhs: Partial<T>, rhs: Partial<T> };
    similarities: Partial<T>;
};

export function ObjectDiff<T extends Object>(
    lhs: T,
    rhs: T,
    options: { ignore?: (keyof T)[]; include?: (keyof T)[] } = {}
): ObjectDiffResult<T> {
    let keys: Array<keyof T>;

    // Determine which keys to compare based on options
    if (options.include && options.include.length > 0) {
        // If 'include' is specified, only compare those keys
        keys = options.include;
    } else {
        // Otherwise, get all keys from the 'lhs' object
        keys = Object.keys(lhs) as Array<keyof T>;

        // If 'ignore' is specified, exclude those keys from comparison
        if (options.ignore && options.ignore.length > 0) {
            keys = keys.filter((key) => !options.ignore!.includes(key));
        }
    }

    const differences: { lhs: Partial<T>, rhs: Partial<T> } = { lhs: {}, rhs: {} };
    const similarities: Partial<T> = {};

    // Compare properties between 'lhs' and 'rhs'
    for (const key of keys) {
        if (lhs[key] !== rhs[key]) {
            differences.lhs[key] = lhs[key]; // Store the differing value from 'lhs'
            differences.rhs[key] = rhs[key]; // Store the differing value from 'rhs'
        } else {
            similarities[key] = lhs[key]; // Store the matching value from 'lhs'
        }
    }

    const areDifferent = (Object.keys(differences.lhs).length > 0) || (Object.keys(differences.rhs).length > 0);

    return {
        areDifferent,
        differences,
        similarities,
    };
}

export function StringToEnumValue<T extends { [key: string]: string }>(enumObj: T, value: string): T[keyof T] | undefined {
    return (Object.values(enumObj) as string[]).includes(value) ? (value as T[keyof T]) : undefined;
}

// returns an object which has stripped all keys except for those specified.
// because (keyof T) is not possible at runtime, caller needs to pass it in.
export function sanitize<T>(inp: any, keys: (keyof T)[]): T {
    const result = {} as T;
    for (const key of keys) {
        if (key in inp) {
            result[key] = inp[key];
        }
    }
    return result;
}
// export function sanitize<T extends Object, K extends readonly (keyof T)[]>(
//     input: T,
//     keys: K
// ): Pick<T, K[number]> {
//     const result = {} as Pick<T, K[number]>;
//     for (const key of keys) {
//         if (key in input) {
//             result[key] = input[key];
//         }
//     }
//     return result;
// }

// allows calling an async function from a non-async function.
// like
// function NonAsyncFunction() {
//   callAsync(async () => {
//      await someOtherTask();
//   });
// }
export function callAsync<T>(asyncFunction: () => Promise<T>): T | undefined {
    let result: T | undefined;
    let error: any;

    asyncFunction()
        .then((res) => (result = res))
        .catch((err) => (error = err));

    if (error) throw error;

    return result;
}

export async function passthroughWithoutTransaction<T>(fn: (transactionalDb: typeof db) => Promise<T>): Promise<T> {
    return fn(db);
}


export function groupBy<T, K extends string | number>(
    array: T[],
    getKey: (item: T) => K
): Record<K, T[]> {
    return array.reduce((result, item) => {
        const key = getKey(item);
        if (!result[key]) {
            result[key] = [];
        }
        result[key].push(item);
        return result;
    }, {} as Record<K, T[]>);
}


/**
 * isInternalUrl
 * -------------
 * Returns true when `href` resolves to the same origin as the current page,
 * or when it is a purely relative/anchor/mail link that should be handled
 * inside the app.  Otherwise it is considered external.
 */
export function isInternalUrl(href: string): boolean {
    // “mailto:”, “tel:”, “javascript:”, etc. are always external to routing
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('http')) {
        return false;
    }

    try {
        // The WHATWG URL constructor resolves relative URLs when given a base.
        // We use window.location.origin so query/fragment-only links work.
        const resolved = new URL(href, window.location.origin);

        // Same-origin ⇒ internal.
        if (resolved.origin === window.location.origin) return true;

        // Different origin ⇒ external.
        return false;
    } catch {
        // “href” was something like “/path” or “#hash” (invalid in URL ctor)
        // — treat that as an internal route.
        return true;
    }
}

