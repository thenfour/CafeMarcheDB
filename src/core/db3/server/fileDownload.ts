import { Ctx } from "@blitzjs/next";
import { NextApiRequest, NextApiResponse } from "next";
import path from "node:path";
import send from "send";
import * as mime from "mime";
import * as db3 from "src/core/db3/db3";
import * as mutationCore from "src/core/db3/server/db3mutationCore";

type DownloadableFile = Pick<db3.FilePayloadMinimum,
    "fileLeafName" | "storedLeafName" | "isDeleted"
>;

export const GetAuthorizedDirectDownloadFile = async (
    storedLeafName: string,
    ctx: Ctx,
): Promise<db3.FilePayloadMinimum | null> => {

    const { item } = await mutationCore.queryFirstImpl<db3.FilePayloadMinimum>({
        ctx,
        schema: db3.xFile,
        filterModel: {
            items: [{
                operator: "equals",
                field: "storedLeafName",
                value: storedLeafName,
            }],
        },
    });
    return item;
};

export const SendFileDownload = (
    req: NextApiRequest,
    res: NextApiResponse,
    file: DownloadableFile,
): Promise<void> => {
    const fullpath = mutationCore.GetFileServerStoragePath(file.storedLeafName);
    const contentType = (mime as any).getType(file.storedLeafName);
    res.setHeader("Content-Type", contentType || "application/octet-stream");

    const rawName = path.basename(file.fileLeafName);
    const safeName = encodeURIComponent(rawName)
        .replace(/['()]/g, escape)
        .replace(/\*/g, "%2A");
    res.setHeader(
        "Content-Disposition",
        `inline; filename="${safeName}"; filename*=UTF-8''${safeName}`,
    );

    return new Promise((resolve, reject) => {
        // send retains conditional requests and byte-range streaming
        send(req, path.basename(fullpath), {
            root: path.dirname(fullpath),
            dotfiles: "deny",
        })
            .on("error", (err) => {
                console.error("Send error:", err);
                if (!res.headersSent) {
                    res.status((err as any).statusCode || 500).end();
                }
                reject(err);
            })
            .on("end", () => resolve())
            .pipe(res);
    });
};
