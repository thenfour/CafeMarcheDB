import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { CMServerAuthorization } from "@/src/auth/server/serverAuthorization";
import * as mime from "mime";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import send from "send";
import type { FilePublicId } from "shared/publicId";
import * as db3 from "src/core/db3/db3";
import * as mutationCore from "src/core/db3/server/db3mutationCore";
import { parsePublicId } from "shared/publicId";
import { z } from "zod";
import db from "db";
import { xCustomLinkFile } from "../shared/entities/customLink/customLinkFile";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryTable } from "./db3QueryCore";

type DownloadableFile = Pick<db3.FilePayloadMinimum,
    "fileLeafName" | "storedLeafName" | "isDeleted"
> & { publicId: FilePublicId };

const downloadableCustomLinkFile = z.object({
    publicId: z.string().transform(value => parsePublicId<"File">(value)),
    fileLeafName: z.string(), storedLeafName: z.string(), isDeleted: z.boolean(),
});

export async function GetAuthorizedCustomLinkFile(
    filePublicId: string,
    auth: CMServerAuthorization,
    database: DB3ReadDatabase = db,
): Promise<DownloadableFile | null> {
    return executeDB3Read(database, auth, async context => {
        if (!context.authorization.hasPermission(BandPermission.view_files)) {
            return null;
        }
        const result = await queryTable({
            table: xCustomLinkFile, filter: { publicIds: [parsePublicId<"File">(filePublicId)] },
            take: 1, orderBy: undefined, cmdbQueryContext: "custom link download",
        }, context.authorization, context);
        return result.items[0] ? downloadableCustomLinkFile.parse(result.items[0]) : null;
    });
}

export async function ServeAuthorizedCustomLinkFileDownload(
    req: IncomingMessage,
    res: ServerResponse,
    auth: CMServerAuthorization,
    filePublicId: string,
): Promise<void> {
    const file = await GetAuthorizedCustomLinkFile(filePublicId, auth);
    if (!file) {
        res.statusCode = 404;
        res.end();
        return;
    }
    await SendFileDownload(req, res, file);
}

export const GetAuthorizedDirectDownloadFile = async (
    storedLeafName: string,
    auth: CMServerAuthorization,
    database: DB3ReadDatabase = db,
): Promise<DownloadableFile | null> => {
    return executeDB3Read(database, auth, async context => {

        const result = await queryTable({
            table: xCustomLinkFile,
            filter: { items: [{ operator: "equals", field: "storedLeafName", value: storedLeafName }] },
            take: 1, orderBy: undefined, cmdbQueryContext: "direct file download",
        }, context.authorization, context);
        return result.items[0] ? downloadableCustomLinkFile.parse(result.items[0]) : null;
    });
};

export const SendFileDownload = (
    req: IncomingMessage,
    res: ServerResponse,
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
                    res.statusCode = (err as { statusCode?: number }).statusCode || 500; // send reports HTTP errors with an optional status code.
                    res.end();
                }
                reject(err);
            })
            .on("end", () => resolve())
            .pipe(res);
    });
};

export const ServeAuthorizedFileDownload = async (
    req: IncomingMessage,
    res: ServerResponse,
    auth: CMServerAuthorization,
    storedLeafName: string,
): Promise<void> => {
    const file = await GetAuthorizedDirectDownloadFile(storedLeafName, auth);
    if (!file) {
        // An absent file and an inaccessible file have the same response.
        res.statusCode = 404;
        res.end();
        return;
    }
    await SendFileDownload(req, res, file);
};
