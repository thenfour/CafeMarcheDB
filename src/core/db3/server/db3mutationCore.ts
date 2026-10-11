import { ChangeAction, ChangeContext, CreateChangeContext, RegisterChange } from "@/src/auth/server/activityLog";
//'use server' - https://stackoverflow.com/questions/76957592/error-only-async-functions-are-allowed-to-be-exported-in-a-use-server-file


import { TAnyModel } from "@/shared/rootroot";
import { CMServerAuthorization } from "@/src/auth/server/serverAuthorization";
import { loadBandTimeZone } from "@/src/server/bandTimeZone";
import { AuthorizationError, assert } from "blitz";
import db, { Prisma } from "db";
import { ComputeChangePlan, getIntersectingFields } from "shared/associationUtils";
import { ObjectDiff } from "shared/utils";
import { requireFileStorageDirectory, resolveFileStoragePath } from "./fileStorage";
import { z } from "zod";
import * as db3 from "../db3";
import { CMDBTableFilterModel, TransactionalPrismaClient } from "../shared/apiTypes";
import { UserWithRolesArgs } from "../shared/schema/userPayloads";
import { queryTable } from "./db3QueryCore";
import { prepareDB3FieldWrites } from "./db3FieldWrites";
import { prepareDB3ReadSelection } from "../shared/core/db3ReadSelection";
import { db3Server } from "./db3Server";
import { EventForCal, EventForCalArgs, GetEventCalendarInput } from "./icalUtils";



export class DB3MutationAuthorizationError extends AuthorizationError {
    constructor(tableName: string, fieldNames: string[]) {
        super();
        this.message = `Not authorized to mutate ${tableName} fields: ${fieldNames.join(", ")}.`;
        this.name = "DB3MutationAuthorizationError";
    }
}

function requireMutationScope(table: db3.xTable, auth: CMServerAuthorization): void {
    if (auth.band && !table.bandScope) {
        throw new DB3MutationAuthorizationError(table.tableName, ["scope"]);
    }
    if (table.bandScope) {
        auth.requireBand();
    }
}

// Child mutations must also be allowed on their declared ownership parent, including reparenting.
async function requireOwnershipParentEdit(table: db3.xTable, fields: TAnyModel,
    auth: CMServerAuthorization, database: TransactionalPrismaClient,
): Promise<void> {
    const parent = table.getBandOwnershipParent();
    if (!parent) {
        return;
    }
    const field = table.getColumn(parent.relation);
    const identity = field?.fkidMember ? fields[field.fkidMember] : undefined;
    if (identity === undefined) {
        return;
    }
    const model = await database[parent.table.tableName].findFirst({
        ...prepareDB3ReadSelection(parent.table, {}).selection,
        where: { [parent.table.pkMember]: identity },
    });
    if (!model || parent.table.getBandId(model) !== auth.requireBand().id
        || !parent.table.authorizeRowForView({ auth, model })
        || !parent.table.authorizeRowForEdit({ auth, model })) {
        throw new DB3MutationAuthorizationError(table.tableName, [parent.relation]);
    }
}

// Settings persistence requires its registered scoped API.
function requireNonSettingMutation(tableName: string): void {
    if (["setting", "globalsetting", "bandsetting", "usersetting", "bandusersetting"].includes(tableName.toLowerCase())) {
        throw new AuthorizationError("Settings must use the registered, scoped settings API.");
    }
}

const createDB3Row = async (
    table: db3.xTable,
    dbTableClient: TAnyModel, // prisma client
    data: TAnyModel,
): Promise<TAnyModel> => {
    if (!table.publicIdMember) {
        // natural id only; no public ID creation needed.
        return await dbTableClient.create({ data });
    }

    const publicIdMember = table.publicIdMember;
    return db3Server.table(table).createWithPublicId(async publicId => {
        data[publicIdMember] = publicId;
        return dbTableClient.create({ data });
    });
};

