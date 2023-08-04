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

type RegisterChangeArgs = {
    action: ChangeAction, // database operation
    changeContext: ChangeContext,
    table: string,
    pkid: number,
    oldValues?: any,
    newValues?: any,
    ctx: Ctx,
}

type CalculateChangesResult = {
    oldValues: any,
    newValues: any,
};

// return an obj of fields which exist in both inputs, and are different.
function CalculateChanges(oldObj: any, newObj: any): CalculateChangesResult {
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

async function RegisterChange(args: RegisterChangeArgs) {
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

enum Setting {
    HomeDescription = "HomeDescription",
};

interface SetSettingArgs {
    ctx: Ctx,
    setting: Setting | string,
    value?: any,
};

async function SetSetting(args: SetSettingArgs) {
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

async function GetSetting(setting: Setting) {
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

type RegisterActionArgs = {
    action: Action, // user operation
    data?: any, // additional data depending on action. will be serialized as JSON.
    ctx: Ctx,
}

async function RegisterActivity(args: RegisterActionArgs) {
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




export default {
    ChangeAction,
    RegisterChange,
    RegisterActivity,
    SetSetting,
    GetSetting,
};

