import { Ctx } from "@blitzjs/next";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { randomUUID } from "crypto";
import db from "db"

export enum ChangeAction {
    create = "create",
    update = "update",
    delete = "delete",
}

type RegisterChangeArgs = {
    operationId?: string | null,
    changedAt?: Date | null,
    context: string,
    table: string,
    pkid: number,
    action: ChangeAction,
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

    await db.changes.create({
        data: {
            operationId,
            changedAt,
            context: args.context,
            table: args.table,
            recordId: args.pkid,
            action: args.action,
            userId: args.ctx.session.userId,
            oldValues: JSON.stringify(oldValues),
            newValues: JSON.stringify(newValues),
        }

    });

}

export default {
    ChangeAction,
    RegisterChange,
};

