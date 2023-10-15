import formidable, { PersistentFile } from 'formidable';
import { api } from "src/blitz-server"
import { Ctx } from "@blitzjs/next";
import { Permission } from "shared/permissions";

var path = require('path');
var fs = require('fs');
const util = require('util');
const rename = util.promisify(fs.rename);

// todo: upload token granting / authentication. how do i get access to blitz stuff here?
// todo: fields for database integration
// todo: error handling, cancelling for example.

export const config = {
    api: {
        bodyParser: false,
    },
};

// on making blitz-integrated "raw" server API routes: https://blitzjs.com/docs/auth-server#api-routes
export default api(async (req, res, ctx: Ctx) => {
    ctx.session.$authorize(Permission.login);

    return new Promise(async (resolve, reject) => {
        if (req.method == 'POST') {
            const form = formidable({});
            await form.parse(req, async (err, fields, files) => {
                try {
                    // each field can contain multiple files
                    Object.values(files).forEach(async (field: PersistentFile) => {
                        for (let iFile = 0; iFile < field.length; ++iFile) {
                            const file = field[iFile];
                            const oldpath = file.filepath; // temp location that formidable has saved it to. 'C:\Users\carl\AppData\Local\Temp\2e3b4218f38f5aedcf765f801'
                            const filename = file.newFilename; // a new unique filename given to the file. like a GUID. "2e3b4218f38f5aedcf765f801"
                            const extension = path.extname(file.originalFilename); // includes dot. ".pdf"
                            const leaf = `${filename}${extension?.length ? extension : ".bin"}`;
                            // also we have some metadata...
                            // .size

                            // relative to current working dir.
                            const newpath = path.resolve(`${process.env.FILE_UPLOAD_PATH}`, leaf);

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

