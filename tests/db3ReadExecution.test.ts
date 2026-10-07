import { afterEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";
import { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { bindDB3ReadSnapshot, executeDB3Read, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import * as readExecution from "src/core/db3/server/db3ReadExecution";
import { DB3PaginatedQueryCore, DB3QueryAuthorizationError, queryTable } from "src/core/db3/server/db3QueryCore";
import * as db3 from "src/core/db3/db3";

afterEach(() => { vi.restoreAllMocks(); });

describe("shared DB3 read execution", () => {
    it("allows ordinary SQL membership reads to request a snapshot without resolving strings in memory", async () => {
        const table = db3.xBandUser;
        expect(table.queryStrategy).toBeUndefined();
        expect(table.readConsistency).toBe("snapshot");
        const marker = new Error("Entered the membership snapshot");
        const execute = vi.spyOn(readExecution, "executeDB3Read").mockRejectedValue(marker);
        const authorization = new CMServerAuthorization(null, new ServerPermissionSet([]));
        const database = new PrismaClient();
        for (const query of [queryTable, DB3PaginatedQueryCore]) {
            const input: db3.PaginatedQueryRequestInput = {
                table: { tableID: table.tableID, tableName: table.tableName },
                filter: {}, cmdbQueryContext: "membership snapshot", orderBy: undefined, skip: 0, take: 1,
            };
            await expect(query(input, authorization, database)).rejects.toBe(marker);
        }
        expect(execute).toHaveBeenCalledTimes(2);
    });
    it("owns isolation and refreshes grants in the exact transaction used by readers", async () => {
        const root = new PrismaClient();
        const transaction: Prisma.TransactionClient = new PrismaClient();
        const authorization = new CMServerAuthorization(null, new ServerPermissionSet([]));
        const fresh = new CMServerAuthorization(null, new ServerPermissionSet([]));
        const refresh = vi.spyOn(authorization, "refresh").mockResolvedValue(fresh);
        // The test executes only the interactive overload, without connecting to a database.
        const run = vi.fn(async (read: (tx: Prisma.TransactionClient) => Promise<unknown>) => read(transaction));
        vi.spyOn(root, "$transaction").mockImplementation(run as unknown as PrismaClient["$transaction"]);
        const read = vi.fn(async context => {
            expect(context.database === transaction).toBe(true);
            expect(context.authorization === fresh).toBe(true);
            return "read";
        });

        expect(await executeDB3Read(root, authorization, read)).toBe("read");
        expect(run).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
        expect(refresh).toHaveBeenCalledOnce();
        expect(refresh.mock.calls[0]?.[0] === transaction).toBe(true);
        expect(read).toHaveBeenCalledOnce();
    });

    it("composes within an explicitly declared snapshot and rechecks fresh grants", async () => {
        const transaction: Prisma.TransactionClient = new PrismaClient();
        const authorization = new CMServerAuthorization(null, new ServerPermissionSet([]));
        const refresh = vi.spyOn(authorization, "refresh").mockResolvedValue(authorization);
        const context = await bindDB3ReadSnapshot(transaction, authorization, { isolationLevel: "Serializable" });
        expect(await executeDB3Read(context, authorization, async read => read.database)).toBe(transaction);
        expect(refresh).toHaveBeenCalledTimes(2);
        expect(refresh.mock.calls.every(([database]) => database === transaction)).toBe(true);
    });

    it("rejects an unbound transaction instead of relying on a caller's silent isolation obligation", async () => {
        const authorization = new CMServerAuthorization(null, new ServerPermissionSet([]));
        const read = vi.fn();
        // Simulate an unsafe JavaScript caller; the public TypeScript contract rejects this object.
        const transaction = {} as DB3ReadDatabase;
        await expect(executeDB3Read(transaction, authorization, read)).rejects.toThrow("root Prisma client or a DB3ReadContext");
        expect(read).not.toHaveBeenCalled();
    });

    it("owns a snapshot for resolved reads independently of band ownership", async () => {
        const table = db3.xUser;
        const originalStrategy = table.queryStrategy;
        const marker = new Error("Entered the snapshot owner");
        const execute = vi.spyOn(readExecution, "executeDB3Read").mockRejectedValue(marker);
        const authorization = new CMServerAuthorization(null, new ServerPermissionSet([]));
        const database = new PrismaClient();
        expect(table.bandScope).toBeUndefined();
        // Exercise the orchestration policy without executing the synthetic resolved query.
        table.queryStrategy = "resolved";
        try {
            for (const query of [queryTable, DB3PaginatedQueryCore]) {
                const input: db3.PaginatedQueryRequestInput = {
                    table: { tableID: table.tableID, tableName: table.tableName },
                    filter: {}, cmdbQueryContext: "resolved strategy", orderBy: undefined, skip: 0, take: 1,
                };
                await expect(query(input, authorization, database)).rejects.toBe(marker);
            }
            expect(execute).toHaveBeenCalledTimes(2);
        } finally {
            table.queryStrategy = originalStrategy;
        }
    });

    it("keeps a band-scoped SQL read outside the multi-read snapshot owner", async () => {
        const table = db3.xBandSongTag;
        const originalStrategy = table.queryStrategy;
        const execute = vi.spyOn(readExecution, "executeDB3Read").mockRejectedValue(new Error("Unexpected snapshot"));
        const authorization = new CMServerAuthorization(null, new ServerPermissionSet([]));
        const database = new PrismaClient();
        expect(table.bandScope).toBeDefined();
        table.queryStrategy = undefined;
        try {
            for (const query of [queryTable, DB3PaginatedQueryCore]) {
                const input: db3.PaginatedQueryRequestInput = {
                    table: { tableID: table.tableID, tableName: table.tableName },
                    filter: {}, cmdbQueryContext: "SQL strategy", orderBy: undefined, skip: 0, take: 1,
                };
                await expect(query(input, authorization, database)).rejects.toBeInstanceOf(DB3QueryAuthorizationError);
            }
            expect(execute).not.toHaveBeenCalled();
        } finally {
            table.queryStrategy = originalStrategy;
        }
    });
});
