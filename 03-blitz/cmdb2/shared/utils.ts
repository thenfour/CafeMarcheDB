import { Ctx } from "@blitzjs/next";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { randomUUID } from "crypto";
import db from "db"

export const Date_MIN_VALUE = new Date(-8640000000000000);
export const Date_MAX_VALUE = new Date(8640000000000000);

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
    oldValues: any,
    newValues: any,
};

// return an obj of fields which exist in both inputs, and are different.
export function CalculateChanges(oldObj: any, newObj: any): CalculateChangesResult {
    const result: CalculateChangesResult = { oldValues: {}, newValues: {} };

    for (const prop in oldObj) {
        if (oldObj.hasOwnProperty(prop) && newObj.hasOwnProperty(prop)) {
            if (oldObj[prop] !== newObj[prop]) {
                result.oldValues[prop] = oldObj[prop];
                result.newValues[prop] = newObj[prop];
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

export async function GetSetting(setting: Setting) {
    const existing = await db.setting.findFirst({ where: { name: setting, } });
    if (!existing) return null;
    return JSON.parse(existing!.value);
}


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


// for use in Zod schemas like
// export const InstrumentTagSortOrderSchema = z.preprocess(utils.CoerceToNumberOrNull, z.number().refine(utils.ValidateInt));
export const CoerceToNumberOrNull = (value): number | null => {
    if (typeof value === "string") {
        if (value.trim() === "") {
            return null;
        }
        const asNumber = parseFloat(value);
        if (!isNaN(asNumber)) {
            return asNumber;
        }
    }
    return value;
};

export const ValidateNullableInt = (arg) => {
    return arg === null || Number.isInteger(arg);
};

// only works for true integers, not strings.
// ValidateInt("1") = false
export const ValidateInt = (arg) => {
    return Number.isInteger(arg);
};

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



// https://github.com/thenfour/digifujam/blob/7dece20f483270650ad995b54d3b8fafaf3009c1/source/DFcommon/dfutil.js#L20C1-L67C1
// another way of getting time duration info
export class TimeSpan {
    __totalMilliseconds: number;
    __totalSeconds: number;
    __totalMinutes: number;
    __totalHours: number;
    __totalDays: number;
    __secondsPart: number;
    __minutesPart: number;
    __hoursPart: number;

    __shortString: string;
    __longString: string;

    constructor(ms) {
        //const Sign = Math.sign(ms);
        //ms = Math.abs(ms);
        // if (ms < 0) // why? negative timespans are just fine.
        //   ms = 0;
        this.__totalMilliseconds = ms;
        this.__totalSeconds = Math.floor(ms / 1000);
        this.__totalMinutes = Math.floor(ms / 60000);
        this.__totalHours = Math.floor(ms / (60000 * 60));
        this.__totalDays = Math.floor(ms / (60000 * 60 * 24));
        this.__secondsPart = this.__totalSeconds % 60;
        this.__minutesPart = this.__totalMinutes % 60;
        this.__hoursPart = this.__totalHours % 24;
        this.__shortString = `${this.__totalHours}h ${this.__minutesPart}m ${this.__secondsPart}s`;
        if (!this.__totalHours && !!this.__minutesPart) {
            this.__shortString = `${this.__minutesPart}m ${this.__secondsPart}s`;
        } else if (!this.__totalHours && !this.__minutesPart) {
            this.__shortString = `${this.__secondsPart}s`;
        }

        this.__longString = `${this.__totalDays} days ${this.__hoursPart} hours ${this.__minutesPart} min ${this.__secondsPart} sec`;
        if (!this.__totalDays) {
            this.__longString = `${this.__hoursPart} hours ${this.__minutesPart} min ${this.__secondsPart} sec`;
            if (!this.__hoursPart) {
                this.__longString = `${this.__minutesPart} min ${this.__secondsPart} sec`;
                if (!this.__minutesPart) {
                    this.__longString = `${this.__secondsPart} sec`;
                }
            }
        }
    } // ctor

    get totalMilliseconds() { return this.__totalMilliseconds; }
    get totalSeconds() { return this.__totalSeconds; }
    get totalMinutes() { return this.__totalMinutes; }
    get totalHours() { return this.__totalHours; }
    get totalDays() { return this.__totalDays; }
    get secondsPart() { return this.__secondsPart; }
    get minutesPart() { return this.__minutesPart; }
    get hoursPart() { return this.__hoursPart; }
    get shortString() { return this.__shortString; }
    get longString() { return this.__longString; }

}; // TimeSpan

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

// this should be synchronized with export const gIconMap.
export const gIconOptions = {
    Add: "Add",
    AddCircleOutline: "AddCircleOutline",
    AttachFile: "AttachFile",
    CalendarMonth: "CalendarMonth",
    Campaign: "Campaign",
    Cancel: "Cancel",
    Celebration: "Celebration",
    CheckCircleOutline: "CheckCircleOutline",
    Close: "Close",
    Comment: "Comment",
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
    Info: "Info",
    Launch: "Launch",
    LibraryMusic: "LibraryMusic",
    Link: "Link",
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
    Search: "Search",
    Security: "Security",
    Settings: "Settings",
    Stars: "Stars",
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