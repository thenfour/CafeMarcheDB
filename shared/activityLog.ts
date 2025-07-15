import db from "db";
import type { Ctx } from "@blitzjs/next";
import { randomUUID } from "crypto";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { CoalesceBool } from "./utils";
import { CalculateChanges } from "./associationUtils";

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
    db?: TransactionalPrismaClient,
}

export async function RegisterChange(args: RegisterChangeArgs) {
    let oldValues: any = null;
    let newValues: any = null;

    const transactionalDb: TransactionalPrismaClient = (args.db as any) || (db as any);// have to do this way to avoid excessive stack depth by vs code

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

        await transactionalDb.change.create({
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
