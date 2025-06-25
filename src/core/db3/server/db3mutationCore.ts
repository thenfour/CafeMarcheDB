//'use server' - https://stackoverflow.com/questions/76957592/error-only-async-functions-are-allowed-to-be-exported-in-a-use-server-file

import { AuthenticatedCtx, Ctx, assert } from "blitz";
import db, { Prisma } from "db";
import * as mime from 'mime';
import * as mm from 'music-metadata';
import { nanoid } from 'nanoid';
import { ComputeChangePlan, getIntersectingFields } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import { DateTimeRange } from "shared/time";
import { CoalesceBool, ObjectDiff, sanitize } from "shared/utils";
import { TWorkflowChange } from "shared/workflowEngine";
import sharp from "sharp";
import { z } from "zod";
import * as db3 from "../db3";
import { CMDBTableFilterModel, FileCustomData, ForkImageParams, ImageFileFormat, ImageMetadata, TAnyModel, TinsertOrUpdateEventSongListArgs, TinsertOrUpdateEventSongListDivider, TinsertOrUpdateEventSongListSong, TransactionalPrismaClient, TupdateEventCustomFieldValue, TupdateEventCustomFieldValuesArgs, WorkflowObjectType, getFileCustomData } from "../shared/apiTypes";
import { SharedAPI } from "../shared/sharedAPI";
import { EventForCal, EventForCalArgs, GetEventCalendarInput } from "./icalUtils";
import { ChangeAction, ChangeContext, CreateChangeContext, RegisterChange } from "shared/activityLog";

var path = require('path');
var fs = require('fs');
const util = require('util');
//const rename = util.promisify(fs.rename);
const stat = util.promisify(fs.stat);

// returns null if not authorized.
export const getAuthenticatedCtx = (unauthenticatedCtx: Ctx, perm: Permission): AuthenticatedCtx | null => {
    try {
        unauthenticatedCtx.session.$authorize(perm);
        return unauthenticatedCtx as AuthenticatedCtx;
    }
    catch (e) {
        return null;
    }
};


// returns null if public
export const getCurrentUserCore = async (unauthenticatedCtx: Ctx) => {
    try {
        const ctx = getAuthenticatedCtx(unauthenticatedCtx, Permission.visibility_public);
        if (!ctx) throw new Error("unauthorized");
        if (!ctx.session.userId) return null;
        const currentUser = await db.user.findFirst({
            ...db3.UserWithRolesArgs,
            where: {
                id: ctx.session.userId,
            }
        });

        return currentUser;
    } catch (e) {
        return null; // public. no logged in user.
    }
};

export const RecalcEventDateRangeAndIncrementRevision = async (args: { eventId: number, updatingEventModel: Partial<EventForCal>, db?: TransactionalPrismaClient, }) => {
    const transactionalDb: TransactionalPrismaClient = (args.db as any) || (db as any);// have to do this way to avoid excessive stack depth by vs code
    try {
        assert(!!args.eventId, "whoa there event id is not valid; bug.");
        // get list of all event segments
        const segments = await transactionalDb.eventSegment.findMany({
            where: {
                eventId: args.eventId,
            }
        });

        const cancelledStatusIds = (await transactionalDb.eventStatus.findMany({ select: { id: true }, where: { significance: db3.EventStatusSignificance.Cancelled } })).map(x => x.id);

        let range = new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: true });
        for (const segment of segments) {
            const isCancelledSegment = segment.statusId && cancelledStatusIds.includes(segment.statusId);
            if (isCancelledSegment) continue;
            const r = db3.getEventSegmentDateTimeRange(segment);
            range = range.unionWith(r);
        }

        // NOTE: this is going to be the wrong date! we need to calculate the date still.
        let existingEvent = ((await transactionalDb.event.findFirst({
            where: {
                id: args.eventId,
            },
            ...EventForCalArgs,
        })) || {}) as Partial<EventForCal>;

        Object.assign(existingEvent, args.updatingEventModel);
        const dateUpdates = {
            startsAt: range.getSpec().startsAtDateTime,
            durationMillis: range.getSpec().durationMillis,
            isAllDay: range.getSpec().isAllDay,
            endDateTime: range.getEndDateTime(),
        };
        Object.assign(existingEvent, dateUpdates);

        const existingRevision = existingEvent.revision;
        if (existingRevision === undefined) return;

        const calInp = GetEventCalendarInput(existingEvent, cancelledStatusIds)!;
        const newHash = calInp.inputHash || "-";
        const newRevisionSeq = (newHash === (existingEvent.calendarInputHash || "")) ? existingEvent.revision : (existingRevision + 1);

        await transactionalDb.event.update({
            where: { id: args.eventId },
            data: {
                ...dateUpdates,
                revision: newRevisionSeq,
                calendarInputHash: newHash,
            }
        });
    } catch (e) {
        // well weird.
    }
};



// it's not clear to me when this actually fires.
// type EventSegmentChangeHookModelType = Prisma.EventSegmentUserResponseGetPayload<{
//     select: {
//         id: true,
//         eventSegment: {
//             select: {
//                 eventId: true,
//             }
//         }
//     }
// }>;
const ZEventSegmentChangeHookModelType = z.object(
    {
        id: z.number(),
        eventSegment: z.object({
            eventId: z.number(),
        }),
    }
);
type EventSegmentChangeHookModelType = z.infer<typeof ZEventSegmentChangeHookModelType>;

/* the actual model i receive, from the edit response dialog, is:
{
  id: 19337,
  userId: 66,
  eventSegmentId: 324,
  attendanceId: 2,
}

*/
const ZEventSegmentChangeHookModelType2 = z.object(
    {
        id: z.number(),
        userId: z.number(),
        eventSegmentId: z.number(),
        attendanceId: z.number(),
    }
);
type EventSegmentChangeHookModelType2 = z.infer<typeof ZEventSegmentChangeHookModelType2>;

