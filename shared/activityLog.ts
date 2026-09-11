import db from "db";
import type { Ctx } from "@blitzjs/next";
// Use server-only dynamic import to avoid bundling Node's crypto in client builds
const { randomUUID } = require("crypto") as typeof import("crypto");
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
    // Normally the actor comes from the current session. Session-transition
    // operations can supply the original actor explicitly so attribution is
    // not lost when the session identity changes.
    actorUserId?: number | null,
    options?: RegisterChangeOptions,
    db?: TransactionalPrismaClient,
}

export const AUDIT_REDACTED_VALUE = "[REDACTED]";

const isSensitiveAuditField = (fieldName: string): boolean => {
    const normalized = fieldName.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (normalized.includes("password") && normalized !== "passwordreset") return true;
    return normalized === "token"
        || normalized.endsWith("token")
        || normalized.endsWith("tokenhash")
        || normalized === "secret"
        || normalized.endsWith("secret")
        || normalized.endsWith("secrethash")
        || normalized === "credential"
        || normalized.endsWith("credential")
        || normalized.endsWith("credentialhash");
};

// Change records are retained and displayed through the administrative log.
// Recursively redact credential-shaped fields immediately before persistence so
// callers cannot accidentally serialize reusable credentials or their hashes.
export const redactAuditValues = (value: any): any => {
    if (Array.isArray(value)) return value.map(redactAuditValues);
    if (value === null || typeof value !== "object") return value;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;

    return Object.fromEntries(Object.entries(value).map(([key, childValue]) => [
        key,
        isSensitiveAuditField(key) ? AUDIT_REDACTED_VALUE : redactAuditValues(childValue),
    ]));
};

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
                userId: args.actorUserId === undefined
                    ? args.ctx?.session?.userId || null
                    : args.actorUserId,
                oldValues: JSON.stringify(redactAuditValues(oldValues)),
                newValues: JSON.stringify(redactAuditValues(newValues)),
            }

        });

    } catch (e) {
        debugger;
        throw e;
    }

}
