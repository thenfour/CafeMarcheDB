import { randomUUID } from "node:crypto";
import db, { type Prisma } from "db";
import { CalculateChanges } from "../../../shared/associationUtils";
import { CoalesceBool } from "../../../shared/utils";
import type { IAuthorization } from "../shared/cmAuthorization";

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
    // Different models and custom operations supply different snapshot shapes.
    oldValues?: unknown,
    newValues?: unknown,
    auth: IAuthorization,

    //ctx: Ctx,
    // Normally the actor comes from the current session. Session-transition
    // operations can supply the original actor explicitly so attribution is
    // not lost when the session identity changes.
    actorUserId?: number | null,
    options?: RegisterChangeOptions,
    db?: Pick<Prisma.TransactionClient, "change">,
}

export async function RegisterChange(args: RegisterChangeArgs) {
    let oldValues: unknown = null;
    let newValues: unknown = null;

    // Blitz extends Prisma's delegate types; this writer uses the standard API.
    const transactionalDb = args.db ?? { change: db.change as Prisma.ChangeDelegate };

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
                sessionHandle: args.auth.sessionHandle || null,
                changedAt: args.changeContext.changedAt,
                context: args.changeContext.contextDescription,
                table: args.table,
                recordId: args.pkid,
                action: args.action,
                userId: args.actorUserId === undefined
                    ? args.auth.userId ?? null
                    : args.actorUserId,
                oldValues: JSON.stringify(oldValues),
                newValues: JSON.stringify(newValues),
            }

        });

    } catch (e) {
        debugger;
        throw e;
    }

}