export const CallMutateEventHooks = async (args: {
    tableNameOrSpecialMutationKey: string,
    model: TAnyModel & { id: number },
    db?: TransactionalPrismaClient,
}): Promise<void> => {
    const transactionalDb: TransactionalPrismaClient = (args.db as any) || (db as any);// have to do this way to avoid excessive stack depth by vs code
    let eventIdToUpdate: null | number | undefined = null;
    switch (args.tableNameOrSpecialMutationKey.toLowerCase()) {
        case "event":
            eventIdToUpdate = args.model.id;
            await RecalcEventDateRangeAndIncrementRevision({
                eventId: eventIdToUpdate,
                updatingEventModel: args.model as any,
                db: transactionalDb,
            });
            return;
        case "eventsegment":
            eventIdToUpdate = (args.model as Prisma.EventSegmentGetPayload<{ select: { id: true, eventId: true } }>).eventId;
            break;
        case "eventsegmentuserresponse":
            if (ZEventSegmentChangeHookModelType2.safeParse(args.model).success) {
                const segId = (args.model as EventSegmentChangeHookModelType2).eventSegmentId;
                const eventIdHopefully = (await transactionalDb.eventSegment.findFirst({ where: { id: segId } }))?.eventId;
                if (!eventIdHopefully) {
                    throw new Error("event segment not found");
                }
                eventIdToUpdate = eventIdHopefully;
            } else if (ZEventSegmentChangeHookModelType.safeParse(args.model).success) {
                eventIdToUpdate = (args.model as EventSegmentChangeHookModelType).eventSegment.eventId;
            }
            break;
        case "saveEventWorkflowModel":
        case "mutation:copyeventsegmentresponses":
        case "mutation:cleareventsegmentresponses":
            eventIdToUpdate = args.model.id; // is event id.
            break;
        case "eventsonglist":
            eventIdToUpdate = (args.model as Prisma.EventSongListGetPayload<{ select: { id: true, eventId: true } }>).eventId;
            if (!eventIdToUpdate) {
                const sl = await transactionalDb.eventSongList.findFirst({
                    where: {
                        id: args.model.id,
                    },
                    select: {
                        eventId: true,
                    }
                });
                eventIdToUpdate = sl?.eventId;
            }
            break;
        case "eventsonglistsong":
            {
                const songListId = (args.model as Prisma.EventSongListSongGetPayload<{ select: { id: true, eventSongListId: true } }>).eventSongListId;
                const eventIdRet = await transactionalDb.eventSongList.findFirst({
                    select: {
                        eventId: true,
                    },
                    where: {
                        id: songListId,
                    }
                });
                eventIdToUpdate = eventIdRet?.eventId;
            }
            break;
        case "event:eventCustomFieldValue":
            {
                eventIdToUpdate = args.model.id;
            }
            break;
        default:
            return;
    }

    if (eventIdToUpdate) {
        await RecalcEventDateRangeAndIncrementRevision({ eventId: eventIdToUpdate, updatingEventModel: {}, db: transactionalDb });
    }
};


export interface UpdateAssociationsArgs {
    ctx: AuthenticatedCtx;
    changeContext: ChangeContext;

    localTable: db3.xTable;
    column: db3.TagsField<TAnyModel>;

    desiredTagIds: number[];
    localId: number;

    db?: TransactionalPrismaClient,
};

// creates/deletes associations. does not update any other data in associations table; this is only for making/breaking associations.
// this is specifically for arrays of tag IDs. if the association has more to it than just associating two PKs, then you'll need something more sophisticated.
export const UpdateAssociations = async ({ changeContext, ctx, ...args }: UpdateAssociationsArgs) => {
    const transactionalDb: TransactionalPrismaClient = (args.db as any) || (db as any);// have to do this way to avoid excessive stack depth by vs code
    const associationTableName = args.column.getAssociationTableShema().tableName;
    const currentAssociations = await transactionalDb[associationTableName].findMany({
        where: { [args.column.associationLocalIDMember]: args.localId },
    });

    const cp = ComputeChangePlan(currentAssociations.map(a => a[args.column.associationForeignIDMember]), args.desiredTagIds, (a, b) => a === b);

    // remove associations which exist but aren't in the new array
    await db[associationTableName].deleteMany({
        where: {
            [args.column.associationLocalIDMember]: args.localId,
            [args.column.associationForeignIDMember]: {
                in: cp.delete,
            },
        },
    });

    // register those deletions
    for (let i = 0; i < cp.delete.length; ++i) {
        const oldValues = currentAssociations.find(a => a[args.column.associationForeignIDMember] === cp.delete[i])!;
        await RegisterChange({
            action: ChangeAction.delete,
            changeContext,
            table: associationTableName,
            pkid: oldValues.id,
            oldValues,
            ctx,
            db: transactionalDb,
        });
    }

    // create new associations
    for (let i = 0; i < cp.create.length; ++i) {
        const tagId = cp.create[i]!;
        const data = {
            [args.column.associationLocalIDMember]: args.localId,
            [args.column.associationForeignIDMember]: tagId,
        };
        // Note: updatedby / createdby are not supported for associations, because i can't
        // access that table column information from here. i'm also not sure it
        // would be helpful or accurate.
        const newAssoc = await transactionalDb[associationTableName].create({
            data,
        });

        await RegisterChange({
            action: ChangeAction.insert,
            changeContext,
            table: associationTableName,
            pkid: newAssoc.id,
            newValues: newAssoc,
            ctx,
            db: transactionalDb,
        });
    }
};


