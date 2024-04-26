import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from 'blitz';
import { Permission } from "shared/permissions";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { ForkImageParams } from 'src/core/db3/shared/apiTypes';


export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: ForkImageParams, ctx: AuthenticatedCtx) => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        //const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser, };

        const newFile = await mutationCore.ForkImageImpl(args, ctx);
        return newFile;
    },
);















// NOTE that you CAN make forks of forks, so hierarchy is not just 1 layer deep.
// however the GUI should avoid this

//var path = require('path');
//var fs = require('fs');
// const util = require('util');
// const rename = util.promisify(fs.rename);

// export const config = {
//     api: {
//         bodyParser: false,
//     },
// };

// // on making blitz-integrated "raw" server API routes: https://blitzjs.com/docs/auth-server#api-routes
// api(async (req, res, origCtx: Ctx) => {
//     origCtx.session.$authorize(Permission.login);
//     const ctx: AuthenticatedCtx = origCtx as any; // authorize ensures this.

//     return new Promise(async (resolve, reject) => {
//         if (req.method == 'POST') {
//             const form = formidable({});
//             await form.parse(req, async (err, fields, files) => {
//                 try {
//                     const params: ForkImageParams = {
//                         parentFileLeaf: CoerceToString(fields.parentFileId),
//                         outputType: validateStringOption(CoerceToString(fields.outputType), ImageFileFormatOptions),
//                         editParams: {
//                             cropBeginX01: CoerceToNumberOr(fields.cropBeginX01, 0),
//                             cropBeginY01: CoerceToNumberOr(fields.cropBeginY01, 0),
//                             cropEndX01: CoerceToNumberOr(fields.cropEndX01, 1),
//                             cropEndY01: CoerceToNumberOr(fields.cropEndY01, 1),
//                             newSizeFactor: CoerceToNumberOr(fields.newSizeFactor, 1),
//                         },
//                     };

//                     const newFile = await mutationCore.ForkImageImpl(params, ctx);

//                     res.write(JSON.stringify(newFile));
//                     res.end(() => {
//                         resolve(undefined);
//                     });
//                 } catch (e) {
//                     res.writeHead(500, { 'Content-Type': 'text/html' });
//                     res.write(`error`);
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

