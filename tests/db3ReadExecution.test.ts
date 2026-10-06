import { afterEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";
import { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { bindDB3ReadSnapshot, executeDB3Read, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";

afterEach(() => { vi.restoreAllMocks(); });

describe("shared DB3 read execution", () => {
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
});