// DELETE ////////////////////////////////////////////////
export const deleteImpl = async (table: db3.xTable, id: number, ctx: AuthenticatedCtx, clientIntention: db3.xTableClientUsageContext, deleteType: "softWhenPossible" | "hard"): Promise<boolean> => {
    try {
        const contextDesc = `delete:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = db[table.tableName]; // the prisma interface

        // TODO: delete row authorization

        if (table.SqlSpecialColumns.isDeleted && deleteType === "softWhenPossible") {
            // perform a soft delete.
            await updateImpl(table, id, {
                [table.SqlSpecialColumns.isDeleted.member]: true,
            }, ctx, clientIntention);
            return true;
        }

        // delete any associations for this item first.
        table.columns.forEach(async (column) => {
            if (column.fieldTableAssociation !== "associationRecord") { return; }
            await UpdateAssociations({
                changeContext,
                ctx,
                localId: id,
                localTable: table,
                column: column as db3.TagsField<TAnyModel>,
                desiredTagIds: [],
            });
        });

        const oldValues = await dbTableClient.findFirst({ where: { [table.pkMember]: id } });
        if (!oldValues) {
            throw new Error(`can't delete unknown '${table.tableName}' with pk '${id}'`);
        }

        // special hooks?
        // let eventIdToRecalc: null | number = null;
        // if (table.tableName.toLowerCase() === "eventsegment") {
        //     // if you make any changes to event segments, recalculate the event date range.
        //     eventIdToRecalc = (oldValues as Prisma.EventSegmentGetPayload<{}>).eventId;
        // } else if (table.tableName.toLowerCase() === "event") {
        //     eventIdToRecalc = id;
        // }

        const choice = await dbTableClient.deleteMany({ where: { [table.pkMember]: id } });

        await CallMutateEventHooks({
            tableNameOrSpecialMutationKey: table.tableName,
            model: oldValues,
        });

        // if (eventIdToRecalc !== null) {
        //     await RecalcEventDateRangeAndIncrementRevision(eventIdToRecalc);
        // }

        await RegisterChange({
            action: ChangeAction.delete,
            changeContext,
            table: table.tableName,
            pkid: id,
            oldValues: oldValues,
            ctx,
        });
        return true;
    } catch (e) {
        console.error(e);
        throw (e);
    }
};

// INSERT ////////////////////////////////////////////////
export const insertImpl = async <TReturnPayload,>(table: db3.xTable, fields: TAnyModel, ctx: AuthenticatedCtx, clientIntention: db3.xTableClientUsageContext): Promise<TReturnPayload> => {
    try {
        const contextDesc = `insert:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = db[table.tableName]; // the prisma interface

        // converts serialized -> client, but not perfect. because ForeignSingle fields come through with an ID-only, but client payload wants the object not ID.
        // so those values will continue to be ID.
        const clientModelForValidation: TAnyModel = table.getClientModel(fields, "new", clientIntention);
        // converts client -> sanitized client
        const validateResult = table.ValidateAndComputeDiff(clientModelForValidation, clientModelForValidation, "new", clientIntention);
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }

        const dbModel = table.clientToDbModel(validateResult.successfulModel, "new", clientIntention);

        const { localFields, associationFields } = db3.separateMutationValues({ table, fields: dbModel });
        let obj = {};

        // at this point `fields` should not be used because it mixes foreign associations with local values
        if (Object.keys(localFields).length > 0) {
            const authResult = table.authorizeAndSanitize({
                clientIntention,
                contextDesc,
                model: localFields,
                publicData: ctx.session.$publicData,
                rowMode: "new",
                fallbackOwnerId: null,
            });

            if (!authResult.rowIsAuthorized) {
                throw new Error(`unauthorized (row); ${JSON.stringify(Object.keys(authResult.unauthorizedModel))} on table ${table.tableName}`);
            }
            if (authResult.authorizedColumnCount < 1) {
                throw new Error(`unauthorized (0 columns); ${JSON.stringify(Object.keys(authResult.unauthorizedModel))}`);
            }

            // createdBy and updatedBy.
            if (table.SqlSpecialColumns.createdByUser) {
                localFields[table.SqlSpecialColumns.createdByUser.fkidMember!] = ctx.session.userId;
            }
            if (table.SqlSpecialColumns.updatedByUser) {
                localFields[table.SqlSpecialColumns.updatedByUser.fkidMember!] = ctx.session.userId;
            }
            // createdAt and updatedAt are done automatically by prisma.

            obj = await dbTableClient.create({
                data: localFields,
            });

            await RegisterChange({
                action: ChangeAction.insert,
                changeContext,
                table: table.tableName,
                pkid: obj[table.pkMember],
                newValues: localFields,
                ctx,
            });
        }
        // now update any associations
        table.columns.forEach(async (column) => {
            if (column.fieldTableAssociation !== "associationRecord") { return; }
            if (!associationFields[column.member]) { return; }
            await UpdateAssociations({
                changeContext,
                ctx,
                localId: obj[table.pkMember],
                localTable: table,
                column: column as db3.TagsField<TAnyModel>,
                desiredTagIds: associationFields[column.member],
            });
        });

        await CallMutateEventHooks({
            tableNameOrSpecialMutationKey: table.tableName,
            model: { id: obj[table.pkMember], ...obj },
        });

        return obj as any;
    } catch (e) {
        console.error(e);
        throw (e);
    }
}


// UPDATE ////////////////////////////////////////////////
interface UpdateImplResult<T> {
    newModel: T,
    didChangesOccur: boolean,
};
export const updateImpl = async (table: db3.xTable, pkid: number, fields: TAnyModel, ctx: AuthenticatedCtx, clientIntention: db3.xTableClientUsageContext): Promise<UpdateImplResult<TAnyModel>> => {
    try {
        const contextDesc = `update:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = db[table.tableName]; // the prisma interface

        // in order to validate, we must convert "db" values to "client" values which ValidateAndComputeDiff expects.
        const clientModelForValidation: TAnyModel = table.getClientModel(fields, "update", clientIntention);
        const validateResult = table.ValidateAndComputeDiff(clientModelForValidation, clientModelForValidation, "update", clientIntention);
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }
        const dbModel = table.clientToDbModel(validateResult.successfulModel, "update", clientIntention);

        const { localFields, associationFields } = db3.separateMutationValues({ table, fields: dbModel });
        // at this point `fields` should not be used.

        const fullOldObj = await dbTableClient.findFirst({ where: { [table.pkMember]: pkid } });
        const oldRowInfo = table.getRowInfo(fullOldObj);
        const oldValues = getIntersectingFields(localFields, fullOldObj); // only care about values which will actually change.
        let obj = oldValues;
        let didChangesOccur = false;

        if (Object.keys(localFields).length > 0) {
            const authResult = table.authorizeAndSanitize({
                clientIntention,
                contextDesc,
                // we should pass oldValues here to make sure you are authorized to change from the old data. e.g.
                // if you are changing the ownerUserID from someone else to yourself. We should definitely check the old value.
                model: oldValues,//localFields,
                publicData: ctx.session.$publicData,
                rowMode: "update",
                fallbackOwnerId: oldRowInfo.ownerUserId,
            });

            if (!authResult.rowIsAuthorized) {
                throw new Error(`unauthorized (row); ${JSON.stringify(Object.keys(authResult.unauthorizedModel))} on table ${table.tableName}`);
            }
            if (authResult.authorizedColumnCount < 1) {
                throw new Error(`unauthorized (0 columns); ${JSON.stringify(Object.keys(authResult.unauthorizedModel))}`);
            }

            // updatedBy.
            if (table.SqlSpecialColumns.updatedByUser) {
                localFields[table.SqlSpecialColumns.updatedByUser.fkidMember!] = ctx.session.userId;
            }
            // updatedAt are done automatically by prisma.

            obj = await dbTableClient.update({
                where: { [table.pkMember]: pkid },
                data: localFields,
            });

            const d = ObjectDiff(oldValues, obj);
            if (d.areDifferent) {
                didChangesOccur = true;
                await RegisterChange({
                    action: ChangeAction.update,
                    changeContext,
                    table: table.tableName,
                    pkid,
                    oldValues,
                    newValues: obj,
                    ctx,
                });
            }
        }

        // now update any associations
        // TODO: authorization for associations
        table.columns.forEach(async (column) => {
            if (column.fieldTableAssociation !== "associationRecord") { return; }
            if (!associationFields[column.member]) { return; }
            didChangesOccur = true; // not certain if this is correct
            await UpdateAssociations({
                changeContext,
                ctx,
                localId: pkid,
                localTable: table,
                column: column as db3.TagsField<TAnyModel>,
                desiredTagIds: associationFields[column.member],
            });
        });

        await CallMutateEventHooks({
            tableNameOrSpecialMutationKey: table.tableName,
            model: { id: pkid, ...obj },
        });

        return {
            didChangesOccur,
            newModel: obj,
        };
    } catch (e) {
        console.error(e);
        throw (e);
    }
}


