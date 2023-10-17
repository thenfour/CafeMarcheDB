// for mimetype db https://cdn.jsdelivr.net/gh/jshttp/mime-db@master/db.json

import formidable, { PersistentFile } from 'formidable';
import { api } from "src/blitz-server"
import { Ctx } from "@blitzjs/next";
import { TClientUploadFileArgs } from 'src/core/db3/shared/apiTypes';
import { CoerceToNumberOrNull, sleep } from 'shared/utils';
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import * as db3 from 'src/core/db3/db3';
import { AuthenticatedMiddlewareCtx } from 'blitz';
import { nanoid } from 'nanoid'
import * as mime from 'mime';

var path = require('path');
var fs = require('fs');
const util = require('util');
const rename = util.promisify(fs.rename);

// todo: fields for database integration
// todo: error handling, cancelling for example.

export const config = {
    api: {
        bodyParser: false,
    },
};

// on making blitz-integrated "raw" server API routes: https://blitzjs.com/docs/auth-server#api-routes
export default api(async (req, res, origCtx: Ctx) => {
    origCtx.session.$authorize(Permission.login);
    const ctx: AuthenticatedMiddlewareCtx = origCtx as any; // authorize ensures this.
    const currentUser = await mutationCore.getCurrentUserCore(ctx);

    return new Promise(async (resolve, reject) => {
        if (req.method == 'POST') {
            const form = formidable({});
            await form.parse(req, async (err, fields, files) => {
                try {
                    // fields comes across with keys corresponding to TClientUploadFileArgs
                    // except the values are arrays of string (length 1), rather than number.
                    const args: TClientUploadFileArgs = {};
                    args.taggedEventId = fields.taggedEventId && (CoerceToNumberOrNull(fields.taggedEventId[0]));
                    args.taggedInstrumentId = fields.taggedInstrumentId && (CoerceToNumberOrNull(fields.taggedInstrumentId[0]));
                    args.taggedSongId = fields.taggedSongId && (CoerceToNumberOrNull(fields.taggedSongId[0]));
                    args.taggedUserId = fields.taggedUserId && (CoerceToNumberOrNull(fields.taggedUserId[0]));
                    args.visiblePermissionId = fields.visiblePermissionId && (CoerceToNumberOrNull(fields.visiblePermissionId[0]));

                    const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: 'user', mode: 'primary' };

                    //await sleep(1000);

                    // each field can contain multiple files
                    Object.values(files).forEach(async (field: PersistentFile) => {
                        for (let iFile = 0; iFile < field.length; ++iFile) {
                            const file = field[iFile];
                            const oldpath = file.filepath; // temp location that formidable has saved it to. 'C:\Users\carl\AppData\Local\Temp\2e3b4218f38f5aedcf765f801'

                            // generate a new unique filename given to the file. like a GUID. "2e3b4218f38f5aedcf765f801"
                            // file.newFilename is already done for us, though it doesn't seem very secure. i want to avoid using sequential IDs to avoid scraping.
                            // so generate a new guid.
                            const filename = nanoid();//file.newFilename;

                            // keeping the extension is actually important for mime-type serving. or, save mime-type in db?
                            const extension = path.extname(file.originalFilename); // includes dot. ".pdf"
                            const leaf = `${filename}${extension?.length ? extension : ".bin"}`;

                            // also we have some metadata...
                            const size = file.size; // sizeBytes seems to exist but is not populated afaik

                            // relative to current working dir.
                            const newpath = path.resolve(`${process.env.FILE_UPLOAD_PATH}`, leaf);

                            const mimeType = mime.getType(file.originalFilename); // requires a leaf only, for some reason explicitly fails on a full path.

                            const fields: Prisma.FileUncheckedCreateInput = {
                                fileLeafName: file.originalFilename,
                                uploadedAt: new Date(),
                                uploadedByUserId: currentUser.id,
                                description: "",
                                storedLeafName: leaf,
                                isDeleted: false,
                                visiblePermissionId: args.visiblePermissionId,
                                sizeBytes: size,
                                mimeType,
                            }

                            if (args.taggedEventId) fields.taggedEvents = [args.taggedEventId];
                            if (args.taggedInstrumentId) fields.taggedInstruments = [args.taggedInstrumentId];
                            if (args.taggedSongId) fields.taggedSongs = [args.taggedSongId];
                            if (args.taggedUserId) fields.taggedUsers = [args.taggedUserId];

                            await mutationCore.insertImpl(db3.xFile, fields, ctx, clientIntention) as Prisma.FileGetPayload<{}>;

                            await rename(oldpath, newpath);
                        }
                    });
                    res.write(`Files uploaded successfully; cur user : ${ctx.session.$publicData.userId}`);
                    res.end(() => {
                        resolve(undefined);
                    });
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.write(`error`);
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

