import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { FileStatResult, GetServerHealthResult, ServerHealthFileResult, TableStatsQueryRowRaw } from "../shared/apiTypes";

var fs = require('fs');
var path = require('path');
var fsp = require('fs/promises');

async function GetDirectoryInfo(relativePath: string) {
    try {
        const baseUploadsDir = path.join(process.cwd(), relativePath)
        //const requestedPath = path.join(baseUploadsDir, relativePath)
        const normalizedPath = path.normalize(baseUploadsDir)

        if (!normalizedPath.startsWith(baseUploadsDir)) {
            throw new Error('Invalid directory path')
        }

        // const normalizedPath = path.normalize(requestedPath)
        const files = await fsp.readdir(normalizedPath)
        const fileStats: FileStatResult[] = await Promise.all(
            files.map(async (fileName) => {
                const filePath = path.join(normalizedPath, fileName)
                const stats = await fsp.stat(filePath)
                const ret: FileStatResult = {
                    fileName,
                    size: stats.size,
                    modified: stats.mtime,
                    isDirectory: stats.isDirectory(),
                };
                return ret;
            })
        )
        return fileStats;
    } catch (error) {
        throw new Error(`Failed to read directory: ${error.message}`)
    }
};

export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async (args: {}, ctx: AuthenticatedCtx): Promise<GetServerHealthResult> => {
        try {
            const u = (await getCurrentUserCore(ctx))!;

            const dbTableStatsQuery = `
SELECT
	TABLE_NAME,
    TABLE_ROWS,
    INDEX_LENGTH,
    DATA_LENGTH
FROM 
    information_schema.tables
WHERE
    table_schema = '${process.env.DATABASE_SCHEMA}'
order by
	data_length desc
            `;

            const tableStats = await db.$queryRaw(Prisma.raw(dbTableStatsQuery)) as TableStatsQueryRowRaw[];

            const uploadsDirInfo = process.env.FILE_UPLOAD_PATH ? (await GetDirectoryInfo(process.env.FILE_UPLOAD_PATH)) : [];
            const fileNames = uploadsDirInfo.map(f => f.fileName);
            const fileRows = await db.file.findMany({
                where: {
                    storedLeafName: { in: fileNames }
                }
            });
            const uploadsInfo: ServerHealthFileResult[] = uploadsDirInfo.map(di => {
                const f = fileRows.find(x => x.storedLeafName === di.fileName);
                return {
                    ...di,
                    fileId: f ? f.id : undefined,
                    leafName: f ? f.fileLeafName : undefined,
                    isDeleted: f ? f.isDeleted : undefined,
                    mimeType: f?.mimeType || undefined,
                    uploadedByUserId: f?.uploadedByUserId || undefined,
                    uploadedAt: f ? f.uploadedAt : undefined,
                    externalURI: f?.externalURI || undefined,
                };
            });

            const result: GetServerHealthResult = {
                uploads: {
                    files: uploadsInfo,
                },
                env: process.env,
                database: {
                    tableStats: tableStats.map(r => ({
                        table_name: r.TABLE_NAME,
                        table_rows: new Number(r.TABLE_ROWS).valueOf(),
                        index_length: new Number(r.INDEX_LENGTH).valueOf(),
                        data_length: new Number(r.DATA_LENGTH).valueOf(),
                    }))
                }
            }
            return result;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



