import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { QuickSearchItemType } from "shared/quickFilter";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { insertImpl, updateImpl, deleteImpl } from "src/core/db3/server/db3mutationCore";
import {
    saveSetlistPlan, saveSetlistPlanInTransaction, listSetlistPlans,
    deleteSetlistPlan, deleteSetlistPlanInTransaction, reorderSetlistPlans, reorderSetlistPlansInTransaction,
} from "src/core/db3/server/setlistPlanPersistence";
import { xSetlistPlanGroup } from "src/core/db3/shared/schema/setlistPlan";
import type { SaveSetlistPlanArgs } from "src/core/db3/shared/setlistPlanApi";
import type { SetlistPlanAssociatedItem, SetlistPlanPayload } from "src/core/db3/shared/setlistPlanTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareEventAttendanceFixture(tx, fixture, [Permission.setlist_planner_access, Permission.view_songs,
        Permission.view_events_nonpublic, Permission.view_wiki_pages, Permission.view_users_basic_info, Permission.visibility_members]);
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const groups = await Promise.all([0, 1].map(sortOrder => tx.setlistPlanGroup.create({ data: {
        publicId: generatePublicId(), bandId: c.band.id, createdByUserId: c.person.id, name: `Group ${sortOrder}`, description: "", sortOrder,
    } })));
    const args: SaveSetlistPlanArgs = { bandPublicId: c.args.bandPublicId, plan: {
        publicId: null, name: "Concert preparation", description: "Notes", groupId: parsePublicId<"SetlistPlanGroup">(groups[0]!.publicId),
        visiblePermissionId: parsePublicId<"Permission">(visibility.publicId), payload: { version: 1, rows: [], columns: [], cells: [], notes: "Authored notes" },
    } };
    const save = (patch: Partial<SaveSetlistPlanArgs["plan"]> = {}) => saveSetlistPlanInTransaction(tx, c.auth, { ...args, plan: { ...args.plan, ...patch } });
    const read = async (userId: ReturnType<typeof parsePublicId<"User">> | null = null) => listSetlistPlans(
        await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" }), c.auth, { bandPublicId: args.bandPublicId, userId });
    return { ...c, groups, args, visibility, save, read };
}

function fixtureRoot(tx: Prisma.TransactionClient, database = tx) {
    return { $transaction: async <T>(work: (inner: Prisma.TransactionClient) => Promise<T>, policy: { isolationLevel: "Serializable" | "RepeatableRead" }) => {
        expect(policy.isolationLevel).toBe("Serializable");
        await tx.$executeRawUnsafe("SAVEPOINT setlist_plan_write");
        try {
            return await work(database);
        } catch (error) {
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT setlist_plan_write");
            throw error;
        } finally {
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT setlist_plan_write");
        }
    } };
}

async function captureState(tx: Prisma.TransactionClient) {
    return { plans: await tx.setlistPlan.findMany({ orderBy: { id: "asc" } }),
        groups: await tx.setlistPlanGroup.findMany({ orderBy: { id: "asc" } }), changes: await tx.change.findMany({ orderBy: { id: "asc" } }) };
}

type ReferencePosition = "rows" | "columns" | "rowLeds" | "columnLeds";
function payloadWithReference(position: ReferencePosition, reference: SetlistPlanAssociatedItem): SetlistPlanPayload {
    const payload: SetlistPlanPayload = { version: 1, rows: [], columns: [], cells: [] };
    if (position === "rows") {
        if (reference.itemType !== QuickSearchItemType.song) {
            throw new Error("Only song rows carry a reference.");
        }
        payload.rows = [{ rowId: "row", type: "song", songId: reference.id, isInterruption: false }];
    } else if (position === "columns") {
        payload.columns = [{ columnId: "column", name: "Column", associatedItem: reference }];
    } else {
        payload[position] = [{ ledId: "led", name: "LED", associatedItem: reference }];
    }
    return payload;
}

