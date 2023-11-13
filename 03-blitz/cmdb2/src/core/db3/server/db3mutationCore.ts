//'use server' - https://stackoverflow.com/questions/76957592/error-only-async-functions-are-allowed-to-be-exported-in-a-use-server-file

import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { ComputeChangePlan } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import { ChangeAction, ChangeContext, CreateChangeContext, RegisterChange, TAnyModel, areAllEqual } from "shared/utils"
import * as db3 from "../db3";
import { CMDBAuthorizeOrThrow } from "types";
import { AuthenticatedMiddlewareCtx, Ctx, assert } from "blitz";
import { FileCustomData, ForkImageParams, TinsertOrUpdateEventSongListSong, getFileCustomData } from "../shared/apiTypes";
import { nanoid } from 'nanoid'
import * as mime from 'mime';
import sharp from "sharp";
import * as mm from 'music-metadata';

var path = require('path');
var fs = require('fs');
//const util = require('util');
//const rename = util.promisify(fs.rename);

export const getCurrentUserCore = async (unauthenticatedCtx: Ctx) => {
    try {
        // attempt to get authenticated ctx. public access will have none.
        unauthenticatedCtx.session.$authorize(Permission.visibility_public);
        const ctx: AuthenticatedMiddlewareCtx = unauthenticatedCtx as any; // authorize ensures this.
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


export interface UpdateAssociationsArgs {
    ctx: AuthenticatedMiddlewareCtx;
    changeContext: ChangeContext;

    localTable: db3.xTable;
    column: db3.TagsField<TAnyModel>;

    desiredTagIds: number[];
    localId: number;
};

// creates/deletes associations. does not update any other data in associations table; this is only for making/breaking associations.
// this is specifically for arrays of tag IDs. if the association has more to it than just associating two PKs, then you'll need something more sophisticated.
export const UpdateAssociations = async ({ changeContext, ctx, ...args }: UpdateAssociationsArgs) => {
    const associationTableName = args.column.getAssociationTableShema().tableName;
    const currentAssociations = await db[associationTableName].findMany({
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
        });
    }

    // create new associations
    for (let i = 0; i < cp.create.length; ++i) {
        const tagId = cp.create[i]!;
        const newAssoc = await db[associationTableName].create({
            data: {
                [args.column.associationLocalIDMember]: args.localId,
                [args.column.associationForeignIDMember]: tagId,
            },
        });

        await RegisterChange({
            action: ChangeAction.insert,
            changeContext,
            table: associationTableName,
            pkid: newAssoc.id,
            newValues: newAssoc,
            ctx,
        });
    }
};


// DELETE ////////////////////////////////////////////////
export const deleteImpl = async (table: db3.xTable, id: number, ctx: AuthenticatedMiddlewareCtx, clientIntention: db3.xTableClientUsageContext): Promise<boolean> => {
    try {
        const contextDesc = `delete:${table.tableName}`;
        const changeContext = CreateChangeContext(contextDesc);
        CMDBAuthorizeOrThrow(contextDesc, table.editPermission, ctx);
        const dbTableClient = db[table.tableName]; // the prisma interface

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
        const choice = await dbTableClient.deleteMany({ where: { [table.pkMember]: id } });

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
export const insertImpl = async <TReturnPayload,>(table: db3.xTable, fields: TAnyModel, ctx: AuthenticatedMiddlewareCtx, clientIntention: db3.xTableClientUsageContext): Promise<TReturnPayload> => {
    try {
        const contextDesc = `insert:${table.tableName}`;
        CMDBAuthorizeOrThrow(contextDesc, table.editPermission, ctx);
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = db[table.tableName]; // the prisma interface

        const clientModelForValidation: TAnyModel = table.getClientModel(fields, "new");
        const validateResult = table.ValidateAndComputeDiff(clientModelForValidation, clientModelForValidation, "new");
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }

        const { localFields, associationFields } = db3.separateMutationValues({ table, fields });

        // at this point `fields` should not be used because it mixes foreign associations with local values

        const obj = await dbTableClient.create({
            data: localFields,
            //include, // todo: is this needed? why?
        });

        await RegisterChange({
            action: ChangeAction.insert,
            changeContext,
            table: table.tableName,
            pkid: obj[table.pkMember],
            newValues: localFields,
            ctx,
        });

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

        return obj;
    } catch (e) {
        console.error(e);
        throw (e);
    }
}


// UPDATE ////////////////////////////////////////////////
export const updateImpl = async (table: db3.xTable, pkid: number, fields: TAnyModel, ctx: AuthenticatedMiddlewareCtx, clientIntention: db3.xTableClientUsageContext): Promise<TAnyModel> => {
    try {
        const contextDesc = `update:${table.tableName}`;
        CMDBAuthorizeOrThrow(contextDesc, table.editPermission, ctx);
        const changeContext = CreateChangeContext(contextDesc);
        const dbTableClient = db[table.tableName]; // the prisma interface

        // in order to validate, we must convert "db" values to "client" values which ValidateAndComputeDiff expects.
        const clientModelForValidation: TAnyModel = table.getClientModel(fields, "update");
        const validateResult = table.ValidateAndComputeDiff(clientModelForValidation, clientModelForValidation, "update");
        if (!validateResult.success) {
            console.log(`Validation failed during ${contextDesc}`);
            console.log(validateResult);
            throw new Error(`validation failed; log contains details.`);
        }

        const { localFields, associationFields } = db3.separateMutationValues({ table, fields });
        // at this point `fields` should not be used.

        const oldValues = await dbTableClient.findFirst({ where: { [table.pkMember]: pkid } });

        //const include = table.CalculateInclude(clientIntention);

        const obj = await dbTableClient.update({
            where: { [table.pkMember]: pkid },
            data: localFields,
            //include,
        });

        await RegisterChange({
            action: ChangeAction.update,
            changeContext,
            table: table.tableName,
            pkid,
            oldValues,
            newValues: obj,
            ctx,
        });

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

        return obj;
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
    ctx: AuthenticatedMiddlewareCtx;
    changeContext: ChangeContext;
    desiredValues: TinsertOrUpdateEventSongListSong[];
    songListID: number;
};

// assumes all tables are using "id" as pk column.
// this is hmmm... half-baked into being a generic function. when it's needed, finish it.
// this is very different from the other UpdateAssociations() ...
// - here, we support multiple songs in the same list. so localid:foreignid is not a unique constraint.
//   it means we cannot rely on fk for computing change request.
// - we have additional info in the association table.
export const UpdateEventSongListSongs = async ({ changeContext, ctx, ...args }: UpdateEventSongListSongsArgs) => {

    // give all incoming items a temporary unique ID, in order to compute change request. negative values are considered new items
    const desiredValues: TinsertOrUpdateEventSongListSong[] = args.desiredValues.map((a, index) => ({
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
        desiredValues, // ORDER matters; we assume 'b' is the desired.
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

    // register those deletions
    for (let i = 0; i < cp.delete.length; ++i) {
        const oldValues = cp.delete[i];
        await RegisterChange({
            action: ChangeAction.delete,
            changeContext,
            table: "eventSongListSong",
            pkid: oldValues!.id!,
            oldValues,
            ctx,
        });
    }

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

        await RegisterChange({
            action: ChangeAction.insert,
            changeContext,
            table: "eventSongListSong",
            pkid: newAssoc.id,
            newValues: item,
            ctx,
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

        await RegisterChange({
            action: ChangeAction.update,
            changeContext,
            table: "eventSongListSong",
            pkid: newAssoc.id,
            oldValues: item.a,
            newValues: item.b,
            ctx,
        });
    }

};


export interface QueryImplArgs {
    schema: db3.xTable;
    clientIntention: db3.xTableClientUsageContext;
    filterModel: db3.CMDBTableFilterModel;
    // when records are fetched internally it's important sometimes to bypass visibility check.
    // case: gallery items reference files. both gallery items and files have visibility checks.
    // if the gallery item passes, but file fails, what should be done? well that's too edgy of a case to care about.
    // better to just have 1 check: the gallery item
    skipVisibilityCheck: boolean;
    ctx: Ctx;
};

export const queryManyImpl = async <TitemPayload,>({ clientIntention, filterModel, ctx, ...args }: QueryImplArgs) => {
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
        skipVisibilityCheck: args.skipVisibilityCheck,
    });

    const include = args.schema.CalculateInclude(clientIntention);

    const items = await db[args.schema.tableName].findMany({
        where,
        orderBy: args.schema.naturalOrderBy,
        include,
        //take: input.take,
    }) as TitemPayload[];

    return {
        items,
        where,
        include,
        clientIntention,
    };

};

export const queryFirstImpl = async <TitemPayload,>({ clientIntention, filterModel, ctx, skipVisibilityCheck, ...args }: QueryImplArgs) => {
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

    const include = args.schema.CalculateInclude(clientIntention);

    const item = await db[args.schema.tableName].findFirst({
        where,
        orderBy: args.schema.naturalOrderBy,
        include,
        //take: input.take,
    }) as (TitemPayload | null);

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
    humanReadableLeafName: string;
    sizeBytes: number;
    visiblePermissionId: number | null;
    parentFileId?: number;
    previewFileId?: number;
};
export function PrepareNewFileRecord({ uploadedByUserId, humanReadableLeafName, sizeBytes, visiblePermissionId, previewFileId, parentFileId }: PrepareNewFileRecordArgs): Prisma.FileUncheckedCreateInput {
    //const file = field[iFile];
    //const oldpath = file.filepath; // temp location that formidable has saved it to. 'C:\Users\carl\AppData\Local\Temp\2e3b4218f38f5aedcf765f801'

    // generate a new unique filename given to the file. like a GUID. "2e3b4218f38f5aedcf765f801"
    // file.newFilename is already done for us, though it doesn't seem very secure. i want to avoid using sequential IDs to avoid scraping.
    // so generate a new guid.
    const filename = nanoid();//file.newFilename;

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
    };
    return fields;
};


export interface QueryFileArgs {
    ctx: AuthenticatedMiddlewareCtx;
    storedLeafName: string;
    skipVisibilityCheck: boolean;
    clientIntention: db3.xTableClientUsageContext;
};

export interface QueryFileByLeafOrIdResult {
    dbFile: db3.FilePayload;
    fullPath: string;
};

export const QueryFileByStoredLeaf = async ({ clientIntention, storedLeafName, ctx, skipVisibilityCheck }: QueryFileArgs): Promise<null | QueryFileByLeafOrIdResult> => {

    const { item } = await queryFirstImpl<db3.FilePayload>({
        clientIntention,
        ctx,
        schema: db3.xFile,
        skipVisibilityCheck,
        filterModel: {
            items: [{
                operator: "equals",
                field: "storedLeafName",
                value: storedLeafName,
            }]
        }
    });

    if (!item) {
        throw new Error(`file not found`);
    }

    const fullPath = GetFileServerStoragePath(item.storedLeafName || "");

    return {
        fullPath,
        dbFile: item,
    };
};


export const ForkImageImpl = async (params: ForkImageParams, ctx: AuthenticatedMiddlewareCtx) => {
    // validate params
    if (!params.parentFileLeaf) {
        throw new Error(`invalid params`);
    }

    const currentUser = await getCurrentUserCore(ctx);
    const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: 'user', mode: 'primary' };

    // get the parent file record
    const parentFile = await QueryFileByStoredLeaf({ clientIntention, storedLeafName: params.parentFileLeaf, ctx });
    if (!parentFile) {
        throw new Error(`parent file not found`);
    }

    // new filename will be same as old, with new extension and add a tag.
    const parsedPath = path.parse(parentFile.dbFile.fileLeafName);
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
        visiblePermissionId: parentFile.dbFile.visiblePermissionId, // theoretically this can result in issues if original uploader is not the same as the new uploader and this is NULL. however NULL implies it's not meant to be seen by others so i don't think it's something that needs to be fixed.
        parentFileId: parentFile.dbFile.id,
    });// as Record<string, any>; // because we're adding custom fields and i'm too lazy to create more types

    // perform the adjustments on parent image + save on disk
    const outputPath = GetFileServerStoragePath(newFile.storedLeafName);
    const customData: FileCustomData = {
        relationToParent: "forkedImage",
        forkedImage: {
            editParams: { ...params.editParams },
        }
    };
    newFile.customData = JSON.stringify(customData);

    let newImage = sharp(parentFile.fullPath);
    const parentMetadata = await newImage.metadata();
    if (parentMetadata.width === undefined) throw new Error(`unable to access parent image dimensions; invalid file? obsolete file? not actually an image?`);
    if (parentMetadata.height === undefined) throw new Error(`width was fine but height isn't? I'm not even sure what this is.`);

    // TODO: use EXIF orientation otherwise it will be lost...
    // https://stackoverflow.com/questions/48716266/sharp-image-library-rotates-image-when-resizing

    // perform crop
    const left = Math.floor(params.editParams.cropBeginX01 * parentMetadata.width);
    const right = Math.floor(params.editParams.cropEndX01! * parentMetadata.width);
    const top = Math.floor(params.editParams.cropBeginY01! * parentMetadata.height);
    const bottom = Math.floor(params.editParams.cropEndY01! * parentMetadata.height);
    if (left >= right) throw new Error(`Invalid crop dimensions (left > right)`);
    if (top >= bottom) throw new Error(`Invalid crop dimensions (top > bottom)`);
    if (left < 0) throw new Error(`Invalid crop dimensions (left < 0)`);
    if (top < 0) throw new Error(`Invalid crop dimensions (top < 0)`);
    if (params.editParams.cropEndX01! > 1) throw new Error(`Invalid crop dimensions (params.cropEndX01! > 1)`);
    if (params.editParams.cropEndY01! > 1) throw new Error(`Invalid crop dimensions (params.cropEndY01! > 1)`);
    newImage = await newImage.extract({
        left: left,
        top: top,
        width: right - left,
        height: bottom - top,
    });

    // resize
    newImage = newImage.resize({
        position: `${params.editParams.scaleOriginX01 * parentMetadata.width}px ${params.editParams.scaleOriginY01 * parentMetadata.height}px`,
        width: parentMetadata.width * params.editParams.scale,
        height: parentMetadata.height * params.editParams.scale,
        // default fit: "cover",
        //position: "attention",
        //position defaults to center
    });

    // save
    await newImage.toFile(outputPath);

    // update size now that it can be known
    // Get the new file size
    const stats = await fs.stat(outputPath);
    newFile.sizeBytes = stats.size;

    // save to db
    const ret = await insertImpl(db3.xFile, newFile, ctx, clientIntention) as Prisma.FileGetPayload<{}>;

    await PostProcessFile(ret);

    return ret;
};

export const PostProcessFile = async (file: Prisma.FileGetPayload<{}>) => {
    const path = GetFileServerStoragePath(file.storedLeafName);
    const fileCustomData = getFileCustomData(file);
    if ((file.mimeType || "").toLowerCase().startsWith("image")) {
        // gather metadata
        try {
            let img = sharp(path);
            const metadata = await img.metadata();
            if (metadata.width !== undefined && metadata.height !== undefined) {
                fileCustomData.imageMetadata = {
                    width: metadata.width!,
                    height: metadata.height!,
                }
            }

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


