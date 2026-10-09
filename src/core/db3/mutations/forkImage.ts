import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { forkImage } from "../server/imageFork";
import { requireFileStorageDirectory } from "../server/fileStorage";
import { ForkImageParamsSchema } from "../shared/imageFork";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(ForkImageParamsSchema),
    async (args, ctx: Ctx) => {
        const authorization = await loadAuthorization(ctx.session, args.bandPublicId);
        authorization.requireUser().requirePermission(Permission.upload_files);
        return forkImage(db, authorization, args, requireFileStorageDirectory());
    },
);

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/db3/mutations/forkImage.ts:1-80
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: e66ed6ce65bc38fbc3f7dda41ba38a4dd13e73996572f7c62c5a02eb0317df5d
// MIGRATION_REFERENCE_BEGIN
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from 'blitz';
// import { Permission } from "shared/permissions";
// import * as mutationCore from 'src/core/db3/server/db3mutationCore';
// import * as db3 from 'src/core/db3/db3';
// import { ForkImageParams } from "../shared/fileTypes";
// import { loadAuthorization } from "src/auth/server/serverAuthorization";
//
// export default resolver.pipe(
//     resolver.authorize(Permission.upload_files),
//     async (args: ForkImageParams, ctx: AuthenticatedCtx) => {
//         const auth = (await loadAuthorization(ctx.session)).requireUser();
//         const newFile = await mutationCore.ForkImageImpl(args, auth);
//         return { publicId: db3.xFile.parseIdentity(newFile.publicId) };
//     },
// );
//
//
// // NOTE that you CAN make forks of forks, so hierarchy is not just 1 layer deep.
// // however the GUI should avoid this
//
// //var path = require('path');
// //var fs = require('fs');
// // const util = require('util');
// // const rename = util.promisify(fs.rename);
//
// // export const config = {
// //     api: {
// //         bodyParser: false,
// //     },
// // };
//
// // // on making blitz-integrated "raw" server API routes: https://blitzjs.com/docs/auth-server#api-routes
// // api(async (req, res, origCtx: Ctx) => {
// //     origCtx.session.$authorize(Permission.login);
// //     const ctx: AuthenticatedCtx = origCtx as any; // authorize ensures this.
//
// //     return new Promise(async (resolve, reject) => {
// //         if (req.method == 'POST') {
// //             const form = formidable({});
// //             await form.parse(req, async (err, fields, files) => {
// //                 try {
// //                     const params: ForkImageParams = {
// //                         parentFileLeaf: CoerceToString(fields.parentFileId),
// //                         outputType: validateStringOption(CoerceToString(fields.outputType), ImageFileFormatOptions),
// //                         editParams: {
// //                             cropBeginX01: CoerceToNumberOr(fields.cropBeginX01, 0),
// //                             cropBeginY01: CoerceToNumberOr(fields.cropBeginY01, 0),
// //                             cropEndX01: CoerceToNumberOr(fields.cropEndX01, 1),
// //                             cropEndY01: CoerceToNumberOr(fields.cropEndY01, 1),
// //                             newSizeFactor: CoerceToNumberOr(fields.newSizeFactor, 1),
// //                         },
// //                     };
//
// //                     const newFile = await mutationCore.ForkImageImpl(params, ctx);
//
// //                     res.write(JSON.stringify(newFile));
// //                     res.end(() => {
// //                         resolve(undefined);
// //                     });
// //                 } catch (e) {
// //                     res.writeHead(500, { 'Content-Type': 'text/html' });
// //                     res.write(`error`);
// //                     res.end(() => {
// //                         reject(undefined);
// //                     });
// //                 }
// //             });
// //         } else {
// //             res.writeHead(200, { 'Content-Type': 'text/html' });
// //             res.write('<form  method="post" enctype="multipart/form-data">');
// //             res.write('<input type="file" multiple name="filestoupload"><br>');
// //             res.write('<input type="submit">');
// //             res.write('</form>');
// //             res.end(() => {
// //                 resolve(undefined);
// //             });
// //         }
// //     }); // return new promise
// // });
// MIGRATION_REFERENCE_END