// DB3 accepts models from any declared entity; its field policy validates their dynamic shape.
export const requireAuthorizedMutationFields = (
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

export const RecalcEventDateRangeAndIncrementRevision = async (args: { eventId: number, updatingEventModel: Partial<EventForCal>, db?: TransactionalPrismaClient, }) => {
    const transactionalDb: TransactionalPrismaClient = (args.db as any) || (db as any);// have to do this way to avoid excessive stack depth by vs code
    assert(!!args.eventId, "whoa there event id is not valid; bug.");
    // get list of all event segments
    const segments = await transactionalDb.eventSegment.findMany({
        where: {
            eventId: args.eventId,
        }
    });

    const cancelledStatusIds = (await transactionalDb.eventStatus.findMany({
        select: { id: true },
        where: { significance: db3.EventStatusSignificance.Cancelled }
    })).map(x => x.id);

    const dateUpdates = db3.getEventDateRangeUpdateColumnsFromSegments(segments, cancelledStatusIds);

    const existingEvent = await transactionalDb.event.findFirst({
        where: {
            id: args.eventId,
        },
        ...EventForCalArgs,
    });
    if (!existingEvent) return;
    const bandTimeZone = await loadBandTimeZone(transactionalDb, existingEvent.bandId);

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
            throw new AuthorizationError("Settings must use the registered, scoped settings API.");
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
    auth: CMServerAuthorization;
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
export const UpdateAssociations = async ({ changeContext, auth, ...args }: UpdateAssociationsArgs) => {
    const transactionalDb: TransactionalPrismaClient = (args.db as any) || (db as any);// have to do this way to avoid excessive stack depth by vs code
    const associationTable = args.column.getAssociationTableShema();
    const associationTableName = associationTable.tableName;
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
        auth,
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
            auth,
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
        const newAssoc = await createDB3Row(
            associationTable,
            transactionalDb[associationTableName],
            data,
        );
        changedAssociations.push(newAssoc);

        await RegisterChange({
            action: ChangeAction.insert,
            changeContext,
            table: associationTableName,
            pkid: newAssoc.id,
            newValues: newAssoc,
            auth,
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
export const deleteImpl = async (table: db3.xTable, id: number, auth: CMServerAuthorization, deleteType: "softWhenPossible" | "hard", transactionalDb: TransactionalPrismaClient = db as any): Promise<boolean> => {
    requireNonSettingMutation(table.tableName);
    requireMutationScope(table, auth);
    try {
        const contextDesc = `delete:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = transactionalDb[table.tableName]; // the prisma interface
        if (!table.authorizeTableForEdit(auth)) {
            throw new DB3MutationAuthorizationError(table.tableName, [table.pkMember]);
        }
        const deleteOperation = requireDeleteOperationAuthorization(table, deleteType);

        const selectionArgs = table.tableName === db3.xUser.tableName
            ? UserWithRolesArgs // require roles in order to do protected auth checks
            : table.getSelectionArgs({ items: [] }, auth);
        const oldValues = await dbTableClient.findFirst({
            ...prepareDB3ReadSelection(table, selectionArgs).selection,
            where: { [table.pkMember]: id },
        });
        if (!oldValues) {
            throw new Error(`can't delete unknown '${table.tableName}' with pk '${id}'`);
        }

        const rowIsAuthorized = deleteOperation === "soft"
            ? table.authorizeRowForDeletePreferSoft({ model: oldValues, auth })
            : table.authorizeRowForDeleteHard({ model: oldValues, auth });
        if (!rowIsAuthorized) {
            throw new DB3MutationAuthorizationError(table.tableName, [table.pkMember]);
        }

        if (deleteOperation === "soft") {
            await updateImpl(table, id, {
                [table.SqlSpecialColumns.isDeleted!.member]: true,
            }, auth, transactionalDb);
            return true;
        }

        // delete any associations for this item first.
        for (const column of table.columns) {
            if (column.fieldTableAssociation !== "associationRecord") continue;
            await UpdateAssociations({
                changeContext,
                auth,
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
            auth,
            db: transactionalDb,
        });
        return true;
    } catch (e) {
        console.error(e);
        throw (e);
    }
};

// INSERT ////////////////////////////////////////////////
export interface DB3ServerInsertDependencies {
    readonly inheritedSourceId?: number;

    // for entities with "serverInsertOnly", these are the server-supplied fields.
    readonly serverOwnedFields?: Readonly<Record<string, unknown>>;
}

export const insertImpl = async <TReturnPayload,>(table: db3.xTable, fields: TAnyModel, auth: CMServerAuthorization,
    transactionalDb: TransactionalPrismaClient = db as any, dependencies?: DB3ServerInsertDependencies,
): Promise<TReturnPayload> => {
    if (table.serverInsertOnly && !dependencies?.serverOwnedFields) {
        // if an entity explicitly requires server-owned fields,
        // then the server caller must provide them.
        throw new DB3MutationAuthorizationError(table.tableName, ["creation"]);
    }
    requireNonSettingMutation(table.tableName);
    requireMutationScope(table, auth);
    try {
        const contextDesc = `insert:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = transactionalDb[table.tableName]; // the prisma interface
        if (!table.authorizeRowBeforeInsert({ auth })) {
            throw new DB3MutationAuthorizationError(table.tableName, Object.keys(fields));
        }
        await requireOwnershipParentEdit(table, fields, auth, transactionalDb);

        const serverFieldsFromClient = table.serverInsertOnly ? Object.keys(fields).filter(member => {
            const field = table.getColumnForAuthorization(member);
            return field && "serverOwned" in field;
        }) : [];
        if (serverFieldsFromClient.length > 0) {
            throw new DB3MutationAuthorizationError(table.tableName, serverFieldsFromClient);
        }

        // converts serialized -> client, but not perfect. because ForeignSingle fields come through with an ID-only, but client payload wants the object not ID.
        // so those values will continue to be ID.
        const clientModelForValidation: TAnyModel = table.getClientModel(fields, "new", auth.user);
        // converts client -> sanitized client
        const validateResult = table.ValidateAndComputeDiff(clientModelForValidation, clientModelForValidation, "new");
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }

        const dbModel = table.clientToDbModel(validateResult.successfulModel, "new");

        // Legacy creator codecs add the current user during conversion. The server sets
        // these declared dependencies after client authorization, alongside band ownership.
        for (const member of table.serverInsertOnly ? Object.keys(dbModel) : []) {
            const field = table.getColumnForAuthorization(member);
            if (field && "serverOwned" in field) {
                delete dbModel[member];
            }
        }

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
                auth,
                rowMode: "new",
                fallbackOwnerId: null,
            });
            const authorizedMutationFields = requireAuthorizedMutationFields(table, authResult);
            ({ localFields: authorizedLocalFields, associationFields: authorizedAssociationFields }
                = db3.separateMutationValues({ table, fields: authorizedMutationFields }));
        }

        if (Object.keys(proposedModel).length > 0 || dependencies || table.bandScope) {
            // Server-owned band/source fields can create a row with only database defaults.
            // createdBy and updatedBy.
            if (table.SqlSpecialColumns.createdByUser) {
                authorizedLocalFields[table.SqlSpecialColumns.createdByUser.fkidMember!] = auth.userId;
            }
            if (table.SqlSpecialColumns.updatedByUser) {
                authorizedLocalFields[table.SqlSpecialColumns.updatedByUser.fkidMember!] = auth.userId;
            }
            // createdAt and updatedAt are done automatically by prisma.


            //await requireUnmergedMutationUsers(transactionalDb, table, { ...authorizedLocalFields, ...authorizedAssociationFields });
            authorizedLocalFields = await prepareDB3FieldWrites(table, authorizedLocalFields, null, auth, transactionalDb);
            if (dependencies?.inheritedSourceId !== undefined) {
                if (!table.bandScope?.inheritedSourceMember) {
                    throw new Error("The table does not declare an inherited source identity.");
                }
                authorizedLocalFields[table.bandScope.inheritedSourceMember] = dependencies.inheritedSourceId;
                for (const field of table.columns) {
                    if (field.inheritsValue && !Object.prototype.hasOwnProperty.call(fields, field.member)) {
                        authorizedLocalFields[field.member] = null;
                    }
                }
            }
            for (const [member, value] of Object.entries(dependencies?.serverOwnedFields ?? {})) {
                const field = table.getColumn(member);
                if (!field || !("serverOwned" in field) || field.fkidMember) {
                    throw new Error(`Server insert dependency is not a declared scalar: ${table.tableID}.${member}.`);
                }
                authorizedLocalFields[member] = (field.writeTransportSchema ?? field.getReadTransportSchema()).parse(value);
            }
            obj = await createDB3Row(table, dbTableClient, authorizedLocalFields);

            await RegisterChange({
                action: ChangeAction.insert,
                changeContext,
                table: table.tableName,
                pkid: obj[table.pkMember],
                newValues: authorizedLocalFields,
                auth,
                db: transactionalDb,
            });
        }
        // now update any associations
        for (const column of table.columns) {
            if (column.fieldTableAssociation !== "associationRecord") continue;
            if (!Object.prototype.hasOwnProperty.call(authorizedAssociationFields, column.member)) continue;
            await UpdateAssociations({
                changeContext,
                auth,
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
export const updateImpl = async (table: db3.xTable, pkid: number, fields: TAnyModel, auth: CMServerAuthorization, transactionalDb: TransactionalPrismaClient = db as any): Promise<UpdateImplResult<TAnyModel>> => {
    requireNonSettingMutation(table.tableName);
    requireMutationScope(table, auth);
    try {
        const contextDesc = `update:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = transactionalDb[table.tableName]; // the prisma interface
        if (!table.authorizeTableForEdit(auth)) {
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
            ...prepareDB3ReadSelection(table, selectionArgs).selection,
            where: { [table.pkMember]: pkid },
        });
        if (!fullOldObj) throw new Error(`${table.tableName} ${pkid} was not found.`);
        if (table.bandScope) {
            auth.requireBandResource(Number(table.getBandId(fullOldObj)));
        }
        await requireOwnershipParentEdit(table, fields, auth, transactionalDb);

        const isDeletedColumn = table.SqlSpecialColumns.isDeleted;
        if (isDeletedColumn && fullOldObj[isDeletedColumn.member] === true) {
            // Any mutation of an archived row belongs to the recovery surface.
            // In particular, ordinary edit rights must not make a guessed ID
            // sufficient to alter or restore deleted content.
            if (!table.authorizeRowForRestore({
                model: fullOldObj,
                auth,
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
                auth,
                rowMode: "update",
                fallbackOwnerId: null,
            });
            const authorizedMutationFields = requireAuthorizedMutationFields(table, authResult);
            ({ localFields: authorizedLocalFields, associationFields: authorizedAssociationFields }
                = db3.separateMutationValues({ table, fields: authorizedMutationFields }));
        }

        if (Object.keys(authorizedLocalFields).length > 0) {
            authorizedLocalFields = await prepareDB3FieldWrites(table, authorizedLocalFields, fullOldObj, auth, transactionalDb);
            const oldValues = getIntersectingFields(authorizedLocalFields, fullOldObj);
            obj = oldValues;

            // updatedBy.
            if (table.SqlSpecialColumns.updatedByUser) {
                authorizedLocalFields[table.SqlSpecialColumns.updatedByUser.fkidMember!] = auth.userId;
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
                    auth,
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
                auth,
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


export const queryFirstImpl = async <TitemPayload,>({ schema, filterModel, auth }: {
    schema: db3.xTable;
    filterModel: CMDBTableFilterModel;
    auth: CMServerAuthorization;
}) => {
    const result = await queryTable({
        table: schema,
        filter: filterModel,
        orderBy: undefined,
        take: 1,
        cmdbQueryContext: "queryFirstImpl",
    }, auth);
    return { item: (result.items[0] as TitemPayload | undefined) ?? null };
};

export const GetFileServerStoragePath = (storedLeafName: string) => {
    return resolveFileStoragePath(requireFileStorageDirectory(), storedLeafName);
}