/*
model EventSongList {
  id          Int    @id @default(autoincrement())
  sortOrder   Int    @default(0)
  name        String
  description String @default("")
  createdByUserId     Int? // required in order to know visibility when visiblePermissionId is NULL
  visiblePermissionId Int? // which permission determines visibility, when NULL, only visible by admins + creator
  eventId Int
}

model EventSongListSong {
  id        Int     @id @default(autoincrement())
  subtitle  String? // could be a small comment like "short version"
  sortOrder Int     @default(0)
  songId Int
  eventSongListId Int
}
*/

export interface UpdateEventSongListSongsArgs {
    ctx: AuthenticatedCtx;
    changeContext: ChangeContext;
    desiredSongs: TinsertOrUpdateEventSongListSong[];
    desiredDividers: TinsertOrUpdateEventSongListDivider[];
    songListID: number;
};

// assumes all tables are using "id" as pk column.
// this is hmmm... half-baked into being a generic function. when it's needed, finish it.
// this is very different from the other UpdateAssociations() ...
// - here, we support multiple songs in the same list. so localid:foreignid is not a unique constraint.
//   it means we cannot rely on fk for computing change request.
// - we have additional info in the association table.
export const UpdateEventSongListSongs = async ({ changeContext, ctx, ...args }: UpdateEventSongListSongsArgs) => {
    // SONGS:

    // give all incoming items a temporary unique ID, in order to compute change request. negative values are considered new items
    const desiredSongs: TinsertOrUpdateEventSongListSong[] = args.desiredSongs.map((a, index) => ({
        id: a.id || -(index + 1), // negative index would be a unique value for temp purposes
        songId: a.songId,
        sortOrder: a.sortOrder,
        subtitle: a.subtitle || "",
    }));

    // get current associations to the local / parent item (eventsonglistid)
    const currentAssociationsRaw: Prisma.EventSongListSongGetPayload<{}>[] = await db.eventSongListSong.findMany({
        where: { eventSongListId: args.songListID },
    });

    // in order to make the change plan, unify the types into the kind that's passed in args
    const currentAssociations: TinsertOrUpdateEventSongListSong[] = currentAssociationsRaw.map(a => ({
        id: a.id,
        songId: a.songId,
        sortOrder: a.sortOrder,
        subtitle: a.subtitle || "",
    }));

    // computes which associations need to be created, deleted, and which may need to be updated
    const cp = ComputeChangePlan(
        currentAssociations,
        desiredSongs, // ORDER matters; we assume 'b' is the desired.
        (a, b) => a.id === b.id, // all should have unique numeric IDs. could assert that.
    );

    // execute the plan:

    // do deletes
    await db.eventSongListSong.deleteMany({
        where: {
            id: {
                in: cp.delete.map(x => x.id!),
            }
        },
    });

    // create new associations
    for (let i = 0; i < cp.create.length; ++i) {
        const item = cp.create[i]!;
        const newAssoc = await db.eventSongListSong.create({
            data: {
                eventSongListId: args.songListID,

                songId: item.songId,
                sortOrder: item.sortOrder,
                subtitle: item.subtitle,
            },
        });
    }

    // update the rest.
    for (let i = 0; i < cp.potentiallyUpdate.length; ++i) {
        const item = cp.potentiallyUpdate[i]!;
        const data = {};

        const checkChangedColumn = (columnName: string) => {
            if (item.a[columnName] === item.b[columnName]) return;
            data[columnName] = item.b[columnName];
        };

        checkChangedColumn("songId");
        checkChangedColumn("sortOrder");
        checkChangedColumn("subtitle");

        if (Object.entries(data).length < 1) {
            // nothing to update.
            continue;
        }

        const newAssoc = await db.eventSongListSong.update({
            where: {
                id: item.a.id!,
            },
            data,
        });
    }


    // DIVIDERS:

    // give all incoming items a temporary unique ID, in order to compute change request. negative values are considered new items
    const desiredDividers: TinsertOrUpdateEventSongListDivider[] = args.desiredDividers.map((a, index) => ({
        id: a.id || -(index + 1), // negative index would be a unique value for temp purposes
        sortOrder: a.sortOrder,
        color: a.color,
        isInterruption: a.isInterruption,
        subtitleIfSong: a.subtitleIfSong,
        isSong: a.isSong,
        lengthSeconds: a.lengthSeconds,
        textStyle: a.textStyle,
        subtitle: a.subtitle || "",
    }));

    // get current associations to the local / parent item (eventsonglistid)
    const currentDivAssociationsRaw: Prisma.EventSongListDividerGetPayload<{}>[] = await db.eventSongListDivider.findMany({
        where: { eventSongListId: args.songListID },
    });

    // in order to make the change plan, unify the types into the kind that's passed in args
    const currentDivAssociations: TinsertOrUpdateEventSongListDivider[] = currentDivAssociationsRaw.map(a => ({
        id: a.id,
        sortOrder: a.sortOrder,
        isInterruption: a.isInterruption,
        subtitleIfSong: a.subtitleIfSong,
        isSong: a.isSong,
        lengthSeconds: a.lengthSeconds,
        textStyle: a.textStyle,
        color: a.color,
        subtitle: a.subtitle || "",
    }));

    // computes which associations need to be created, deleted, and which may need to be updated
    const cpDiv = ComputeChangePlan(
        currentDivAssociations,
        desiredDividers, // ORDER matters; we assume 'b' is the desired.
        (a, b) => a.id === b.id, // all should have unique numeric IDs. could assert that.
    );

    // execute the plan:

    // do deletes
    await db.eventSongListDivider.deleteMany({
        where: {
            id: {
                in: cpDiv.delete.map(x => x.id!),
            }
        },
    });

    // create new associations
    for (let i = 0; i < cpDiv.create.length; ++i) {
        const item = cpDiv.create[i]!;
        const newAssoc = await db.eventSongListDivider.create({
            data: {
                eventSongListId: args.songListID,

                sortOrder: item.sortOrder,
                isInterruption: item.isInterruption,
                isSong: item.isSong,
                subtitleIfSong: item.subtitleIfSong,
                lengthSeconds: item.lengthSeconds,
                textStyle: item.textStyle,
                color: item.color,
                subtitle: item.subtitle,
            },
        });
    }

    // update the rest.
    for (let i = 0; i < cpDiv.potentiallyUpdate.length; ++i) {
        const item = cpDiv.potentiallyUpdate[i]!;
        const data = {};

        const checkChangedColumn = (columnName: string) => {
            if (item.a[columnName] === item.b[columnName]) return;
            data[columnName] = item.b[columnName];
        };

        checkChangedColumn("sortOrder");
        checkChangedColumn("subtitle");
        checkChangedColumn("color");
        checkChangedColumn("subtitleIfSong");
        checkChangedColumn("isInterruption");
        checkChangedColumn("isSong");
        checkChangedColumn("lengthSeconds");
        checkChangedColumn("textStyle");

        if (Object.entries(data).length < 1) {
            // nothing to update.
            continue;
        }

        const newAssoc = await db.eventSongListDivider.update({
            where: {
                id: item.a.id!,
            },
            data,
        });
    }

    // const newValues: Pick<TinsertOrUpdateEventSongListArgs, 'songs' | 'dividers'> = {
    //     songs: cp.desiredState,
    //     dividers: cpDiv.desiredState,
    // }

    // #340 / #331 removing activity log bloat temporarily
    const newValues: Pick<TinsertOrUpdateEventSongListArgs, 'songs' | 'dividers'> = {
        songs: [],
        dividers: [],
    }

    // make a custom change obj. let's not bother with "old state"; this just gets too verbose and that's not helpful.
    await RegisterChange({
        action: ChangeAction.update,
        changeContext,
        table: "eventSongList:Songs",
        pkid: args.songListID,
        oldValues: {},
        newValues,
        ctx,
        options: { dontCalculateChanges: true },
    });

    await CallMutateEventHooks({
        tableNameOrSpecialMutationKey: "EventSongList",
        model: { id: args.songListID }
    });

};


