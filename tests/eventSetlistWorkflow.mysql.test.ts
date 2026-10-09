import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { createCommandRowServices, type DB3CommandExecutionContext } from "src/core/db3/server/db3CommandCore";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { eventSongListSaveCommandHandler } from "src/core/db3/server/commands/eventSongListSaveCommand";
import { eventSongListDeleteCommandHandler, eventSongListReorderCommandHandler } from "src/core/db3/server/commands/eventSongListOperations";
import { saveEventSongListCommand, deleteEventSongListCommand, reorderEventSongListsCommand, eventSongListDetailView,
    xEventSongList, xEventSongListSong, xEventSongListDivider, type EventSongListMutationCommand } from "src/core/db3/db3";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareSongs } from "./support/songWorkflowMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepareSetlists(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareSongs(tx, fixture);
    const draft: EventSongListMutationCommand = {
        eventId: c.args.eventId, name: "First set", description: "Notes", isActuallyPlayed: true, isOrdered: true, sortOrder: 0,
        songs: [{ songId: c.target.songId, sortOrder: 0, subtitle: "Opening" },
            { songId: parsePublicId<"Song">(c.songs[1]!.publicId), sortOrder: 2, subtitle: "Closing" }],
        dividers: [{ sortOrder: 1, subtitle: "Intermission", isInterruption: true, isSong: false, color: "blue",
            subtitleIfSong: null, lengthSeconds: 600, textStyle: null }],
    };
    const context = async (): Promise<DB3CommandExecutionContext> => {
        const authorization = await c.auth.refresh(tx);
        return { authorization, transaction: tx, rowServices: createCommandRowServices(authorization, tx) };
    };
    const save = (value: EventSongListMutationCommand) => c.root.$transaction(async () =>
        eventSongListSaveCommandHandler.execute(saveEventSongListCommand.parseDto(value), await context()), { isolationLevel: "Serializable" });
    const remove = (publicId: ReturnType<typeof xEventSongList.parseIdentity>) => c.root.$transaction(async () =>
        eventSongListDeleteCommandHandler.execute(deleteEventSongListCommand.parseDto({ publicId }), await context()), { isolationLevel: "Serializable" });
    const read = async () => queryView({ view: eventSongListDetailView, bandPublicId: c.target.bandPublicId,
        filter: { tableParams: { eventId: c.args.eventId } }, cmdbQueryContext: "native setlist read",
    }, c.auth, await c.snapshot());
    return { ...c, draft, context, save, remove, read };
}

