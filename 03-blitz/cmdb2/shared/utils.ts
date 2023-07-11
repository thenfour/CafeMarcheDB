import { Ctx } from "@blitzjs/next";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { randomUUID } from "crypto";
import db from "db"

// CHANGES /////////////////////////////////////////////////////////////////////////////////////////////////////////
export enum ChangeAction {
    create = "create",
    update = "update",
    delete = "delete",
}

type RegisterChangeArgs = {
    action: ChangeAction, // database operation
    operationId?: string | null,
    changedAt?: Date | null,
    context: string,
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
    const operationId = args.operationId || randomUUID();
    const changedAt = args.changedAt || new Date();

    let oldValues: any = null;
    let newValues: any = null;

    switch (args.action) {
        case ChangeAction.create:
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

    await db.change.create({
        data: {
            operationId,
            sessionHandle: args.ctx?.session?.$handle || null,
            changedAt,
            context: args.context,
            table: args.table,
            recordId: args.pkid,
            action: args.action,
            userId: args.ctx?.session?.userId || null,
            oldValues: JSON.stringify(oldValues),
            newValues: JSON.stringify(newValues),
        }

    });

}

// SETTINGS /////////////////////////////////////////////////////////////////////////////////////////////////////////
enum Setting {
    HomeDescription = "HomeDescription",
};

interface SetSettingArgs {
    ctx: Ctx,
    setting: Setting,
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
            context: "SetSetting",
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
        context: "SetSetting",
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

