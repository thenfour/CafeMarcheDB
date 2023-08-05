import { Ctx } from "@blitzjs/next";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { randomUUID } from "crypto";
import db from "db"

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
export const CoerceToNumberOrNull = (value) => {
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
export const ValidateInt = (arg) => {
    return Number.isInteger(arg);
};

// https://stackoverflow.com/questions/76518631/typescript-return-the-enum-values-in-parameter-using-a-generic-enum-type-method
// interesting that const objects are preferred over enums. but yea for populating datagrid single select options i agree.
export const InstrumentTagSignificance = {
    PowerRequired: "PowerRequired",
    Large: "Large",
} as const satisfies Record<string, string>;

// export const utils = {
//     ChangeAction,
//     RegisterChange,
//     RegisterActivity,
//     SetSetting,
//     GetSetting,
//     CoerceToNumberOrNull,
//     ValidateNullableInt,
//     ValidateInt,
//     InstrumentTagSignificance,
// };