describe.skipIf(!settingsMysqlTestUrl)("Setlist Plan persistence on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const fixtureTest = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("creates, reads, moves and soft deletes with server metadata and audits", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const saved = await c.save();
        expect(saved).toMatchObject({ name: c.args.plan.name, createdByUserId: c.person.publicId, payload: c.args.plan.payload });
        expect(saved).not.toHaveProperty("id");
        expect(saved).not.toHaveProperty("bandId");
        const row = await tx.setlistPlan.findUniqueOrThrow({ where: { publicId: saved.publicId! } });
        expect(row).toMatchObject({ bandId: c.band.id, createdByUserId: c.person.id, groupId: c.groups[0]!.id });
        expect(await c.read()).toEqual([saved]);
        expect(await c.read(parsePublicId<"User">(c.person.publicId))).toEqual([saved]);
        expect(await c.read(generatePublicId<"User">())).toEqual([]);
        await tx.setlistPlan.update({ where: { id: row.id }, data: { sortOrder: 9 } });
        const renamed = await c.save({ publicId: saved.publicId, name: "Renamed" });
        expect(renamed.sortOrder).toBe(9);
        const moved = await c.save({ publicId: saved.publicId, groupId: parsePublicId<"SetlistPlanGroup">(c.groups[1]!.publicId) });
        expect(moved).toMatchObject({ publicId: saved.publicId, createdAt: saved.createdAt, createdByUserId: saved.createdByUserId, sortOrder: 0 });
        await deleteSetlistPlanInTransaction(tx, c.auth, { bandPublicId: c.args.bandPublicId, publicId: saved.publicId! });
        expect(await c.read()).toEqual([]);
        await expect(c.save({ publicId: saved.publicId })).rejects.toThrow();
        await expect(deleteSetlistPlanInTransaction(tx, c.auth, { bandPublicId: c.args.bandPublicId, publicId: saved.publicId! })).rejects.toThrow();
        expect(await tx.change.count({ where: { table: "SetlistPlan", recordId: row.id, userId: c.person.id } })).toBe(4);
    }));

    it("rejects missing scope, natural IDs and forged metadata before writing", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const before = await captureState(tx);
        for (const plan of [{ ...c.args.plan, id: 1 }, { ...c.args.plan, bandId: fixture.bands[1]!.id },
            { ...c.args.plan, createdByUserId: c.person.publicId }, { ...c.args.plan, createdAt: new Date() },
            { ...c.args.plan, sortOrder: 100 }, { ...c.args.plan, publicId: 1 }]) {
            // Invalid wire payloads deliberately cross the TypeScript boundary.
            await expect(saveSetlistPlan(fixtureRoot(tx), c.auth, { ...c.args, plan } as SaveSetlistPlanArgs)).rejects.toThrow();
        }
        // An unscoped request cannot fall back to the authorization's band.
        await expect(saveSetlistPlan(fixtureRoot(tx), c.auth, { plan: c.args.plan } as SaveSetlistPlanArgs)).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
    }));

    it("rejects cross-band plans, groups and visibility changes without partial writes", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const otherGroup = await tx.setlistPlanGroup.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Other", description: "" } });
        const otherPlan = await tx.setlistPlan.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, createdByUserId: c.person.id,
            name: "Other", description: "", payloadJson: JSON.stringify(c.args.plan.payload) } });
        const hidden = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_editors } });
        const before = await captureState(tx);
        await expect(c.save({ groupId: parsePublicId<"SetlistPlanGroup">(otherGroup.publicId) })).rejects.toThrow();
        await expect(c.save({ publicId: parsePublicId<"SetlistPlan">(otherPlan.publicId) })).rejects.toThrow();
        await expect(c.save({ visiblePermissionId: parsePublicId<"Permission">(hidden.publicId) })).rejects.toThrow();
        await expect(deleteSetlistPlanInTransaction(tx, c.auth, { bandPublicId: c.args.bandPublicId, publicId: parsePublicId<"SetlistPlan">(otherPlan.publicId) })).rejects.toThrow();
        expect(await c.read()).toEqual([]);
        expect(await captureState(tx)).toEqual(before);
    }));

    it("filters private and explicitly hidden plans, including owner rows", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const hidden = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_editors } });
        const own = await c.save({ visiblePermissionId: null });
        await tx.setlistPlan.createMany({ data: [
            { publicId: generatePublicId(), bandId: c.band.id, createdByUserId: c.person.id, visiblePermissionId: hidden.id },
            { publicId: generatePublicId(), bandId: c.band.id, createdByUserId: fixture.admin.id, visiblePermissionId: null },
        ].map(data => ({ ...data, name: "Hidden", description: "", payloadJson: "invalid payload must not deserialize" })) });
        expect(await c.read()).toEqual([own]);
    }));

    it("requires explicit scope and honors global planner grants only within it", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const otherBand = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        const otherAuth = await loadAuthorizationForUser(c.person, tx, otherBand);
        const platformAuth = await loadAuthorizationForUser(fixture.admin, tx, c.args.bandPublicId);
        const unscoped = await loadAuthorizationForUser(c.person, tx);
        const before = await captureState(tx);
        await expect(saveSetlistPlanInTransaction(tx, c.auth, { ...c.args, bandPublicId: otherBand })).rejects.toThrow();
        await expect(saveSetlistPlanInTransaction(tx, otherAuth, { ...c.args, bandPublicId: otherBand })).rejects.toThrow();
        await expect(saveSetlistPlanInTransaction(tx, unscoped, c.args)).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
        // Global roles may grant band capabilities, but they still require explicit scope.
        const platformPlan = await saveSetlistPlanInTransaction(tx, platformAuth, c.args);
        expect(await tx.setlistPlan.findUnique({ where: { publicId: platformPlan.publicId! } })).toMatchObject({ bandId: c.band.id, createdByUserId: fixture.admin.id });
    }));

    it("keeps shared plans and groups after author membership and account removal", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const author = await tx.user.create({ data: { publicId: generatePublicId(), name: "Former author", email: "former@test.invalid" } });
        const membership = await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: c.band.id, userId: author.id } });
        const saved = await c.save();
        await tx.setlistPlan.update({ where: { publicId: saved.publicId! }, data: { createdByUserId: author.id } });
        await tx.setlistPlanGroup.update({ where: { id: c.groups[0]!.id }, data: { createdByUserId: author.id } });
        await tx.bandUser.delete({ where: { id: membership.id } });
        expect((await c.read())[0]?.createdByUserId).toBe(author.publicId);
        await tx.user.delete({ where: { id: author.id } });
        expect((await c.read())[0]).toMatchObject({ publicId: saved.publicId, createdByUserId: null, payload: saved.payload });
        expect(await tx.setlistPlanGroup.findUnique({ where: { id: c.groups[0]!.id } })).toMatchObject({ createdByUserId: null });
        expect((await c.save({ publicId: saved.publicId, name: "Retained" })).createdByUserId).toBeNull();
    }));

    it.each(["grant", "membership", "role", "person", "band"] as const)("refreshes revoked %s authority for every entry point", revoked => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const saved = await c.save();
        if (revoked === "grant") {
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.setlist_planner_access } });
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        } else if (revoked === "membership") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        } else if (revoked === "role") {
            await tx.bandRole.update({ where: { id: c.role.id }, data: { isDeleted: true } });
        } else if (revoked === "person") {
            await tx.user.update({ where: { id: c.person.id }, data: { isDeleted: true } });
        } else {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        }
        const before = await captureState(tx);
        await expect(c.save({ publicId: saved.publicId })).rejects.toThrow();
        await expect(c.read()).rejects.toThrow();
        await expect(deleteSetlistPlanInTransaction(tx, c.auth, { bandPublicId: c.args.bandPublicId, publicId: saved.publicId! })).rejects.toThrow();
        await expect(reorderSetlistPlansInTransaction(tx, c.auth, { bandPublicId: c.args.bandPublicId, kind: "group",
            movingPublicId: parsePublicId<"SetlistPlanGroup">(c.groups[0]!.publicId), newPositionPublicId: parsePublicId<"SetlistPlanGroup">(c.groups[1]!.publicId),
            scopePublicIds: c.groups.map(group => parsePublicId<"SetlistPlanGroup">(group.publicId)) })).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
    }));

    it.each(["rows", "columns", "rowLeds", "columnLeds"] as const)("checks same-band song references in %s", position => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Tune", description: "", visiblePermissionId: c.visibility.id } });
        const payload = payloadWithReference(position, { itemType: QuickSearchItemType.song, id: parsePublicId<"Song">(song.publicId), name: "Cached tune" });
        expect((await c.save({ payload })).payload).toEqual(payload);
        await tx.song.update({ where: { id: song.id }, data: { bandId: fixture.bands[1]!.id } });
        const before = await captureState(tx);
        await expect(c.save({ payload })).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
    }));

    it.each(["event", "wikiPage", "user"] as const)("checks associated %s visibility and membership", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const wiki = await tx.wikiPage.create({ data: { publicId: generatePublicId(), bandId: c.band.id, slug: "fixture", visiblePermissionId: c.visibility.id } });
        const target = await tx.user.create({ data: { publicId: generatePublicId(), name: "Associated member", email: "associated@test.invalid" } });
        const targetMembership = await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: c.band.id, userId: target.id } });
        const reference: SetlistPlanAssociatedItem = kind === "event"
            ? { itemType: QuickSearchItemType.event, id: parsePublicId<"Event">(c.event.publicId), name: "Event" }
            : kind === "wikiPage" ? { itemType: QuickSearchItemType.wikiPage, id: parsePublicId<"WikiPage">(wiki.publicId), name: "Wiki" }
                : { itemType: QuickSearchItemType.user, id: parsePublicId<"User">(target.publicId), name: "Member" };
        const payload = payloadWithReference("columnLeds", reference);
        expect((await c.save({ payload })).payload).toEqual(payload);
        if (kind === "event") {
            await tx.event.update({ where: { id: c.event.id }, data: { bandId: fixture.bands[1]!.id } });
        } else if (kind === "wikiPage") {
            await tx.wikiPage.update({ where: { id: wiki.id }, data: { bandId: fixture.bands[1]!.id } });
        } else {
            await tx.bandUser.update({ where: { id: targetMembership.id }, data: { isDeleted: true } });
        }
        const before = await captureState(tx);
        await expect(c.save({ payload })).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
    }));

    it.each(["song", "deletedSong", "event", "deletedEvent", "wikiPage", "mergedUser"] as const)("rejects unavailable %s payload references", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const hidden = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_editors } });
        const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Hidden", description: "",
            visiblePermissionId: kind === "deletedSong" ? c.visibility.id : hidden.id, isDeleted: kind === "deletedSong" } });
        const wiki = await tx.wikiPage.create({ data: { publicId: generatePublicId(), bandId: c.band.id, slug: "hidden", visiblePermissionId: hidden.id } });
        await tx.event.update({ where: { id: c.event.id }, data: {
            visiblePermissionId: kind === "deletedEvent" ? c.visibility.id : hidden.id, isDeleted: kind === "deletedEvent",
        } });
        const merged = await tx.user.create({ data: { publicId: generatePublicId(), name: "Merged", email: "merged@test.invalid", mergedIntoUserId: c.person.id,
            bandUsersByUser: { create: { publicId: generatePublicId(), bandId: c.band.id } } } });
        const reference: SetlistPlanAssociatedItem = kind === "song" || kind === "deletedSong"
            ? { itemType: QuickSearchItemType.song, id: parsePublicId<"Song">(song.publicId), name: "Song" }
            : kind === "event" || kind === "deletedEvent" ? { itemType: QuickSearchItemType.event, id: parsePublicId<"Event">(c.event.publicId), name: "Event" }
                : kind === "wikiPage" ? { itemType: QuickSearchItemType.wikiPage, id: parsePublicId<"WikiPage">(wiki.publicId), name: "Wiki" }
                    : { itemType: QuickSearchItemType.user, id: parsePublicId<"User">(merged.publicId), name: "User" };
        const before = await captureState(tx);
        await expect(c.save({ payload: payloadWithReference("rowLeds", reference) })).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
    }));

    it("reorders exact declared scopes and rejects duplicate, missing, hidden or foreign rows", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const first = await c.save({ name: "First" });
        const second = await c.save({ name: "Second" });
        const ungrouped = await c.save({ name: "Ungrouped", groupId: null });
        const hidden = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_editors } });
        const hiddenPlan = await tx.setlistPlan.create({ data: { publicId: generatePublicId(), bandId: c.band.id, groupId: c.groups[0]!.id,
            name: "Hidden", description: "", payloadJson: "{}", visiblePermissionId: hidden.id } });
        const foreignPlan = await tx.setlistPlan.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id,
            name: "Foreign", description: "", payloadJson: "{}" } });
        const reorder = { bandPublicId: c.args.bandPublicId, kind: "plan" as const, groupId: c.args.plan.groupId!,
            movingPublicId: first.publicId!, newPositionPublicId: second.publicId!, scopePublicIds: [first.publicId!, second.publicId!] };
        await reorderSetlistPlansInTransaction(tx, c.auth, reorder);
        expect((await c.read()).filter(plan => plan.groupId === reorder.groupId).map(plan => plan.publicId)).toEqual([second.publicId, first.publicId]);
        const before = await captureState(tx);
        for (const target of [first.publicId!, generatePublicId<"SetlistPlan">(), ungrouped.publicId!,
            parsePublicId<"SetlistPlan">(hiddenPlan.publicId), parsePublicId<"SetlistPlan">(foreignPlan.publicId)]) {
            await expect(reorderSetlistPlansInTransaction(tx, c.auth, { ...reorder, newPositionPublicId: target, scopePublicIds: [first.publicId!, target] })).rejects.toThrow();
        }
        expect(await captureState(tx)).toEqual(before);
        await reorderSetlistPlansInTransaction(tx, c.auth, { bandPublicId: c.args.bandPublicId, kind: "group",
            movingPublicId: parsePublicId<"SetlistPlanGroup">(c.groups[0]!.publicId), newPositionPublicId: parsePublicId<"SetlistPlanGroup">(c.groups[1]!.publicId),
            scopePublicIds: c.groups.map(group => parsePublicId<"SetlistPlanGroup">(group.publicId)) });
        expect(await tx.setlistPlanGroup.findUnique({ where: { id: c.groups[0]!.id } })).toMatchObject({ sortOrder: 1 });
    }));

    it("runs scoped group CRUD with server ownership and preserves plans when a group is removed", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const group: Prisma.SetlistPlanGroupGetPayload<{}> = await insertImpl(xSetlistPlanGroup, { name: "Created", description: "", color: null }, c.auth, tx);
        expect(group).toMatchObject({ bandId: c.band.id, createdByUserId: c.person.id });
        await updateImpl(xSetlistPlanGroup, group.id, { name: "Renamed" }, c.auth, tx);
        const saved = await c.save({ groupId: parsePublicId<"SetlistPlanGroup">(group.publicId) });
        await deleteImpl(xSetlistPlanGroup, group.id, c.auth, "hard", tx);
        expect((await c.read()).find(plan => plan.publicId === saved.publicId)?.groupId).toBeNull();
        const otherAuth = await loadAuthorizationForUser(c.person, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        await expect(updateImpl(xSetlistPlanGroup, c.groups[0]!.id, { name: "Foreign" }, otherAuth, tx)).rejects.toThrow();
    }));

    it.each(["save", "delete", "reorder"] as const)("rolls back %s and audits together on audit failure", operation => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const saved = await c.save();
        const error = new Error("Injected audit failure");
        const failing = new Proxy(tx, { get(target, key) {
            if (typeof key === "string" && key.toLowerCase() === "change") {
                return new Proxy(Reflect.get(target, key), { get(delegate, method) {
                    if (method === "create") {
                        return async () => { throw error; };
                    }
                    return Reflect.get(delegate, method);
                } });
            }
            return Reflect.get(target, key);
        } });
        const root = fixtureRoot(tx, failing);
        const before = await captureState(tx);
        const work = operation === "save" ? saveSetlistPlan(root, c.auth, c.args)
            : operation === "delete" ? deleteSetlistPlan(root, c.auth, { bandPublicId: c.args.bandPublicId, publicId: saved.publicId! })
                : reorderSetlistPlans(root, c.auth, { bandPublicId: c.args.bandPublicId, kind: "group",
                    movingPublicId: parsePublicId<"SetlistPlanGroup">(c.groups[0]!.publicId), newPositionPublicId: parsePublicId<"SetlistPlanGroup">(c.groups[1]!.publicId),
                    scopePublicIds: c.groups.map(group => parsePublicId<"SetlistPlanGroup">(group.publicId)) });
        await expect(work).rejects.toThrow(error);
        expect(await captureState(tx)).toEqual(before);
    }));
});