export interface QueryImplArgs {
    schema: db3.xTable;
    clientIntention: db3.xTableClientUsageContext;
    filterModel: CMDBTableFilterModel;
    // when records are fetched internally it's important sometimes to bypass visibility check.
    // case: gallery items reference files. both gallery items and files have visibility checks.
    // if the gallery item passes, but file fails, what should be done? well that's too edgy of a case to care about.
    // better to just have 1 check: the gallery item
    skipVisibilityCheck: boolean;
    ctx: Ctx;
};

export const queryManyImpl = async <TitemPayload,>({ clientIntention, filterModel, ctx, ...args }: QueryImplArgs) => {
    const currentUser = await getCurrentUserCore(ctx);
    const contextDesc = `queryManyImpl:${args.schema.tableName}`;
    if (clientIntention.intention === "public") {
        clientIntention.currentUser = undefined;// for public intentions, no user should be used.
    }
    else {
        clientIntention.currentUser = currentUser;
    }
    const where = await args.schema.CalculateWhereClause({
        clientIntention,
        filterModel,
        skipVisibilityCheck: args.skipVisibilityCheck,
    });

    const include = args.schema.CalculateInclude(clientIntention, filterModel);

    const items = await db[args.schema.tableName].findMany({
        where,
        orderBy: args.schema.naturalOrderBy,
        include,
        //take: input.take,
    }) as TitemPayload[];

    const rowAuthResult = (items as TAnyModel[]).map(row => args.schema.authorizeAndSanitize({
        contextDesc,
        publicData: ctx.session.$publicData,
        clientIntention,
        rowMode: "view",
        model: row,
        fallbackOwnerId: null,
    }));

    // any unknown / unauthorized columns are simply discarded.
    const sanitizedItems = rowAuthResult.filter(r => r.rowIsAuthorized).map(r => r.authorizedModel);

    return {
        items: sanitizedItems,
        where,
        include,
        clientIntention,
    };

};


export const queryFirstImpl = async <TitemPayload,>({ clientIntention, filterModel, ctx, skipVisibilityCheck, ...args }: QueryImplArgs) => {

    const contextDesc = `queryFirstImpl:${args.schema.tableName}`;

    const currentUser = await getCurrentUserCore(ctx);
    if (clientIntention.intention === "public") {
        clientIntention.currentUser = undefined;// for public intentions, no user should be used.
    }
    else {
        clientIntention.currentUser = currentUser;
    }

    const where = await args.schema.CalculateWhereClause({
        clientIntention,
        filterModel,
        skipVisibilityCheck,
    });

    const include = args.schema.CalculateInclude(clientIntention, filterModel);

    let item = await db[args.schema.tableName].findFirst({
        where,
        orderBy: args.schema.naturalOrderBy,
        include,
        //take: input.take,
    }) as (TitemPayload | null);

    if (!!item) {
        const rowAuthResult = args.schema.authorizeAndSanitize({
            contextDesc,
            publicData: ctx.session.$publicData,
            clientIntention,
            rowMode: "view",
            model: item,
            fallbackOwnerId: null,
        });
        // any unknown / unauthorized columns are simply discarded.
        if (!rowAuthResult.rowIsAuthorized) {
            item = null;
        } else {
            item = rowAuthResult.authorizedModel as any;
        }
    }

    return {
        item,
        where,
        include,
        clientIntention,
    };

};



