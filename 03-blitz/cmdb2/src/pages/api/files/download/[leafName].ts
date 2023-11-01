// https://stackoverflow.com/questions/70490959/next-js-serving-static-files-that-are-not-included-in-the-build-or-source-code
// https://dev.to/victrexx2002/how-to-get-the-mime-type-of-a-file-in-nodejs-p6c
// https://www.reddit.com/r/node/comments/ecjsg6/how_to_determine_file_mime_type_without_a/
import { Ctx } from "@blitzjs/next";
import { AuthenticatedMiddlewareCtx } from 'blitz';
import db, { Prisma } from "db";
import fs from "fs";
import * as mime from 'mime';
import path from "path";
import { Permission } from "shared/permissions";
import { api } from "src/blitz-server";
import * as db3 from 'src/core/db3/db3';
import * as mutationCore from 'src/core/db3/server/db3mutationCore';

// on making blitz-integrated "raw" server API routes: https://blitzjs.com/docs/auth-server#api-routes
export default api(async (req, res, origCtx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            origCtx.session.$authorize(Permission.login);
            const ctx: AuthenticatedMiddlewareCtx = origCtx as any; // authorize ensures this.
            const currentUser = await mutationCore.getCurrentUserCore(ctx);
            const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: 'user', mode: 'primary' };

            const leafRaw = req.query.leafName;
            if (!leafRaw || (typeof (leafRaw) !== 'string')) {
                reject(`invalid file`);
                return;
            }
            const leaf = leafRaw as string;

            const fullpath = mutationCore.GetFileServerStoragePath(leaf || "");

            const { item } = await mutationCore.queryFirstImpl({
                clientIntention, ctx, schema: db3.xFile, filterModel: {
                    items: [{
                        operator: "equals",
                        field: "storedLeafName",
                        value: leaf,
                    }]
                }
            });

            if (!item) {
                reject(`file not found`);
                return;
            }

            // for some reason requires "as any" to workaround broken types.
            const contentType = (mime as any).getType(leaf); // requires a leaf only, for some reason explicitly fails on a full path.
            if (contentType) {
                res.setHeader("Content-Type", contentType);
            } else {
                res.setHeader("Content-Type", "application/octet-stream");
            }

            const fileStream = fs.createReadStream(fullpath);
            // content disposition "attachment" would prompt users to save the file instead of displaying in browser.
            res.setHeader("Content-Disposition", `inline; filename=${item.fileLeafName}`) // Specify the filename for download

            fileStream.pipe(res);
            fileStream.on("close", () => {
                res.end(() => {
                    resolve();
                });
            });
            fileStream.on("error", () => { // todo: one day test that this actually works?
                res.status(500).end(() => {
                    reject();
                });
            });

        } catch (e) {
            console.log(e);
            reject(`exception thrown: ${e}`);
        }
    }); // return new promise
});