describe.skipIf(!settingsMysqlTestUrl)("restored event setlist editor on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(async () => { vi.stubEnv("CMDB_BASE_URL", "https://setlist.test.invalid"); await initializeAccessControl(database); }, 30_000);
    afterAll(async () => { vi.unstubAllEnvs(); await database.$disconnect(); });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("creates a parent with nested songs/dividers, updates/removes rows and cascades deletion", () => run(async (tx, fixture) => {
        const c = await prepareSetlists(tx, fixture);
        const created = await c.save(c.draft);
        const stored = await tx.eventSongList.findUniqueOrThrow({ where: { publicId: created.publicId }, include: { songs: true, dividers: true } });
        expect(stored.songs).toHaveLength(2);
        expect(stored.dividers).toHaveLength(1);
        expect((await c.read()).items[0]!.publicId).toBe(created.publicId);
        await c.save({ ...c.draft, publicId: created.publicId, name: "Updated", songs: [{
            publicId: xEventSongListSong.parseIdentity(stored.songs[0]!.publicId), songId: c.target.songId, sortOrder: 0, subtitle: "New subtitle",
        }], dividers: [{ ...c.draft.dividers[0]!, publicId: xEventSongListDivider.parseIdentity(stored.dividers[0]!.publicId), subtitle: "Long break" }] });
        const updated = await tx.eventSongList.findUniqueOrThrow({ where: { id: stored.id }, include: { songs: true, dividers: true } });
        expect(updated).toMatchObject({ name: "Updated", songs: [{ subtitle: "New subtitle" }], dividers: [{ subtitle: "Long break" }] });
        expect(await tx.change.count({ where: { table: "EventSongList", recordId: stored.id } })).toBeGreaterThan(0);
        await c.remove(created.publicId);
        expect(await tx.eventSongListSong.count({ where: { eventSongListId: stored.id } })).toBe(0);
        expect(await tx.eventSongListDivider.count({ where: { eventSongListId: stored.id } })).toBe(0);
    }));

    it("reorders only the supplied event's lists and retains public targets", () => run(async (tx, fixture) => {
        const c = await prepareSetlists(tx, fixture);
        const first = await c.save(c.draft);
        const second = await c.save({ ...c.draft, name: "Second", sortOrder: 10, songs: [], dividers: [] });
        await c.root.$transaction(async () => eventSongListReorderCommandHandler.execute(reorderEventSongListsCommand.parseDto({
            eventId: c.args.eventId, movingItemId: first.publicId, newPositionItemId: second.publicId,
            scopeRowIds: [first.publicId, second.publicId],
        }), await c.context()), { isolationLevel: "Serializable" });
        expect((await tx.eventSongList.findMany({ where: { eventId: c.event.id }, orderBy: { sortOrder: "asc" } })).map(row => row.publicId))
            .toEqual([second.publicId, first.publicId]);
        const otherEvent = await tx.event.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Another event", revision: 1, visiblePermissionId: c.visibility.id } });
        const other = await tx.eventSongList.create({ data: { publicId: generatePublicId(), eventId: otherEvent.id, name: "Other event's list", description: "", sortOrder: 0 } });
        const otherId = xEventSongList.parseIdentity(other.publicId);
        await expect(c.root.$transaction(async () => eventSongListReorderCommandHandler.execute(reorderEventSongListsCommand.parseDto({
            eventId: c.args.eventId, movingItemId: first.publicId, newPositionItemId: otherId, scopeRowIds: [first.publicId, otherId],
        }), await c.context()), { isolationLevel: "Serializable" })).rejects.toThrow("scope");
        expect((await tx.eventSongList.findMany({ where: { eventId: c.event.id }, orderBy: { sortOrder: "asc" } })).map(row => row.publicId))
            .toEqual([second.publicId, first.publicId]);
    }));

    it("rejects foreign/private/deleted event and song targets without partial parents or audits", () => run(async (tx, fixture) => {
        const c = await prepareSetlists(tx, fixture);
        const changeCount = await tx.change.count();
        await expect(c.save({ ...c.draft, songs: [{ ...c.draft.songs[0]!, songId: parsePublicId<"Song">(c.foreign.publicId) }] })).rejects.toThrow();
        const event = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Foreign event", revision: 1, visiblePermissionId: c.visibility.id } });
        await expect(c.save({ ...c.draft, eventId: parsePublicId<"Event">(event.publicId) })).rejects.toThrow();
        for (const data of [{ visiblePermissionId: null, createdByUserId: fixture.admin.id }, { isDeleted: true }]) {
            await tx.song.update({ where: { id: c.songs[0]!.id }, data: { isDeleted: false, visiblePermissionId: c.visibility.id, ...data } });
            await expect(c.save(c.draft)).rejects.toThrow();
        }
        expect(await tx.eventSongList.count({ where: { eventId: c.event.id } })).toBe(0);
        expect(await tx.change.count()).toBe(changeCount);
    }));

    it("rejects foreign child IDs and leaves existing children and parent unchanged", () => run(async (tx, fixture) => {
        const c = await prepareSetlists(tx, fixture);
        const first = await c.save(c.draft);
        const other = await c.save({ ...c.draft, name: "Other", sortOrder: 10 });
        const child = await tx.eventSongListSong.findFirstOrThrow({ where: { eventSongList: { publicId: other.publicId } } });
        const changeCount = await tx.change.count();
        await expect(c.save({ ...c.draft, publicId: first.publicId, name: "Must roll back", songs: [{
            ...c.draft.songs[0]!, publicId: xEventSongListSong.parseIdentity(child.publicId),
        }] })).rejects.toThrow("does not belong");
        expect((await tx.eventSongList.findUniqueOrThrow({ where: { publicId: first.publicId }, include: { songs: true } })))
            .toMatchObject({ name: "First set", songs: [{}, {}] });
        expect(await tx.change.count()).toBe(changeCount);
    }));

    it("filters private/deleted parent lists and independently invisible songs from nested reads", () => run(async (tx, fixture) => {
        const c = await prepareSetlists(tx, fixture);
        await c.save(c.draft);
        await tx.song.update({ where: { id: c.songs[0]!.id }, data: { visiblePermissionId: null, createdByUserId: fixture.admin.id } });
        expect((await c.read()).items[0]!.songs).toHaveLength(1);
        for (const data of [{ visiblePermissionId: null, createdByUserId: fixture.admin.id }, { isDeleted: true }]) {
            await tx.event.update({ where: { id: c.event.id }, data: { isDeleted: false, visiblePermissionId: c.visibility.id, ...data } });
            await expect(c.read()).rejects.toThrow();
        }
    }));

    it.each(["normal", "revoked", "inactive", "roleless", "outsider", "anonymous", "foreign"])(
        "rejects %s setlist writes after refreshing scope", kind => run(async (tx, fixture) => {
            const c = await prepareSetlists(tx, fixture);
            const created = await c.save(c.draft);
            if (kind === "normal" || kind === "revoked") {
                const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_events } });
                await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
            } else if (kind === "inactive" || kind === "roleless") {
                await tx.bandUser.update({ where: { id: c.member.id }, data: kind === "inactive" ? { isDeleted: true } : { bandRoleId: null } });
            }
            let auth = await c.auth.refresh(tx);
            if (kind === "outsider") {
                const person = await tx.user.create({ data: { publicId: generatePublicId(), name: "Outsider", email: "outside@setlist.test.invalid" } });
                auth = await loadAuthorizationForUser(person, tx, c.args.bandPublicId);
            } else if (kind === "anonymous") {
                auth = await loadAuthorizationForUser(null, tx, c.args.bandPublicId);
            } else if (kind === "foreign") {
                await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: c.role.id } });
                auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
            }
            const context: DB3CommandExecutionContext = { authorization: auth, transaction: tx, rowServices: createCommandRowServices(auth, tx) };
            await expect(c.root.$transaction(async () => eventSongListSaveCommandHandler.execute({ ...c.draft, publicId: created.publicId, name: "Denied" }, context), { isolationLevel: "Serializable" })).rejects.toThrow();
            await expect(c.root.$transaction(async () => eventSongListDeleteCommandHandler.execute({ publicId: created.publicId }, context), { isolationLevel: "Serializable" })).rejects.toThrow();
            expect((await tx.eventSongList.findUniqueOrThrow({ where: { publicId: created.publicId } })).name).toBe("First set");
        }),
    );
});