export const GetFileServerStoragePath = (storedLeafName: string) => {
    return path.resolve(`${process.env.FILE_UPLOAD_PATH}`, storedLeafName);
}


export interface PrepareNewFileRecordArgs {
    uploadedByUserId: number;
    lastModifiedDate: Date | undefined | null;
    humanReadableLeafName: string;
    sizeBytes: number | null;
    visiblePermissionId: number | null;
    parentFileId?: number;
    previewFileId?: number;
};
export function PrepareNewFileRecord({ uploadedByUserId, humanReadableLeafName, sizeBytes, visiblePermissionId, previewFileId, parentFileId, lastModifiedDate }: PrepareNewFileRecordArgs): Prisma.FileUncheckedCreateInput {
    //const file = field[iFile];
    //const oldpath = file.filepath; // temp location that formidable has saved it to. 'C:\Users\carl\AppData\Local\Temp\2e3b4218f38f5aedcf765f801'

    // generate a new unique filename given to the file. like a GUID. "2e3b4218f38f5aedcf765f801"
    // file.newFilename is already done for us, though it doesn't seem very secure. i want to avoid using sequential IDs to avoid scraping.
    // so generate a new guid.
    const filename = nanoid(10);//file.newFilename;

    // keeping the extension is actually important for mime-type serving. or, save mime-type in db?
    const extension = path.extname(humanReadableLeafName); // includes dot. ".pdf"
    const storedLeafName = `${filename}${extension?.length ? extension : ".bin"}`;

    // also we have some metadata...
    //const size = file.size; // sizeBytes seems to exist but is not populated afaik

    // relative to current working dir.
    //const newpath = path.resolve(`${process.env.FILE_UPLOAD_PATH}`, leaf);

    // workaround broken
    const mimeType = (mime as any).getType(humanReadableLeafName); // requires a leaf only, for some reason explicitly fails on a full path.

    const fields: Prisma.FileUncheckedCreateInput = {
        fileLeafName: humanReadableLeafName,
        uploadedAt: new Date(),
        uploadedByUserId,
        description: "",
        storedLeafName,
        isDeleted: false,
        sizeBytes, // temp value
        visiblePermissionId,
        mimeType,
        previewFileId,
        parentFileId,
        fileCreatedAt: lastModifiedDate || new Date(), // fall back to today
    };
    return fields;
};

export const GetImageMetadata = async (img: sharp.Sharp): Promise<ImageMetadata> => {
    return new Promise(async (resolve, reject) => {
        const metadata = await img.metadata();
        if (metadata.width !== undefined && metadata.height !== undefined) {
            resolve({
                width: metadata.width!,
                height: metadata.height!,
            });
            return;
        }
        resolve({
            // unknown.
        });
        return;
    });
};

export const ForkImageImpl = async (params: ForkImageParams, ctx: AuthenticatedCtx) => {
    const currentUser = await getCurrentUserCore(ctx);
    if (!currentUser) {
        throw new Error(`public cannot create files`);
    }
    const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: 'user', mode: 'primary' };

    // get the parent file record
    const parentFile = await db.file.findFirst({
        where: { id: params.parentFileId }
    });  //await QueryFileByStoredLeaf({ clientIntention, storedLeafName: params.parentFileLeaf, ctx });
    if (!parentFile) {
        throw new Error(`parent file not found`);
    }

    // new filename will be same as old, with new extension and add a tag.
    const parsedPath = path.parse(parentFile.fileLeafName); // user-friendly name
    // path.parse('/home/user/dir/file.txt');
    // Returns:
    //   base: 'file.txt',
    //   ext: '.txt',
    //   name: 'file'
    const newLeaf = `${parsedPath.name}_.${params.outputType}`;

    const newFile = PrepareNewFileRecord({
        humanReadableLeafName: newLeaf,
        sizeBytes: 0, // fill in later when it's known!
        uploadedByUserId: currentUser.id,
        visiblePermissionId: parentFile.visiblePermissionId, // theoretically this can result in issues if original uploader is not the same as the new uploader and this is NULL. however NULL implies it's not meant to be seen by others so i don't think it's something that needs to be fixed.
        parentFileId: parentFile.id,
        lastModifiedDate: new Date(),
    });// as Record<string, any>; // because we're adding custom fields and i'm too lazy to create more types

    // perform the adjustments on parent image + save on disk
    const parentFullPath = GetFileServerStoragePath(parentFile.storedLeafName);
    const outputPath = GetFileServerStoragePath(newFile.storedLeafName);
    const customData: FileCustomData = {
        relationToParent: "forkedImage",
        forkedImage: {
            creationEditParams: { ...params.editParams },
        }
        // image metadata will be populated later in post-processing.
    };

    // we must add ".rotate()" here to tell sharp to bake the metadata orientation into the image, so we're working with the same dimensions as the user expects.
    // https://stackoverflow.com/questions/48716266/sharp-image-library-rotates-image-when-resizing
    let newImage = sharp(parentFullPath).rotate();
    //const parentMetadata = await newImage.metadata();
    //console.log(`(${parentMetadata.width}, ${parentMetadata.height}`);
    // if (parentMetadata.width === undefined) throw new Error(`unable to access parent image dimensions; invalid file? obsolete file? not actually an image?`);
    // if (parentMetadata.height === undefined) throw new Error(`width was fine but height isn't? I'm not even sure what this is.`);

    const info = SharedAPI.files.getImageFileEditInfo(parentFile, params.editParams);

    // perform crop
    newImage = await newImage.extract({
        left: Math.round(info.cropBegin.x),
        top: Math.round(info.cropBegin.y),
        width: Math.round(info.cropSize.width),
        height: Math.round(info.cropSize.height),
    });

    // resize
    if (params.newDimensions) {
        newImage = await newImage.resize({
            // position is only used when aspect ratio changes and there would potentially be overflow or border.
            width: Math.round(params.newDimensions.width),
            height: Math.round(params.newDimensions.height),
        });
    }

    // save
    await newImage.toFile(outputPath);

    // update size now that it can be known
    const stats = await stat(outputPath);
    newFile.sizeBytes = stats.size;

    // seems natural to gather the metadata right now, however it gets done in post-processing so it's not necessary.
    newFile.customData = JSON.stringify(customData);

    const ret = await insertImpl(db3.xFile, newFile, ctx, clientIntention) as Prisma.FileGetPayload<{}>;

    await PostProcessFile({ file: ret });

    return ret;
};


