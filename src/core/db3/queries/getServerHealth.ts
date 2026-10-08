import { cmauthorize } from "@/src/auth/server/cmResolver";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { xFile, xUser } from "../db3";
import { FileStatResult, GetServerHealthResult, ServerHealthFileResult, TableStatsQueryRowRaw } from "../shared/apiTypes";
import path from "node:path";
import * as fsp from "node:fs/promises";

async function GetDirectoryInfo(directoryPath: string): Promise<FileStatResult[]> {
    try {
        // FILE_UPLOAD_PATH is deployment configuration and may be absolute.
        const normalizedPath = path.resolve(process.cwd(), directoryPath);
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
    cmauthorize(Permission.sysadmin),
    async (args: {}, ctx): Promise<GetServerHealthResult> => {
        try {
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
            // Intentional read-policy bypass: filesystem reconciliation must
            // report deleted and hidden File rows. This endpoint is restricted
            // to the protected sysadmin capability.
            const fileRows = await db.file.findMany({
                where: {
                    storedLeafName: { in: fileNames }
                },
                include: {
                    uploadedByUser: { select: { publicId: true } },
                },
            });
            const uploadsInfo: ServerHealthFileResult[] = uploadsDirInfo.map(di => {
                const f = fileRows.find(x => x.storedLeafName === di.fileName);
                return {
                    ...di,
                    fileId: f ? xFile.parseIdentity(f.publicId) : undefined,
                    leafName: f ? f.fileLeafName : undefined,
                    isDeleted: f ? f.isDeleted : undefined,
                    mimeType: f?.mimeType || undefined,
                    uploadedByUserId: f?.uploadedByUser ? xUser.parseIdentity(f.uploadedByUser.publicId) : undefined,
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
                    tableStatsQuery: dbTableStatsQuery,
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



