// for mimetype db https://cdn.jsdelivr.net/gh/jshttp/mime-db@master/db.json

import { Ctx } from "@blitzjs/next";
import { AuthenticatedCtx } from 'blitz';
import db, { Prisma } from "db";
import formidable, { PersistentFile } from 'formidable';
import * as mime from 'mime';
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, CoerceToString, IsNullOrWhitespace, isValidURL } from 'shared/utils';
import { api } from "src/blitz-server";
import * as db3 from 'src/core/db3/db3';
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { AutoAssignInstrumentPartition, TClientUploadFileArgs, UploadResponsePayload } from 'src/core/db3/shared/apiTypes';

var path = require('path');
var fs = require('fs');
const util = require('util');
const rename = util.promisify(fs.rename);

function stripExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex <= 0) return filename;
    return filename.substring(0, lastDotIndex);
}


// todo: fields for database integration
// todo: error handling, cancelling for example.

export const config = {
    api: {
        bodyParser: false,
    },
};


// on making blitz-integrated "raw" server API routes: https://blitzjs.com/docs/auth-server#api-routes
export default api(async (req, res, origCtx: Ctx) => {
    origCtx.session.$authorize(Permission.upload_files);
    const ctx: AuthenticatedCtx = origCtx as any; // authorize ensures this.
    const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;
    if (!currentUser) throw new Error(`uploads possible only for users`);

    return new Promise(async (resolve, reject) => {
        if (req.method == 'POST') {
            const form = formidable({});
            await form.parse(req, async (err, fields, files) => {
                const responsePayload: UploadResponsePayload = {
                    files: [],
                    isSuccess: true,
                };

                try {
                    const maxImageDimension: number | undefined = (fields.maxImageDimension && CoerceToNumberOrNull(fields.maxImageDimension[0])) || undefined;

                    // fields comes across with keys corresponding to TClientUploadFileArgs
                    // except the values are arrays of string (length 1), rather than number.
                    const args: TClientUploadFileArgs = {};
                    args.taggedEventId = fields.taggedEventId && (CoerceToNumberOrNull(fields.taggedEventId[0]));
                    args.taggedInstrumentId = fields.taggedInstrumentId && (CoerceToNumberOrNull(fields.taggedInstrumentId[0]));
                    args.taggedSongId = fields.taggedSongId && (CoerceToNumberOrNull(fields.taggedSongId[0]));
                    args.taggedUserId = fields.taggedUserId && (CoerceToNumberOrNull(fields.taggedUserId[0]));
                    args.visiblePermissionId = fields.visiblePermissionId && (CoerceToNumberOrNull(fields.visiblePermissionId[0]));
                    args.fileTagId = fields.fileTagId && (CoerceToNumberOrNull(fields.fileTagId[0]));

                    const visiblePermission = fields.visiblePermission && (CoerceToString(fields.visiblePermission[0]));

                    if (!args.visiblePermissionId && !IsNullOrWhitespace(visiblePermission)) {
                        args.visiblePermissionId = (await db.permission.findFirst({ where: { name: visiblePermission } }))!.id;
                    }

                    if (fields.externalURI) {
                        const sanitizedURI = CoerceToString(fields.externalURI[0]);
                        if (isValidURL(sanitizedURI)) {
                            args.externalURI = sanitizedURI;
                        }
                    }

                    const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: 'user', mode: 'primary' };

                    if (!files || Object.values(files).length < 1) {
                        if (args.externalURI) {
                            // you have uploaded a URI.
                            const uri = new URL(args.externalURI);
                            let leaf = uri.pathname.split("/").pop() || "";
                            if (leaf.trim().length < 1) {
                                leaf = "(unknown)";
                            }

                            const fields = mutationCore.PrepareNewFileRecord({
                                humanReadableLeafName: leaf,
                                sizeBytes: null,
                                lastModifiedDate: new Date(), // no modified date possible here; it will be safer to just set it to today instead of unknown, so at least some temporal data is saved
                                uploadedByUserId: currentUser.id,
                                visiblePermissionId: args.visiblePermissionId || null,
                            }) as Record<string, any>; // because we're adding custom fields and i'm too lazy to create more types

                            if (args.taggedEventId) fields.taggedEvents = [args.taggedEventId];
                            if (args.taggedInstrumentId) fields.taggedInstruments = [args.taggedInstrumentId];
                            if (args.fileTagId) fields.tags = [args.fileTagId];
                            if (args.taggedSongId) fields.taggedSongs = [args.taggedSongId];
                            if (args.taggedUserId) fields.taggedUsers = [args.taggedUserId];
                            if (args.externalURI) (fields as db3.FilePayloadMinimum).externalURI = args.externalURI;

                            const newFile = await mutationCore.insertImpl(db3.xFile, fields, ctx, clientIntention) as Prisma.FileGetPayload<{}>;

                            responsePayload.files.push(newFile);
                        }
                    }

                    // each field can contain multiple files
                    const promises = Object.values(files).map(async (field: PersistentFile) => {
                        for (let iFile = 0; iFile < field.length; ++iFile) {
                            const file = field[iFile];
                            const oldpath = file.filepath; // temp location that formidable has saved it to. 'C:\Users\carl\AppData\Local\Temp\2e3b4218f38f5aedcf765f801'

                            const fields = mutationCore.PrepareNewFileRecord({
                                humanReadableLeafName: file.originalFilename,
                                lastModifiedDate: file.lastModifiedDate,
                                sizeBytes: file.size,
                                uploadedByUserId: currentUser.id,
                                visiblePermissionId: args.visiblePermissionId || null,
                            }) as Record<string, any>; // because we're adding custom fields and i'm too lazy to create more types

                            // generate a new unique filename given to the file. like a GUID. "2e3b4218f38f5aedcf765f801"
                            // file.newFilename is already done for us, though it doesn't seem very secure. i want to avoid using sequential IDs to avoid scraping.
                            // so generate a new guid.
                            //const filename = nanoid();//file.newFilename;

                            // keeping the extension is actually important for mime-type serving. or, save mime-type in db?
                            //const extension = path.extname(file.originalFilename); // includes dot. ".pdf"
                            //const leaf = `${filename}${extension?.length ? extension : ".bin"}`;

                            // also we have some metadata...
                            //const size = file.size; // sizeBytes seems to exist but is not populated afaik

                            // relative to current working dir.
                            const newpath = mutationCore.GetFileServerStoragePath(fields.storedLeafName);

                            // workaround broken typing
                            const mimeType = (mime as any).getType(file.originalFilename) as string | null; // requires a leaf only, for some reason explicitly fails on a full path.

                            // const fields: Record<string, any> = { // similar to: Prisma.FileUncheckedCreateInput = {
                            //     fileLeafName: file.originalFilename,
                            //     uploadedAt: new Date(),
                            //     uploadedByUserId: currentUser.id,
                            //     description: "",
                            //     storedLeafName: leaf,
                            //     isDeleted: false,
                            //     visiblePermissionId: args.visiblePermissionId,
                            //     sizeBytes: size,
                            //     mimeType,
                            // }
                            const allTags = await db.fileTag.findMany();
                            const partitionTag = allTags.find(t => t.significance === db3.FileTagSignificance.Partition);
                            const recordingTag = allTags.find(t => t.significance === db3.FileTagSignificance.Recording);

                            // automatically tag some things.
                            const tags = new Set();
                            if (args.fileTagId) tags.add(args.fileTagId);

                            if (mimeType?.startsWith("audio/") && recordingTag) {
                                tags.add(recordingTag.id);
                            }

                            // if there's a song tag, and you're uploading files, VERY likely it's a partition or recording.
                            // if the mime type is audio, mark it as recording.
                            if (args.taggedSongId && (file.originalFilename as string).toLowerCase().endsWith(".pdf")) {
                                if (partitionTag) {
                                    tags.add(partitionTag.id);

                                    const allInstruments = await db.instrument.findMany();
                                    const aaret = AutoAssignInstrumentPartition({
                                        allInstruments,
                                        fileLeafWithoutExtension: stripExtension(file.originalFilename),
                                    });
                                    fields.taggedInstruments = aaret.matchingInstrumentIds;
                                }

                            } else {
                                if (args.taggedInstrumentId) fields.taggedInstruments = [args.taggedInstrumentId];
                            }

                            if (args.taggedEventId) fields.taggedEvents = [args.taggedEventId];
                            if (args.taggedSongId) fields.taggedSongs = [args.taggedSongId];
                            if (args.taggedUserId) fields.taggedUsers = [args.taggedUserId];
                            fields.tags = [...tags];

                            const newFile = await mutationCore.insertImpl(db3.xFile, fields, ctx, clientIntention) as Prisma.FileGetPayload<{}>;

                            await rename(oldpath, newpath);

                            await mutationCore.PostProcessFile({ file: newFile });

                            if (maxImageDimension !== undefined) {
                                const resizedFile = await mutationCore.ForkResizeImageImpl({
                                    ctx,
                                    parentFile: newFile,
                                    maxImageDimension,
                                });
                                if (resizedFile !== null) {
                                    responsePayload.files.push(resizedFile);
                                } else {
                                    responsePayload.files.push(newFile);
                                }
                            } else {
                                responsePayload.files.push(newFile);
                            }
                        }
                    });

                    await Promise.all(promises);

                    res.json(responsePayload);
                    //res.write(`Files uploaded successfully; cur user : ${ctx.session.$publicData.userId}`);
                    res.end(() => {
                        resolve(undefined);
                    });
                } catch (e) {
                    debugger;
                    responsePayload.errorMessage = e.message;
                    responsePayload.isSuccess = false;
                    res.writeHead(500);
                    res.json(responsePayload);
                    //res.write(`error`);
                    res.end(() => {
                        reject(undefined);
                    });
                }
            });
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write('<form  method="post" enctype="multipart/form-data">');
            res.write('<input type="file" multiple name="filestoupload"><br>');
            res.write('<input type="submit">');
            res.write('</form>');
            res.end(() => {
                resolve(undefined);
            });
        }
    }); // return new promise
});

