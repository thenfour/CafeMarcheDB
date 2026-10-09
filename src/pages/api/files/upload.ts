import type { Ctx } from "@blitzjs/next";
import { AuthenticationError, AuthorizationError, NotFoundError } from "blitz";
import db from "db";
import formidable from "formidable";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { api } from "src/blitz-server";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { MakeErrorUploadResponsePayload } from "src/core/db3/shared/fileAPI";
import { FileUploadArgsSchema } from "src/core/db3/shared/fileUpload";
import type { UploadResponsePayload } from "src/core/db3/shared/fileTypes";
import { FileUploadInputError, uploadFiles } from "src/core/db3/server/fileUpload";
import { GetFileServerStoragePath } from "src/core/db3/server/db3mutationCore";
import { DB3PublicIdError } from "src/core/db3/server/db3PublicIds";

export const config = { api: { bodyParser: false } };

export async function uploadFileRoute(req: NextApiRequest, res: NextApiResponse<UploadResponsePayload>, ctx: Ctx): Promise<void> {
    res.setHeader("Cache-Control", "no-store");
    let staging: string | undefined;
    let storageDirectory: string | undefined;
    try {
        ctx.session.$authorize(Permission.login);
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            res.status(405).end();
            return;
        }
        const bandPublicId = BandPublicIdSchema.parse(req.query.bandPublicId);
        const auth = (await loadAuthorization(ctx.session, bandPublicId)).requireUser();
        auth.requirePermission(Permission.upload_files);
        storageDirectory = path.dirname(GetFileServerStoragePath("upload-staging"));
        await mkdir(storageDirectory, { recursive: true });
        staging = await mkdtemp(path.join(storageDirectory, ".incoming-"));
        const form = formidable({ uploadDir: staging, maxFiles: 20, maxFileSize: 200 * 1024 * 1024,
            maxTotalFileSize: 200 * 1024 * 1024, maxFields: 16, maxFieldsSize: 16 * 1024 });
        const [fields, files] = await form.parse(req);
        // Multipart fields can repeat; this endpoint accepts exactly one value per declared field.
        const singleFields = Object.fromEntries(Object.entries(fields).map(([name, values]) => {
            if (!values || values.length !== 1) {
                throw new FileUploadInputError("Upload fields must have one value each.");
            }
            return [name, values[0]];
        }));
        if (Object.prototype.hasOwnProperty.call(singleFields, "bandPublicId")) {
            throw new FileUploadInputError("Select the upload band in the request URL.");
        }
        const input = FileUploadArgsSchema.parse({ ...singleFields, bandPublicId });
        const parts = Object.values(files).flatMap(values => values ?? []).map(file => ({
            temporaryPath: file.filepath, originalFilename: file.originalFilename ?? "",
            lastModifiedDate: file.mtime ?? null,
        }));
        res.status(200).json(await uploadFiles(db, auth, input, parts, storageDirectory));
    } catch (error) {
        let status = 500;
        if (error instanceof AuthenticationError || error instanceof AuthorizationError || error instanceof NotFoundError) {
            status = error.statusCode;
        } else if (error instanceof DB3PublicIdError) {
            status = 404;
        } else if (error instanceof z.ZodError || error instanceof FileUploadInputError) {
            status = 400;
        } else if (error instanceof Error && "httpCode" in error && typeof error.httpCode === "number") {
            status = error.httpCode;
        }
        const message = error instanceof Error ? error.message : "Upload failed.";
        res.status(status).json(MakeErrorUploadResponsePayload(message));
    } finally {
        if (staging && storageDirectory) {
            // mkdtemp created this exact directory immediately beneath the trusted storage root.
            if (path.dirname(staging) !== storageDirectory || !path.basename(staging).startsWith(".incoming-")) {
                throw new Error("Invalid upload staging directory.");
            }
            await rm(staging, { recursive: true, force: true });
        }
    }
}
export default api(uploadFileRoute);

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/pages/api/files/upload.ts:1-301
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: d28e33a4d6575b35d715228067548da6bfd4ae159ddd7882daf5aed6ce6a1b46
// MIGRATION_REFERENCE_BEGIN
// import { loadAuthorization } from "@/src/auth/server/serverAuthorization";
// // for mimetype db https://cdn.jsdelivr.net/gh/jshttp/mime-db@master/db.json
//
// import { UserPublicId } from "@/shared/publicId";
// import { AutoAssignInstrumentPartition } from "@/src/core/db3/shared/autoAssignInstrumentPartition";
// import { TClientUploadFileArgs, UploadResponsePayload, type UploadedFile } from "@/src/core/db3/shared/fileTypes";
// import { Ctx } from "@blitzjs/next";
// import db, { Prisma } from "db";
// import formidable, { PersistentFile } from 'formidable';
// import * as mime from 'mime';
// import { Permission } from "shared/permissions";
// import { CoerceToNumberOrNull, CoerceToString, IsNullOrWhitespace, isValidURL } from 'shared/utils';
// import { api } from "src/blitz-server";
// import * as db3 from 'src/core/db3/db3';
// import * as mutationCore from 'src/core/db3/server/db3mutationCore';
// import { resolvePublicForeignIds, resolvePublicId } from "src/core/db3/server/db3PublicIds";
//
// var path = require('path');
// var fs = require('fs');
// const util = require('util');
// const rename = util.promisify(fs.rename);
//
// function stripExtension(filename: string): string {
//     const lastDotIndex = filename.lastIndexOf('.');
//     if (lastDotIndex <= 0) return filename;
//     return filename.substring(0, lastDotIndex);
// }
//
// const toUploadedFile = (file: Prisma.FileGetPayload<{}>,
//     uploaderPublicId: UserPublicId | null): UploadedFile => ({
//         publicId: db3.xFile.parseIdentity(file.publicId),
//         storedLeafName: file.storedLeafName,
//         fileLeafName: file.fileLeafName,
//         mimeType: file.mimeType,
//         externalURI: file.externalURI,
//         description: file.description,
//         sizeBytes: file.sizeBytes,
//         customData: file.customData,
//         uploadedByUserId: uploaderPublicId,
//     });
//
//
// // todo: fields for database integration
// // todo: error handling, cancelling for example.
//
// export const config = {
//     api: {
//         bodyParser: false,
//     },
// };
//
//
// // on making blitz-integrated "raw" server API routes: https://blitzjs.com/docs/auth-server#api-routes
// export default api(async (req, res, ctx: Ctx) => {
//     const auth = await loadAuthorization(ctx.session);
//     auth.requirePermission(Permission.upload_files);
//     const authenticatedAuth = auth.requireUser(); // a user is required in order to specify uploadedByUserId et al.
//     const currentUserId = authenticatedAuth.userId;
//     const currentUserPublicId = authenticatedAuth.userPublicId;
//
//     return new Promise(async (resolve, reject) => {
//         if (req.method == 'POST') {
//             const form = formidable({});
//             await form.parse(req, async (err, fields, files) => {
//                 const responsePayload: UploadResponsePayload = {
//                     files: [],
//                     isSuccess: true,
//                 };
//
//                 try {
//                     const maxImageDimension: number | undefined = (fields.maxImageDimension && CoerceToNumberOrNull(fields.maxImageDimension[0])) || undefined;
//
//                     // fields comes across with keys corresponding to TClientUploadFileArgs
//                     // except the values are arrays of string (length 1), rather than number.
//                     const args: TClientUploadFileArgs = {};
//                     args.taggedEventId = fields.taggedEventId && db3.xEvent.parseIdentity(fields.taggedEventId[0]);
//                     args.taggedInstrumentId = fields.taggedInstrumentId && (CoerceToNumberOrNull(fields.taggedInstrumentId[0]));
//                     args.taggedSongId = fields.taggedSongId && db3.xSong.parseIdentity(fields.taggedSongId[0]);
//                     args.taggedUserId = fields.taggedUserId && db3.xUser.parseIdentity(fields.taggedUserId[0]);
//                     args.taggedWikiPageId = fields.taggedWikiPageId && db3.xWikiPage.parseIdentity(fields.taggedWikiPageId[0]);
//                     args.visiblePermissionId = fields.visiblePermissionId && db3.xPermission.parseIdentity(
//                         fields.visiblePermissionId[0],
//                     );
//                     args.fileTagId = fields.fileTagId && db3.xBandFileTag.parseIdentity(
//                         fields.fileTagId[0],
//                     );
//
//                     const resolvedFileTagId = args.fileTagId === undefined
//                         ? undefined
//                         : await resolvePublicId(
//                             db3.xBandFileTag,
//                             args.fileTagId,
//                             auth,
//                             db,
//                         );
//                     const resolvedEventId = args.taggedEventId === undefined
//                         ? undefined
//                         : await resolvePublicId(db3.xEvent, args.taggedEventId, auth, db);
//                     const resolvedSongId = args.taggedSongId === undefined
//                         ? undefined
//                         : await resolvePublicId(db3.xSong, args.taggedSongId, auth, db);
//                     const resolvedUserId = args.taggedUserId === undefined
//                         ? undefined
//                         : await resolvePublicId(db3.xUser, args.taggedUserId, auth, db);
//                     const resolvedWikiPageId = args.taggedWikiPageId === undefined
//                         ? undefined
//                         : await resolvePublicId(db3.xWikiPage, args.taggedWikiPageId, auth, db);
//
//                     const visiblePermission = fields.visiblePermission && (CoerceToString(fields.visiblePermission[0]));
//
//                     // may need to perform lookup by name
//                     if (!args.visiblePermissionId && !IsNullOrWhitespace(visiblePermission)) {
//                         const permission = await db.permission.findFirst({
//                             where: { name: visiblePermission },
//                             select: { publicId: true },
//                         });
//                         if (!permission) throw new Error(`Unknown visibility permission '${visiblePermission}'.`);
//                         args.visiblePermissionId = db3.xPermission.parseIdentity(permission.publicId);
//                     }
//
//                     const resolvedVisibility = await resolvePublicForeignIds(
//                         db3.xFile,
//                         { visiblePermissionId: args.visiblePermissionId },
//                         auth,
//                         db,
//                     );
//                     const visiblePermissionId = resolvedVisibility.visiblePermissionId;
//
//                     if (fields.externalURI) {
//                         const sanitizedURI = CoerceToString(fields.externalURI[0]);
//                         if (isValidURL(sanitizedURI)) {
//                             args.externalURI = sanitizedURI;
//                         }
//                     }
//
//
//
//                     if (!files || Object.values(files).length < 1) {
//                         if (args.externalURI) {
//                             // you have uploaded a URI.
//                             const uri = new URL(args.externalURI);
//                             let leaf = uri.pathname.split("/").pop() || "";
//                             if (leaf.trim().length < 1) {
//                                 leaf = "(unknown)";
//                             }
//
//                             const fields = mutationCore.PrepareNewFileRecord({
//                                 humanReadableLeafName: leaf,
//                                 sizeBytes: null,
//                                 lastModifiedDate: new Date(), // no modified date possible here; it will be safer to just set it to today instead of unknown, so at least some temporal data is saved
//                                 uploadedByUserId: currentUserId,
//                                 visiblePermissionId: visiblePermissionId ?? null,
//                             }) as Record<string, any>; // because we're adding custom fields and i'm too lazy to create more types
//
//                             if (resolvedEventId) fields.taggedEvents = [resolvedEventId];
//                             if (args.taggedInstrumentId) fields.taggedInstruments = [args.taggedInstrumentId];
//                             if (resolvedFileTagId) fields.tags = [resolvedFileTagId];
//                             if (resolvedSongId) fields.taggedSongs = [resolvedSongId];
//                             if (resolvedUserId) fields.taggedUsers = [resolvedUserId];
//                             if (resolvedWikiPageId) fields.taggedWikiPages = [resolvedWikiPageId];
//                             if (args.externalURI) (fields as db3.FilePayloadMinimum).externalURI = args.externalURI;
//
//                             const newFile = await mutationCore.insertImpl(db3.xFile, fields, auth) as Prisma.FileGetPayload<{}>;
//
//                             responsePayload.files.push(toUploadedFile(newFile, currentUserPublicId));
//                         }
//                     }
//
//                     // each field can contain multiple files
//                     const promises = Object.values(files).map(async (field: PersistentFile) => {
//                         for (let iFile = 0; iFile < field.length; ++iFile) {
//                             const file = field[iFile];
//                             const oldpath = file.filepath; // temp location that formidable has saved it to. 'C:\Users\carl\AppData\Local\Temp\2e3b4218f38f5aedcf765f801'
//
//                             const fields = mutationCore.PrepareNewFileRecord({
//                                 humanReadableLeafName: file.originalFilename,
//                                 lastModifiedDate: file.lastModifiedDate,
//                                 sizeBytes: file.size,
//                                 uploadedByUserId: currentUserId,
//                                 visiblePermissionId: visiblePermissionId ?? null,
//                             }) as Record<string, any>; // because we're adding custom fields and i'm too lazy to create more types
//
//                             // generate a new unique filename given to the file. like a GUID. "2e3b4218f38f5aedcf765f801"
//                             // file.newFilename is already done for us, though it doesn't seem very secure. i want to avoid using sequential IDs to avoid scraping.
//                             // so generate a new guid.
//                             //const filename = nanoid();//file.newFilename;
//
//                             // keeping the extension is actually important for mime-type serving. or, save mime-type in db?
//                             //const extension = path.extname(file.originalFilename); // includes dot. ".pdf"
//                             //const leaf = `${filename}${extension?.length ? extension : ".bin"}`;
//
//                             // also we have some metadata...
//                             //const size = file.size; // sizeBytes seems to exist but is not populated afaik
//
//                             // relative to current working dir.
//                             const newpath = mutationCore.GetFileServerStoragePath(fields.storedLeafName);
//
//                             // workaround broken typing
//                             const mimeType = (mime as any).getType(file.originalFilename) as string | null; // requires a leaf only, for some reason explicitly fails on a full path.
//
//                             // const fields: Record<string, any> = { // similar to: Prisma.FileUncheckedCreateInput = {
//                             //     fileLeafName: file.originalFilename,
//                             //     uploadedAt: new Date(),
//                             //     uploadedByUserId: currentUser.id,
//                             //     description: "",
//                             //     storedLeafName: leaf,
//                             //     isDeleted: false,
//                             //     visiblePermissionId: args.visiblePermissionId,
//                             //     sizeBytes: size,
//                             //     mimeType,
//                             // }
//                             const allTags = await db.fileTag.findMany();
//                             const partitionTag = allTags.find(t => t.significance === db3.FileTagSignificance.Partition);
//                             const recordingTag = allTags.find(t => t.significance === db3.FileTagSignificance.Recording);
//
//                             // automatically tag some things.
//                             const tags = new Set<number>();
//                             if (resolvedFileTagId) tags.add(resolvedFileTagId);
//
//                             if (mimeType?.startsWith("audio/") && recordingTag) {
//                                 tags.add(recordingTag.id);
//                             }
//
//                             // if there's a song tag, and you're uploading files, VERY likely it's a partition or recording.
//                             // if the mime type is audio, mark it as recording.
//                             if (args.taggedSongId && (file.originalFilename as string).toLowerCase().endsWith(".pdf")) {
//                                 if (partitionTag) {
//                                     tags.add(partitionTag.id);
//
//                                     const allInstruments = await db.instrument.findMany();
//                                     const aaret = AutoAssignInstrumentPartition({
//                                         allInstruments,
//                                         fileLeafWithoutExtension: stripExtension(file.originalFilename),
//                                         getIdentity: instrument => instrument.id,
//                                     });
//                                     fields.taggedInstruments = aaret.matchingInstrumentIds;
//                                 }
//
//                             } else {
//                                 if (args.taggedInstrumentId) fields.taggedInstruments = [args.taggedInstrumentId];
//                             }
//
//                             if (resolvedEventId) fields.taggedEvents = [resolvedEventId];
//                             if (resolvedSongId) fields.taggedSongs = [resolvedSongId];
//                             if (resolvedUserId) fields.taggedUsers = [resolvedUserId];
//                             if (resolvedWikiPageId) fields.taggedWikiPages = [resolvedWikiPageId];
//                             fields.tags = [...tags];
//
//                             const newFile = await mutationCore.insertImpl(db3.xFile, fields, auth) as Prisma.FileGetPayload<{}>;
//
//                             await rename(oldpath, newpath);
//
//                             await mutationCore.PostProcessFile({ file: newFile });
//
//                             if (maxImageDimension !== undefined) {
//                                 const resizedFile = await mutationCore.ForkResizeImageImpl({
//                                     auth: authenticatedAuth,
//                                     parentFile: newFile,
//                                     maxImageDimension,
//                                 });
//                                 if (resizedFile !== null) {
//                                     responsePayload.files.push(toUploadedFile(resizedFile, currentUserPublicId));
//                                 } else {
//                                     responsePayload.files.push(toUploadedFile(newFile, currentUserPublicId));
//                                 }
//                             } else {
//                                 responsePayload.files.push(toUploadedFile(newFile, currentUserPublicId));
//                             }
//                         }
//                     });
//
//                     await Promise.all(promises);
//
//                     res.json(responsePayload);
//                     res.end(() => {
//                         resolve(undefined);
//                     });
//                 } catch (e) {
//                     debugger;
//                     responsePayload.errorMessage = e.message;
//                     responsePayload.isSuccess = false;
//                     res.writeHead(500);
//                     res.json(responsePayload);
//                     //res.write(`error`);
//                     res.end(() => {
//                         reject(undefined);
//                     });
//                 }
//             });
//         } else {
//             res.writeHead(200, { 'Content-Type': 'text/html' });
//             res.write('<form  method="post" enctype="multipart/form-data">');
//             res.write('<input type="file" multiple name="filestoupload"><br>');
//             res.write('<input type="submit">');
//             res.write('</form>');
//             res.end(() => {
//                 resolve(undefined);
//             });
//         }
//     }); // return new promise
// });
// MIGRATION_REFERENCE_END
