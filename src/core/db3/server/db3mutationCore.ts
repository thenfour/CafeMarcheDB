//'use server' - https://stackoverflow.com/questions/76957592/error-only-async-functions-are-allowed-to-be-exported-in-a-use-server-file

import { DEFAULT_BAND_TIME_ZONE } from "shared/dateTimePolicy";
import { isBandTimeZoneSetting, reanchorAllDayEvents } from "src/server/dateTime";

import { TAnyModel } from "@/shared/rootroot";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { validateSettingValue } from "@/src/auth/server/settingWrite";
import { loadBandTimeZone } from "@/src/server/bandTimeZone";
import { clearBrandCache } from "@/src/server/brand";
import { AuthenticatedCtx, AuthorizationError, Ctx, assert } from "blitz";
import db, { Prisma } from "db";
import * as mime from 'mime';
import * as mm from 'music-metadata';
import { nanoid } from 'nanoid';
import { ChangeAction, ChangeContext, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { ComputeChangePlan, getIntersectingFields } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import { ObjectDiff } from "shared/utils";
import sharp from "sharp";
import { z } from "zod";
import * as db3 from "../db3";
import { CMDBTableFilterModel, TransactionalPrismaClient } from "../shared/apiTypes";
import { getFileCustomData } from "../shared/fileAPI";
import { FileCustomData, ForkImageParams, ImageFileFormat, ImageMetadata } from "../shared/fileTypes";
import { UserWithRolesArgs } from "../shared/schema/userPayloads";
import { SharedAPI } from "../shared/sharedAPI";
import { queryTable } from "./db3QueryCore";
import { EventForCal, EventForCalArgs, GetEventCalendarInput } from "./icalUtils";
import { generatePublicId, isPublicIdUniqueCollision } from "@/src/server/publicId";
//import { requireUnmergedMutationUsers } from "./mergedUserMutationGuard";
//import { requireUnmergedUserReferences } from "src/auth/server/mergedUserReferences";

var path = require('path');
var fs = require('fs');
const util = require('util');
//const rename = util.promisify(fs.rename);
const stat = util.promisify(fs.stat);

export class DB3MutationAuthorizationError extends AuthorizationError {
    constructor(tableName: string, fieldNames: string[]) {
        super();
        this.message = `Not authorized to mutate ${tableName} fields: ${fieldNames.join(", ")}.`;
        this.name = "DB3MutationAuthorizationError";
    }
}

const PUBLIC_ID_INSERT_RETRIES = 8;

const createDB3Row = async (
    table: db3.xTable,
    dbTableClient: TAnyModel, // prisma client
    data: TAnyModel,
): Promise<TAnyModel> => {
    if (!table.publicIdMember) {
        // natural id only; no public ID creation needed.
        return await dbTableClient.create({ data });
    }

    // theoretically possible to collide, hence the retry loop.
    for (let attempt = 0; attempt < PUBLIC_ID_INSERT_RETRIES; ++attempt) {
        data[table.publicIdMember] = generatePublicId();
        try {
            return await dbTableClient.create({ data });
        } catch (error) {
            if (!isPublicIdUniqueCollision(error)) throw error;
        }
    }
    throw new Error(`Unable to generate a unique public ID for ${table.tableID}.`);
};

const getMutationPublicData = async (ctx: Ctx): Promise<db3.DB3Authorization> => {
    const authorization = await getRequestAuthorization(ctx.session);
    return db3.createDB3Authorization(authorization.user, authorization.effectivePermissions);
};

const requireAuthorizedMutationFields = (
    table: db3.xTable,
    authResult: db3.DB3AuthorizeAndSanitizeResult<TAnyModel>,
): TAnyModel => {
    if (!authResult.rowIsAuthorized
        || authResult.unauthorizedColumnCount > 0
        || authResult.unknownColumnCount > 0) {
        throw new DB3MutationAuthorizationError(table.tableName, [
            ...Object.keys(authResult.unauthorizedModel),
            ...Object.keys(authResult.unknownModel),
        ]);
    }
    return { ...authResult.authorizedModel };
};

const requireDeleteOperationAuthorization = (
    table: db3.xTable,
    deleteType: "softWhenPossible" | "hard",
): "soft" | "hard" => {
    const policy = table.deletePolicy;
    const canSoftDelete = !!table.SqlSpecialColumns.isDeleted;

    if (deleteType === "softWhenPossible" && canSoftDelete && policy === "softOnly") {
        return "soft";
    }
    if (!canSoftDelete && policy === "hard") {
        return "hard";
    }
    throw new DB3MutationAuthorizationError(table.tableName, [table.pkMember]);
};

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
export const getCurrentUserCore = async (ctx: Ctx) => (await getRequestAuthorization(ctx.session)).user;

export const RecalcEventDateRangeAndIncrementRevision = async (args: { eventId: number, updatingEventModel: Partial<EventForCal>, db?: TransactionalPrismaClient, }) => {
    const transactionalDb: TransactionalPrismaClient = (args.db as any) || (db as any);// have to do this way to avoid excessive stack depth by vs code
    assert(!!args.eventId, "whoa there event id is not valid; bug.");
    // get list of all event segments
    const segments = await transactionalDb.eventSegment.findMany({
        where: {
            eventId: args.eventId,
        }
    });

    const cancelledStatusIds = (await transactionalDb.eventStatus.findMany({ select: { id: true }, where: { significance: db3.EventStatusSignificance.Cancelled } })).map(x => x.id);

    const bandTimeZone = await loadBandTimeZone(transactionalDb);
    const dateUpdates = db3.getEventDateBoundsFromSegments(segments, cancelledStatusIds);

    let existingEvent = ((await transactionalDb.event.findFirst({
        where: {
            id: args.eventId,
        },
        ...EventForCalArgs,
    })) || {}) as Partial<EventForCal>;

    Object.assign(existingEvent, args.updatingEventModel);
    Object.assign(existingEvent, dateUpdates);

    const existingRevision = existingEvent.revision;
    if (existingRevision === undefined) return;

    const calInp = GetEventCalendarInput(existingEvent, cancelledStatusIds, bandTimeZone)!;
    const newHash = calInp.inputHash || "-";
    const newRevisionSeq = (newHash === (existingEvent.calendarInputHash || "")) ? existingEvent.revision : (existingRevision + 1);

    await transactionalDb.event.update({
        where: { id: args.eventId },
        data: {
            ...dateUpdates,
            revision: newRevisionSeq,
            calendarInputHash: newHash,
        },
    });
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
    oldModel?: TAnyModel & { id: number },
    additionalModels?: Array<TAnyModel & { id: number }>,
    db?: TransactionalPrismaClient,
}): Promise<void> => {
    const transactionalDb: TransactionalPrismaClient = (args.db as any) || (db as any);// have to do this way to avoid excessive stack depth by vs code
    let eventIdToUpdate: null | number | undefined = null;
    switch (args.tableNameOrSpecialMutationKey.toLowerCase()) {
        case "wikipagerevision":
            // Administrative revision edits must invalidate open drafts as well.
            await transactionalDb.wikiPage.updateMany({
                where: { currentRevisionId: args.model.id },
                data: { contentVersion: { increment: 1 } },
            });
            return;
        case "setting":
            // if you change the band time zone setting, we need to recalculate
            // all-day event date bounds.
            // Why? Because "all day" events mean "all day for the band's timezone" -- not GMT.
            // so those specific events need their date bounds recalculated.
            // another way to think of it is "all day" is a day-long time range in a specific timezone.
            // when that timezone changes, the stored UTC representation changes.
            if (isBandTimeZoneSetting(args.model.name) || isBandTimeZoneSetting(args.oldModel?.name)) {
                await reanchorAllDayEvents(transactionalDb, (isBandTimeZoneSetting(args.oldModel?.name) ? args.oldModel?.value?.trim() || DEFAULT_BAND_TIME_ZONE : DEFAULT_BAND_TIME_ZONE), await loadBandTimeZone(transactionalDb));
            }
            clearBrandCache();
            return;
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
    localModel?: TAnyModel;
    rowMode?: "new" | "update";

    db?: TransactionalPrismaClient,
};

// creates/deletes associations. does not update any other data in associations table; this is only for making/breaking associations.
// this is specifically for arrays of tag IDs. if the association has more to it than just associating two PKs, then you'll need something more sophisticated.
export const UpdateAssociations = async ({ changeContext, ctx, ...args }: UpdateAssociationsArgs) => {
    const transactionalDb: TransactionalPrismaClient = (args.db as any) || (db as any);// have to do this way to avoid excessive stack depth by vs code
    const associationTableName = args.column.getAssociationTableShema().tableName;
    const publicData = await getMutationPublicData(ctx);
    const rowMode = args.rowMode || "update";

    let localModel = args.localModel;
    if (rowMode === "update" && !localModel) {
        localModel = await transactionalDb[args.localTable.tableName].findFirst({
            where: { [args.localTable.pkMember]: args.localId },
        });
        if (!localModel) {
            throw new Error(`${args.localTable.tableName} ${args.localId} was not found.`);
        }
    }

    requireAuthorizedMutationFields(args.localTable, args.localTable.authorizeAndSanitize({
        contextDesc: `association:${args.localTable.tableName}.${args.column.member}`,
        model: { [args.column.member]: args.desiredTagIds },
        existingModel: rowMode === "update" ? localModel : undefined,
        publicData,
        rowMode,
        fallbackOwnerId: null,
    }));

    const currentAssociations = await transactionalDb[associationTableName].findMany({
        where: { [args.column.associationLocalIDMember]: args.localId },
    });

    //////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////
    // hack: this enforces the policy that merged users cannot be referenced in new associations.
    // i am not even sure this route has a UI entrypoint but here it is.
    // better would be a hook system so this function doesn't bake in user table behaviors.
    //
    // update: don't enforce this. no such policy is needed. merged users should be soft-deleted and that's enough.
    //////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////
    // if (args.localTable.tableName === "User") {
    //     await requireUnmergedUserReferences(transactionalDb, [args.localId]);
    // }
    // if (args.column.getForeignTableShema().tableName === "User") {
    //     await requireUnmergedUserReferences(transactionalDb, args.desiredTagIds);
    // }

    const cp = ComputeChangePlan(currentAssociations.map(a => a[args.column.associationForeignIDMember]), args.desiredTagIds, (a, b) => a === b);
    const changedAssociations = currentAssociations.filter(
        association => cp.delete.includes(association[args.column.associationForeignIDMember]),
    );

    // remove associations which exist but aren't in the new array
    await transactionalDb[associationTableName].deleteMany({
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
        changedAssociations.push(newAssoc);

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

    if (changedAssociations.length > 0) {
        await CallMutateEventHooks({
            tableNameOrSpecialMutationKey: associationTableName,
            model: changedAssociations[0],
            additionalModels: changedAssociations.slice(1),
            db: transactionalDb,
        });
    }

    return cp.delete.length > 0 || cp.create.length > 0;
};


// DELETE ////////////////////////////////////////////////
export const deleteImpl = async (table: db3.xTable, id: number, ctx: AuthenticatedCtx, deleteType: "softWhenPossible" | "hard", transactionalDb: TransactionalPrismaClient = db as any): Promise<boolean> => {
    try {
        const contextDesc = `delete:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = transactionalDb[table.tableName]; // the prisma interface
        const publicData = await getMutationPublicData(ctx);
        if (!table.authorizeTableForEdit(publicData)) {
            throw new DB3MutationAuthorizationError(table.tableName, [table.pkMember]);
        }
        const deleteOperation = requireDeleteOperationAuthorization(table, deleteType);

        const selectionArgs = table.tableName === db3.xUser.tableName
            ? UserWithRolesArgs // require roles in order to do protected auth checks
            : table.getSelectionArgs({ items: [] }, publicData);
        const oldValues = await dbTableClient.findFirst({
            ...selectionArgs,
            where: { [table.pkMember]: id },
        });
        if (!oldValues) {
            throw new Error(`can't delete unknown '${table.tableName}' with pk '${id}'`);
        }

        const rowIsAuthorized = deleteOperation === "soft"
            ? table.authorizeRowForDeletePreferSoft({ model: oldValues, publicData })
            : table.authorizeRowForDeleteHard({ model: oldValues, publicData });
        if (!rowIsAuthorized) {
            throw new DB3MutationAuthorizationError(table.tableName, [table.pkMember]);
        }

        if (deleteOperation === "soft") {
            await updateImpl(table, id, {
                [table.SqlSpecialColumns.isDeleted!.member]: true,
            }, ctx, transactionalDb);
            return true;
        }

        // delete any associations for this item first.
        for (const column of table.columns) {
            if (column.fieldTableAssociation !== "associationRecord") continue;
            await UpdateAssociations({
                changeContext,
                ctx,
                localId: id,
                localModel: oldValues,
                localTable: table,
                column: column as db3.TagsField<TAnyModel>,
                desiredTagIds: [],
                db: transactionalDb,
            });
        }

        // special hooks?
        // let eventIdToRecalc: null | number = null;
        // if (table.tableName.toLowerCase() === "eventsegment") {
        //     // if you make any changes to event segments, recalculate the event date range.
        //     eventIdToRecalc = (oldValues as Prisma.EventSegmentGetPayload<{}>).eventId;
        // } else if (table.tableName.toLowerCase() === "event") {
        //     eventIdToRecalc = id;
        // }

        await dbTableClient.deleteMany({ where: { [table.pkMember]: id } });

        await CallMutateEventHooks({
            tableNameOrSpecialMutationKey: table.tableName,
            model: oldValues,
            oldModel: oldValues,
            db: transactionalDb,
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
            db: transactionalDb,
        });
        return true;
    } catch (e) {
        console.error(e);
        throw (e);
    }
};

// INSERT ////////////////////////////////////////////////
export const insertImpl = async <TReturnPayload,>(table: db3.xTable, fields: TAnyModel, ctx: AuthenticatedCtx, transactionalDb: TransactionalPrismaClient = db as any): Promise<TReturnPayload> => {
    try {
        const contextDesc = `insert:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = transactionalDb[table.tableName]; // the prisma interface
        const publicData = await getMutationPublicData(ctx);
        if (!table.authorizeRowBeforeInsert({ publicData })) {
            throw new DB3MutationAuthorizationError(table.tableName, Object.keys(fields));
        }

        // converts serialized -> client, but not perfect. because ForeignSingle fields come through with an ID-only, but client payload wants the object not ID.
        // so those values will continue to be ID.
        const clientModelForValidation: TAnyModel = table.getClientModel(fields, "new", await getCurrentUserCore(ctx));
        // converts client -> sanitized client
        const validateResult = table.ValidateAndComputeDiff(clientModelForValidation, clientModelForValidation, "new");
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }

        const dbModel = table.clientToDbModel(validateResult.successfulModel, "new");

        const proposedMutationFields = db3.separateMutationValues({ table, fields: dbModel });
        const proposedModel = {
            ...proposedMutationFields.localFields,
            ...proposedMutationFields.associationFields,
        };
        let authorizedLocalFields: TAnyModel = {};
        let authorizedAssociationFields: TAnyModel = {};
        let obj: TAnyModel = {};

        // at this point `fields` should not be used because it mixes foreign associations with local values
        if (Object.keys(proposedModel).length > 0) {
            const authResult = table.authorizeAndSanitize({
                contextDesc,
                model: proposedModel,
                publicData,
                rowMode: "new",
                fallbackOwnerId: null,
            });
            const authorizedMutationFields = requireAuthorizedMutationFields(table, authResult);
            ({ localFields: authorizedLocalFields, associationFields: authorizedAssociationFields }
                = db3.separateMutationValues({ table, fields: authorizedMutationFields }));
        }

        if (Object.keys(proposedModel).length > 0) {
            // createdBy and updatedBy.
            if (table.SqlSpecialColumns.createdByUser) {
                authorizedLocalFields[table.SqlSpecialColumns.createdByUser.fkidMember!] = publicData.userId;
            }
            if (table.SqlSpecialColumns.updatedByUser) {
                authorizedLocalFields[table.SqlSpecialColumns.updatedByUser.fkidMember!] = publicData.userId;
            }
            // createdAt and updatedAt are done automatically by prisma.

            if (table.tableName === db3.xSetting.tableName) {
                validateSettingValue(authorizedLocalFields.name, authorizedLocalFields.value);
            }

            //await requireUnmergedMutationUsers(transactionalDb, table, { ...authorizedLocalFields, ...authorizedAssociationFields });
            obj = await createDB3Row(table, dbTableClient, authorizedLocalFields);

            await RegisterChange({
                action: ChangeAction.insert,
                changeContext,
                table: table.tableName,
                pkid: obj[table.pkMember],
                newValues: authorizedLocalFields,
                ctx,
                db: transactionalDb,
            });
        }
        // now update any associations
        for (const column of table.columns) {
            if (column.fieldTableAssociation !== "associationRecord") continue;
            if (!Object.prototype.hasOwnProperty.call(authorizedAssociationFields, column.member)) continue;
            await UpdateAssociations({
                changeContext,
                ctx,
                localId: obj[table.pkMember],
                localModel: obj,
                localTable: table,
                column: column as db3.TagsField<TAnyModel>,
                desiredTagIds: authorizedAssociationFields[column.member],
                rowMode: "new",
                db: transactionalDb,
            });
        }

        await CallMutateEventHooks({
            tableNameOrSpecialMutationKey: table.tableName,
            model: { id: obj[table.pkMember], ...obj },
            db: transactionalDb,
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
export const updateImpl = async (table: db3.xTable, pkid: number, fields: TAnyModel, ctx: AuthenticatedCtx, transactionalDb: TransactionalPrismaClient = db as any): Promise<UpdateImplResult<TAnyModel>> => {
    try {
        const contextDesc = `update:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = transactionalDb[table.tableName]; // the prisma interface
        const publicData = await getMutationPublicData(ctx);
        if (!table.authorizeTableForEdit(publicData)) {
            throw new DB3MutationAuthorizationError(table.tableName, Object.keys(fields));
        }

        // in order to validate, we must convert "db" values to "client" values which ValidateAndComputeDiff expects.
        const clientModelForValidation: TAnyModel = table.getClientModel(fields, "update");
        const validateResult = table.ValidateAndComputeDiff(clientModelForValidation, clientModelForValidation, "update");
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }
        const dbModel = table.clientToDbModel(validateResult.successfulModel, "update");

        const proposedMutationFields = db3.separateMutationValues({ table, fields: dbModel });
        const proposedModel = {
            ...proposedMutationFields.localFields,
            ...proposedMutationFields.associationFields,
        };
        // at this point `fields` should not be used.

        const selectionArgs = table.tableName === db3.xUser.tableName
            ? UserWithRolesArgs
            : {};
        const fullOldObj = await dbTableClient.findFirst({
            ...selectionArgs,
            where: { [table.pkMember]: pkid },
        });
        if (!fullOldObj) throw new Error(`${table.tableName} ${pkid} was not found.`);

        const isDeletedColumn = table.SqlSpecialColumns.isDeleted;
        if (isDeletedColumn && fullOldObj[isDeletedColumn.member] === true) {
            // Any mutation of an archived row belongs to the recovery surface.
            // In particular, ordinary edit rights must not make a guessed ID
            // sufficient to alter or restore deleted content.
            if (!table.authorizeRowForRestore({
                model: fullOldObj,
                publicData,
            })) {
                throw new DB3MutationAuthorizationError(table.tableName, Object.keys(fields));
            }
        }
        let authorizedLocalFields: TAnyModel = {};
        let authorizedAssociationFields: TAnyModel = {};
        let obj: TAnyModel = {};
        let didChangesOccur = false;

        if (Object.keys(proposedModel).length > 0) {
            const authResult = table.authorizeAndSanitize({
                contextDesc,
                // Authorize the proposed values while deriving ownership and
                // row-level access from the persisted row. This prevents an
                // ownership change from authorizing itself.
                model: proposedModel,
                existingModel: fullOldObj,
                publicData,
                rowMode: "update",
                fallbackOwnerId: null,
            });
            const authorizedMutationFields = requireAuthorizedMutationFields(table, authResult);
            ({ localFields: authorizedLocalFields, associationFields: authorizedAssociationFields }
                = db3.separateMutationValues({ table, fields: authorizedMutationFields }));
        }

        if (Object.keys(authorizedLocalFields).length > 0) {
            if (table.tableName === db3.xSetting.tableName) {
                // A raw setting edit can change only its name or only its value.
                const setting = { ...fullOldObj, ...authorizedLocalFields };
                validateSettingValue(setting.name, setting.value);
            }
            const oldValues = getIntersectingFields(authorizedLocalFields, fullOldObj);
            obj = oldValues;

            // updatedBy.
            if (table.SqlSpecialColumns.updatedByUser) {
                authorizedLocalFields[table.SqlSpecialColumns.updatedByUser.fkidMember!] = publicData.userId;
            }
            // updatedAt are done automatically by prisma.

            //await requireUnmergedMutationUsers(transactionalDb, table, { ...authorizedLocalFields, ...authorizedAssociationFields });
            obj = await dbTableClient.update({
                where: { [table.pkMember]: pkid },
                data: authorizedLocalFields,
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
                    db: transactionalDb,
                });
            }
        }

        // now update any associations
        for (const column of table.columns) {
            if (column.fieldTableAssociation !== "associationRecord") continue;
            if (!Object.prototype.hasOwnProperty.call(authorizedAssociationFields, column.member)) continue;
            const didAssociationsChange = await UpdateAssociations({
                changeContext,
                ctx,
                localId: pkid,
                localModel: fullOldObj,
                localTable: table,
                column: column as db3.TagsField<TAnyModel>,
                desiredTagIds: authorizedAssociationFields[column.member],
                db: transactionalDb,
            });
            didChangesOccur = didChangesOccur || didAssociationsChange;
        }

        await CallMutateEventHooks({
            tableNameOrSpecialMutationKey: table.tableName,
            model: { id: pkid, ...obj },
            oldModel: fullOldObj,
            db: transactionalDb,
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


export const queryFirstImpl = async <TitemPayload,>({ schema, filterModel, ctx }: {
    schema: db3.xTable;
    filterModel: CMDBTableFilterModel;
    ctx: Ctx;
}) => {
    const result = await queryTable({
        table: schema,
        filter: filterModel,
        orderBy: undefined,
        take: 1,
        cmdbQueryContext: "queryFirstImpl",
    }, await getRequestAuthorization(ctx.session));
    return { item: (result.items[0] as TitemPayload | undefined) ?? null };
};

export const GetFileServerStoragePath = (storedLeafName: string) => {
    const uploadPath = process.env.FILE_UPLOAD_PATH;
    if (!uploadPath) {
        throw new Error("FILE_UPLOAD_PATH is not configured.");
    }
    if (!storedLeafName
        || storedLeafName !== path.basename(storedLeafName)
        || storedLeafName.includes("/")
        || storedLeafName.includes("\\")) {
        throw new Error("Invalid stored file name.");
    }

    return path.resolve(uploadPath, storedLeafName);
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
    // Image forking creates a new upload and writes to disk. Check mutation
    // authority before looking up or opening the source file.
    ctx.session.$authorize(Permission.upload_files);

    const currentUser = await getCurrentUserCore(ctx);
    if (!currentUser) {
        throw new Error(`public cannot create files`);
    }

    const publicData = await getMutationPublicData(ctx);

    const requiredInsertPermission = db3.xFile.tableAuthMap.Insert;
    if (!publicData.effectivePermissions.includesName(requiredInsertPermission)) {
        throw new DB3MutationAuthorizationError(db3.xFile.tableName, ["insert"]);
    }

    // Resolve the source through the normal File visibility policy. The
    // storedLeafName is a storage identifier, never a bearer capability.
    const { item: parentFile } = await queryFirstImpl<db3.FilePayload>({
        ctx,
        schema: db3.xFile,
        filterModel: {
            items: [{
                operator: "equals",
                field: "id",
                value: params.parentFileId,
            }],
        },
    });
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

    // Preflight the complete File insert before touching the filesystem. The
    // normal insert path repeats this check immediately before persistence.
    requireAuthorizedMutationFields(db3.xFile, db3.xFile.authorizeAndSanitize({
        contextDesc: "forkImage:insertFile",
        model: newFile,
        publicData,
        rowMode: "new",
        fallbackOwnerId: null,
    }));

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

    const ret = await insertImpl(db3.xFile, newFile, ctx) as Prisma.FileGetPayload<{}>;

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

    const ret = await insertImpl(db3.xFile, newFile, ctx) as Prisma.FileGetPayload<{}>;

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


