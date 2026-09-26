import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
vi.mock("db", async () => {
    const actual = await vi.importActual<any>("@prisma/client");
    return { ...actual, default: {
        $transaction: vi.fn(),
        wikiPage: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
        wikiPageRevision: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    }};
});
vi.mock("@blitzjs/rpc", () => ({ resolver: {
    pipe: (...steps: any[]) => steps[steps.length - 1], authorize: vi.fn(), zod: vi.fn(),
}}));
vi.mock("src/core/db3/server/db3mutationCore", () => ({ getCurrentUserCore: async (ctx: any) => ({ id: ctx.session.userId, publicId: `TestUser${String(ctx.session.userId).padStart(8, "0")}` }) }));
vi.mock("src/core/db3/server/db3ReadPolicy", () => ({ GetAuthorizedTableReadWhere: async (args: any) => args.where ?? {} }));
vi.mock("src/core/db3/shared/db3Authorization", () => ({
    createDB3Authorization: () => ({}),
}));
vi.mock("src/auth/server/requestAuthorization", () => ({ loadAuthorization: async () => ({}) }));
vi.mock("src/core/db3/server/db3QueryCore", () => ({
    authorizeAndProjectViewDto: (_view: unknown, row: unknown) => row,
}));
vi.mock("src/core/db3/shared/db3Helpers", () => ({ GetDefaultVisibilityPermission: async () => ({ id: 1 }) }));
vi.mock("shared/activityLog", () => ({ ChangeAction: { insert: "insert" }, CreateChangeContext: vi.fn(), RegisterChange: vi.fn() }));
import db, { Prisma } from "db";
import acquire from "src/core/wiki/mutations/acquireLockOnWikiPage";
import save from "src/core/wiki/mutations/updateWikiPage";
import renew from "src/core/wiki/mutations/wikiRenewYourLock";
import release from "src/core/wiki/mutations/wikiReleaseYourLock";
import { GetWikiPageUpdatability, WikiPageApiPayload } from "src/core/wiki/shared/wikiUtils";
const mockDb = db as any;
const ctx = { session: { userId: 1 } } as any;
const now = new Date("2026-09-15T12:00:00Z");
const permissionPublicId = parsePublicId<"Permission">("WikiPermission01");
const page = (overrides = {}): WikiPageApiPayload => ({
    id: 1, slug: "test", namespace: null, visiblePermissionId: permissionPublicId, contentVersion: 5,
    lockId: "editor-a", lockedByUser: { publicId: parsePublicId<"User">("TestUser00000001"), name: "Editor" },
    lockAcquiredAt: now, lockExpiresAt: new Date(now.valueOf() + 900000),
    lastEditPingAt: new Date(now.valueOf() - 600000),
    currentRevision: { id: 9, name: "Title", content: "Saved", createdAt: now, createdByUser: { publicId: parsePublicId<"User">("TestUser00000001"), name: "Editor" } },
    ...overrides,
});
const args = { canonicalWikiPath: "test", baseRevisionId: 9, baseContentVersion: 5, lockId: "editor-a", title: "Title", content: "Draft" };
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    mockDb.$transaction.mockImplementation(async (work: any) => work(mockDb));
    mockDb.wikiPage.findFirst.mockResolvedValue(page());
    mockDb.wikiPage.update.mockImplementation(async ({ data }: any) => page({ ...data,
        contentVersion: data.contentVersion ? 6 : 5,
        lockedByUser: { publicId: parsePublicId<"User">("TestUser00000001"), name: "Editor" },
    }));
    mockDb.wikiPageRevision.findMany.mockResolvedValue([]);
    mockDb.wikiPageRevision.create.mockResolvedValue({ id: 10 });
});
afterEach(() => { vi.useRealTimers(); });
describe("wiki lease and content protection", () => {
    it("keeps a lease despite missing presence pings", () => {
        expect(GetWikiPageUpdatability({ currentPage: page(), currentUserId: parsePublicId<"User">("TestUser00000002"),
            userClientLockId: "editor-b", baseRevisionId: 9, baseContentVersion: 5 }).isLockConflict).toBe(true);
    });
    it("rejects stale content even when the revision ID is unchanged", async () => {
        const result = await save({ ...args, baseContentVersion: 4 }, ctx);
        expect(result.outcome).toBe("revisionConflict");
        expect(mockDb.wikiPageRevision.create).not.toHaveBeenCalled();
    });
    it.each([null, "editor-b"])("rejects a save without this editor's lock: %s", async lockId => {
        expect((await save({ ...args, lockId }, ctx)).outcome).toBe("lockConflict");
        expect(mockDb.wikiPage.update).not.toHaveBeenCalled();
    });
    it("rejects a save exactly at expiry", async () => {
        mockDb.wikiPage.findFirst.mockResolvedValue(page({ lockExpiresAt: now }));
        expect((await save(args, ctx)).outcome).toBe("lockConflict");
    });
    it("increments the version on a consolidated save", async () => {
        mockDb.wikiPageRevision.findMany.mockResolvedValue([{ id: 9, createdAt: now }]);
        mockDb.wikiPageRevision.findFirst.mockResolvedValue(null);
        mockDb.wikiPageRevision.update.mockResolvedValue({ id: 9 });
        expect((await save(args, ctx)).outcome).toBe("success");
        expect(mockDb.wikiPage.update.mock.calls[0][0].data.contentVersion).toEqual({ increment: 1 });
        expect(mockDb.wikiPageRevision.findMany.mock.calls[0][0].where.id).toBe(9);
    });
    it("returns the newly acquired ownership, including the page", async () => {
        mockDb.wikiPage.findFirst.mockResolvedValue(page({ lockExpiresAt: now }));
        const result = await acquire({ ...args, lockId: "new-editor" }, ctx);
        expect(result.isLockedInThisContext).toBe(true);
        expect(result.currentPage?.lockId).toBe("new-editor");
    });
    it("allows only an explicit takeover of the observed lock belonging to this user", async () => {
        expect((await acquire({ ...args, lockId: "new-editor" }, ctx)).outcome).toBe("lockConflict");
        expect((await acquire({ ...args, lockId: "new-editor", takeOverLockId: "old-editor" }, ctx)).outcome).toBe("lockConflict");
        expect((await acquire({ ...args, lockId: "new-editor", takeOverLockId: "editor-a" }, ctx)).outcome).toBe("success");
        expect((await acquire({ ...args, lockId: "new-editor", takeOverLockId: "editor-a" }, { session: { userId: 2 } } as any)).outcome).toBe("lockConflict");
    });
    it("rechecks the winner's ownership after a serialization conflict", async () => {
        mockDb.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "5.12" }));
        mockDb.wikiPage.findFirst.mockResolvedValue(page({ lockId: "winner", lockedByUser: { publicId: parsePublicId<"User">("TestUser00000002"), name: "Other" } }));
        expect((await acquire(args, ctx)).outcome).toBe("lockConflict");
        expect(mockDb.$transaction).toHaveBeenCalledTimes(2);
        expect(mockDb.$transaction.mock.calls[1][1].isolationLevel).toBe("Serializable");
        expect(mockDb.wikiPage.update).not.toHaveBeenCalled();
    });
    it("renewal requires an unexpired lease and reports lost ownership", async () => {
        mockDb.wikiPage.updateMany.mockResolvedValue({ count: 0 });
        expect(await renew(args, ctx)).toBe(false);
        expect(mockDb.wikiPage.updateMany.mock.calls[0][0].where.lockExpiresAt).toEqual({ gt: now });
    });
    it("release is harmless after takeover", async () => {
        mockDb.wikiPage.updateMany.mockResolvedValue({ count: 0 });
        await expect(release(args, ctx)).resolves.toBeUndefined();
        expect(mockDb.wikiPage.updateMany.mock.calls[0][0].where).toMatchObject({ lockId: "editor-a", lockedByUserId: 1 });
    });
});