export interface ForkResizeImageParams {
    parentFile: Prisma.FileGetPayload<{}>;
    ctx: AuthenticatedCtx;
    maxImageDimension: number;
};

export const ForkResizeImageImpl = async ({ parentFile, ctx, maxImageDimension }: ForkResizeImageParams): Promise<Prisma.FileGetPayload<{}> | null> => {
    const outputType: ImageFileFormat = "jpg";

    if (!(parentFile.mimeType || "").toLowerCase().startsWith("image")) {
        return null;
    }

    const currentUser = await getCurrentUserCore(ctx);
    if (!currentUser) {
        throw new Error(`public cannot create files`);
    }
    const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: 'user', mode: 'primary' };

    // new filename will be same as old, with new extension and add a tag.
    const parsedPath = path.parse(parentFile.fileLeafName); // user-friendly name
    const newLeaf = `${parsedPath.name}_.${outputType}`;

    const newFile = PrepareNewFileRecord({
        humanReadableLeafName: newLeaf,
        sizeBytes: 0, // fill in later when it's known!
        uploadedByUserId: currentUser.id,
        visiblePermissionId: parentFile.visiblePermissionId, // theoretically this can result in issues if original uploader is not the same as the new uploader and this is NULL. however NULL implies it's not meant to be seen by others so i don't think it's something that needs to be fixed.
        parentFileId: parentFile.id,
        lastModifiedDate: new Date(),
    });// as Record<string, any>; // because we're adding custom fields and i'm too lazy to create more types

    // perform the adjustments on parent image + save on disk
    const parentFullPath = GetFileServerStoragePath(parentFile.storedLeafName);
    const outputPath = GetFileServerStoragePath(newFile.storedLeafName);
    const customData: FileCustomData = {
        relationToParent: "forkedImage",
        // image metadata will be populated later in post-processing.
    };

    // we must add ".rotate()" here to tell sharp to bake the metadata orientation into the image, so we're working with the same dimensions as the user expects.
    // https://stackoverflow.com/questions/48716266/sharp-image-library-rotates-image-when-resizing
    let newImage = sharp(parentFullPath).rotate();
    const metadata = await newImage.metadata();
    if (!metadata) return null;
    if (!metadata.width) return null;
    if (!metadata.height) return null;
    if (metadata.width <= maxImageDimension || metadata.height <= maxImageDimension) {
        return null;
    }

    // resize required
    newImage = await newImage.resize({
        width: maxImageDimension,
        height: maxImageDimension,
        fit: 'inside'  // Keeps the aspect ratio and ensures the image fits within the dimensions
    });

    // save
    await newImage.toFile(outputPath);

    // update size now that it can be known
    const stats = await stat(outputPath);
    newFile.sizeBytes = stats.size;

    // seems natural to gather the metadata right now, however it gets done in post-processing so it's not necessary.
    newFile.customData = JSON.stringify(customData);

    const ret = await insertImpl(db3.xFile, newFile, ctx, clientIntention) as Prisma.FileGetPayload<{}>;

    await PostProcessFile({ file: ret });

    return ret;
};





// WHY have such a function?
// 1. it's for all files not just images
// 2. it will take action depending on the format. there are various ways of uploading images, this is a singular place to take care of sorting out details like thumbnail creation.
export const PostProcessFile = async ({ file }: { file: Prisma.FileGetPayload<{}> }) => {
    const path = GetFileServerStoragePath(file.storedLeafName);
    const fileCustomData = getFileCustomData(file);
    if ((file.mimeType || "").toLowerCase().startsWith("image")) {
        // gather metadata
        try {
            let img = sharp(path);
            fileCustomData.imageMetadata = await GetImageMetadata(img);
            await db.file.update({
                where: { id: file.id },
                data: {
                    customData: JSON.stringify(fileCustomData),
                }
            });
        } catch (e) {
            console.log(`Error reading image metadata for file ${path}; ${e.message}`);
            console.log(e);
        }

        // decide to create preview if file size is too big
        return;
    }
    if ((file.mimeType || "").toLowerCase().startsWith("audio")) {
        try {
            // gather metadata
            const metadata = await mm.parseFile(path);
            console.log(metadata);
            // TODO
        } catch (e) {
            console.log(`Error reading audio metadata for file ${path}; ${e.message}`);
            console.log(e);
        }

        // create preview if file size is too big. for audio this might be a very lengthy process; some kind of separate worker process would be a better fit for file post-processing tbh.
        return;
    }
};




