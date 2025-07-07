// https://stackoverflow.com/questions/70490959/next-js-serving-static-files-that-are-not-included-in-the-build-or-source-code
// https://dev.to/victrexx2002/how-to-get-the-mime-type-of-a-file-in-nodejs-p6c
// https://www.reddit.com/r/node/comments/ecjsg6/how_to_determine_file_mime_type_without_a/
import { Ctx } from "@blitzjs/next";
import send from 'send';
import * as mime from 'mime';
import { api } from "src/blitz-server";
import * as db3 from 'src/core/db3/db3';
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import path from 'node:path';

// on making blitz-integrated "raw" server API routes: https://blitzjs.com/docs/auth-server#api-routes
export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            let clientIntention: db3.xTableClientUsageContext | null = null;

            const currentUser = await mutationCore.getCurrentUserCore(ctx);
            clientIntention = { currentUser, intention: currentUser ? "user" : "public", mode: 'primary' };

            if (!req.query.leafName_slug) {
                reject(`invalid file`);
                return;
            }

            const [leafRaw, slug] = req.query.leafName_slug;
            if (!leafRaw || (typeof (leafRaw) !== 'string')) {
                reject(`invalid file`);
                return;
            }

            // const leafRaw = req.query.leafName;
            // if (!leafRaw || (typeof (leafRaw) !== 'string')) {
            //     reject(`invalid file`);
            //     return;
            // }
            const leaf = leafRaw as string;

            const fullpath = mutationCore.GetFileServerStoragePath(leaf || "");

            const { item } = await mutationCore.queryFirstImpl<db3.FilePayloadMinimum>({
                skipVisibilityCheck: true,
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

            // Set Content-Disposition header for proper filename handling
            const rawName = path.basename(item.fileLeafName);       // strip any path parts
            const safeName = encodeURIComponent(rawName)             // turn every odd byte into %XX
                .replace(/['()]/g, escape)            // RFC-5987 says these need extra love
                .replace(/\*/g, '%2A');               // *
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${safeName}"; filename*=UTF-8''${safeName}`
            );

            // Use send package to handle file streaming with range request support
            const uploadDirectory = path.dirname(fullpath);
            const filename = path.basename(fullpath);

            send(req, filename, {
                root: uploadDirectory,
                dotfiles: 'deny', // Security: don't serve hidden files
            })
                .on('error', (err) => {
                    console.error('Send error:', err);
                    if (!res.headersSent) {
                        res.status(500).end();
                    }
                    reject(err);
                })
                .on('end', () => {
                    resolve();
                })
                .pipe(res);

        } catch (e) {
            console.log(e);
            reject(`exception thrown: ${e}`);
        }
    }); // return new promise
});