// assumes all tables are using "id" as pk column.
export const UpdateEventCustomFieldValues = async (changeContext: ChangeContext, ctx: AuthenticatedCtx, args: TupdateEventCustomFieldValuesArgs) => {
    // give all incoming items a temporary unique ID, in order to compute change request. negative values are considered new items
    const desiredValues: TupdateEventCustomFieldValue[] = args.values.map((a, index) => ({
        id: a.id || -(index + 1), // negative index would be a unique value for temp purposes
        customFieldId: a.customFieldId,
        dataType: a.dataType,
        eventId: a.eventId,
        jsonValue: a.jsonValue,
    }));

    // get current associations to the local / parent item (eventsonglistid)
    const currentValuesRaw = await db.eventCustomFieldValue.findMany({
        where: { eventId: args.eventId },
    });

    // in order to make the change plan, unify the types into the kind that's passed in args
    const currentValues: TupdateEventCustomFieldValue[] = currentValuesRaw.map(a => ({
        id: a.id,
        customFieldId: a.customFieldId,
        dataType: a.dataType,
        eventId: a.eventId,
        jsonValue: a.jsonValue,
    }));

    // apply the existing correct db ids
    for (const v of desiredValues) {
        const found = currentValues.find(x => x.customFieldId === v.customFieldId);
        if (found) {
            v.id = found.id;
        }
    }

    // computes which values need to be created, deleted, and which may need to be updated
    const cp = ComputeChangePlan(
        currentValues,
        desiredValues, // ORDER matters; we assume 'b' is the desired.
        (a, b) => a.id === b.id, // all should have unique numeric IDs. could assert that.
    );

    // execute the plan:

    // do deletes
    await db.eventCustomFieldValue.deleteMany({
        where: {
            id: {
                in: cp.delete.map(x => x.id!),
            }
        },
    });

    // create new
    for (let i = 0; i < cp.create.length; ++i) {
        const a = cp.create[i]!;
        const newAssoc = await db.eventCustomFieldValue.create({
            data: {
                eventId: args.eventId,
                customFieldId: a.customFieldId,
                dataType: a.dataType,
                jsonValue: a.jsonValue,
            },
        });
        // save the new id.
        a.id = newAssoc.id;
        const dv = desiredValues.find(x => x.customFieldId === a.customFieldId);
        if (dv) {
            dv.id = newAssoc.id;
        }
    }

    // updates
    for (let i = 0; i < cp.potentiallyUpdate.length; ++i) {
        const item = cp.potentiallyUpdate[i]!;
        const data = {};

        const checkChangedColumn = (columnName: keyof Prisma.EventCustomFieldValueGetPayload<{}>) => {
            if (item.a[columnName] === item.b[columnName]) return;
            data[columnName] = item.b[columnName];
        };

        checkChangedColumn("customFieldId");
        checkChangedColumn("dataType");
        checkChangedColumn("jsonValue");

        if (Object.entries(data).length < 1) {
            // nothing to update.
            continue;
        }

        const newAssoc = await db.eventCustomFieldValue.update({
            where: {
                id: item.a.id!,
            },
            data,
        });

    }

    // make a custom change obj. let's not bother with "old state"; this just gets too verbose and that's not helpful.
    await RegisterChange({
        action: ChangeAction.update,
        changeContext,
        table: "event:eventCustomFieldValue",
        pkid: args.eventId,
        oldValues: {},
        newValues: cp.desiredState,
        ctx,
        options: { dontCalculateChanges: true },
    });

    await CallMutateEventHooks({
        tableNameOrSpecialMutationKey: "event:eventCustomFieldValue",
        model: { id: args.eventId }
    });
};


export type SyncEntitiesResult = {
    changes: TWorkflowChange[],
    tempToRealIdMappings: { objectType: WorkflowObjectType, tempId: number, realId: number }[],
};

// takes 2 lists of entities, compares them, and performs the requisite CRUD to bring the database in sync with the desired state.
// assumes negative IDs are provisional.
//
// one limitation of this function is that it cannot deal with self-referencing entities. for example,
// if a node entity contains a "nextNodeId", and both have provisional ids, then we would need extra logic to order in a DAG, ensure creating in a safe order, and updating from provisional to real IDs each creation.
export async function SyncNonSelfReferencingEntities<T extends { id: number }>({
    entityName,
    existingEntities,
    desiredEntities,
    allowedKeysForCreate,
    dbOperations,
    ignoreDiffFieldsForUpdates,
    options,
}: {
    entityName: string,
    existingEntities: T[],
    desiredEntities: T[],
    allowedKeysForCreate: (keyof T)[],
    dbOperations: {
        deleteMany: (ids: number[]) => Promise<any>,
        update: (id: number, data: Partial<T>) => Promise<any>,
        create: (data: Omit<T, "id">) => Promise<T>,
    },
    options?: {
        allowDeletions?: boolean | undefined, // default true
    },
    ignoreDiffFieldsForUpdates?: (keyof Omit<T, "id">)[], // only for updates, fields of T which should not ever be updated or contribute to equality check. "id" is automatically included
}): Promise<SyncEntitiesResult> {

    const allowDeletions = CoalesceBool(options?.allowDeletions, true);

    // Compute change plan
    const changePlan = ComputeChangePlan(existingEntities, desiredEntities, (a, b) => a.id === b.id);
    const result: SyncEntitiesResult = {
        changes: [],
        tempToRealIdMappings: [],
    };

    // Delete
    if (allowDeletions) {
        const idsToDelete = changePlan.delete.map(x => x.id);
        if (idsToDelete.length > 0) {
            await dbOperations.deleteMany(idsToDelete);
            result.changes.push(...changePlan.delete.map(x => ({
                action: ChangeAction.delete,
                pkid: x.id,
                objectType: entityName as WorkflowObjectType,
                oldValues: x,
            })));
        }
    }

    // Update
    const ignoredFields: (keyof T)[] = ["id"];
    if (ignoreDiffFieldsForUpdates) ignoredFields.push(...ignoreDiffFieldsForUpdates);
    for (const { a, b } of changePlan.potentiallyUpdate) {
        const diffResult = ObjectDiff(a, b, { ignore: ignoredFields });
        if (!diffResult.areDifferent) continue;
        await dbOperations.update(a.id, diffResult.differences.rhs);
        result.changes.push({
            action: ChangeAction.update,
            pkid: a.id,
            objectType: entityName as WorkflowObjectType,
            oldValues: diffResult.differences.lhs,
            newValues: diffResult.differences.rhs,
        });
    }

    // Create
    for (const entity of changePlan.create) {
        //const { id, ...data } = entity;
        const insertionObj = sanitize(entity, allowedKeysForCreate);
        const newEntity = await dbOperations.create(insertionObj);
        result.changes.push({
            action: ChangeAction.insert,
            pkid: newEntity.id,
            objectType: entityName as WorkflowObjectType,
            newValues: insertionObj,
        });
        result.tempToRealIdMappings.push({
            objectType: entityName as WorkflowObjectType,
            tempId: entity.id,
            realId: newEntity.id,
        });
    }

    return result;
}
