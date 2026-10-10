import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { createAllDayRange } from "shared/time";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { loadDashboardData } from "src/core/db3/server/db3DashboardData";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { eventSearchView } from "src/core/db3/shared/entities/event/eventViews";
import { gEventRelevanceClass } from "src/core/db3/shared/eventRelevance";
import { hydrateDashboardData } from "src/core/db3/shared/references/dashboardData";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const hour = 3_600_000, day = 24 * hour, now = new Date("2026-10-10T12:00:00Z");
const at = (offset: number) => new Date(now.valueOf() + offset);
async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const bandPublicId = parsePublicId<"Band">(fixture.bands[0]!.publicId);
    const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
    const members = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const member = await tx.bandUser.findFirstOrThrow({ where: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } });
    const event = (data: Partial<Prisma.EventUncheckedCreateInput> = {}) => tx.event.create({ data: {
        publicId: generatePublicId(), bandId: fixture.bands[0]!.id, name: "Dashboard rehearsal", revision: 1,
        startsAt: at(-hour), durationMillis: BigInt(2 * hour), endDateTime: at(hour), isAllDay: false,
        visiblePermissionId: members.id, createdByUserId: fixture.admin.id, ...data,
    } });
    const read = async () => loadDashboardData(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, { bandPublicId, routeLocale: "fr-BE" });
    return { auth, bandPublicId, members, member, event, read };
}

describe.skipIf(!settingsMysqlTestUrl)("dashboard Event selection on migrated MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); });
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("retains pins, ongoing/upcoming/recent ranking, the five-card limit and public identities fetchable by the existing Event view", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const oldPin = await c.event({ startsAt: at(-10 * day), endDateTime: at(-9 * day), relevanceClassOverride: gEventRelevanceClass.Pinned });
        const futurePin = await c.event({ startsAt: at(30 * day), endDateTime: at(30 * day + hour), relevanceClassOverride: gEventRelevanceClass.Pinned });
        const ongoing = await c.event();
        const upcoming = await c.event({ startsAt: at(hour), endDateTime: at(2 * hour) });
        const recent = await c.event({ startsAt: at(-3 * hour), endDateTime: at(-2 * hour) });
        await c.event({ startsAt: at(8 * day), endDateTime: at(8 * day + hour) });
        await c.event({ startsAt: null, endDateTime: null });
        await c.event({ visiblePermissionId: null });
        await c.event({ isDeleted: true });
        await c.event({ bandId: fixture.bands[1]!.id });
        const dto = await c.read();
        expect(dto.relevantEventIds).toEqual([oldPin.publicId, futurePin.publicId, ongoing.publicId, upcoming.publicId, recent.publicId]);
        expect(dto).not.toHaveProperty("effectivePermissionIds"); expect(dto).not.toHaveProperty("referenceStore");
        const events = await queryView({ view: eventSearchView, bandPublicId: c.bandPublicId, routeLocale: "fr-BE",
            filter: { publicIds: dto.relevantEventIds }, cmdbQueryContext: "dashboard cards" }, c.auth, await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" }));
        expect(events.items.map(event => event.publicId).sort()).toEqual([...dto.relevantEventIds].sort());
        expect(events.items.every(event => !("id" in event))).toBe(true);
        expect(hydrateDashboardData(dto).relevantEventIds).toEqual(dto.relevantEventIds);
    }));
    it("keeps one ordinary future fallback alongside every selected pin and explicit TBD override", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const nearest = await c.event({ startsAt: at(9 * day), endDateTime: at(9 * day + hour) });
        await c.event({ startsAt: at(10 * day), endDateTime: at(10 * day + hour) });
        const pin = await c.event({ startsAt: at(30 * day), endDateTime: at(30 * day + hour), relevanceClassOverride: gEventRelevanceClass.Pinned });
        expect((await c.read()).relevantEventIds).toEqual([pin.publicId, nearest.publicId]);
        const tbd = await c.event({ startsAt: null, endDateTime: null, relevanceClassOverride: gEventRelevanceClass.TBD });
        expect((await c.read()).relevantEventIds).toEqual([pin.publicId, tbd.publicId]);
    }));
    it("excludes hidden overrides before the twenty-candidate cap and retains private creator visibility", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        for (let index = 0; index < 25; ++index) {
            await c.event({ relevanceClassOverride: gEventRelevanceClass.Hidden });
        }
        const owned = await c.event({ visiblePermissionId: null, createdByUserId: fixture.user.id });
        expect((await c.read()).relevantEventIds).toEqual([owned.publicId]);
    }));
    it("queries twenty candidates in reference proximity/override order with a stable public-identity tie break", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const publicIds: string[] = [];
        for (let index = 0; index < 25; ++index) {
            const publicId = `DashboardTie${String(index).padStart(4, "0")}`;
            await c.event({ publicId, relevanceClassOverride: gEventRelevanceClass.Pinned });
            publicIds.push(publicId);
        }
        const raw = vi.spyOn(tx, "$queryRaw");
        const dto = await c.read();
        expect(dto.relevantEventIds).toEqual(publicIds.slice(0, 5));
        expect(await raw.mock.results[0]!.value).toHaveLength(20);
    }));
    it("retains cancelled status meaning after retirement and allows explicit overrides without relying on a status catalog", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const status = await tx.eventStatus.create({ data: { publicId: generatePublicId(), isDeleted: true, significance: "Cancelled",
            name: { create: { publicId: generatePublicId() } }, description: { create: { publicId: generatePublicId(), format: "Markdown" } } } });
        await c.event({ statusId: status.id });
        const pinned = await c.event({ statusId: status.id, relevanceClassOverride: gEventRelevanceClass.Pinned });
        expect((await c.read()).relevantEventIds).toEqual([pinned.publicId]);
        await tx.event.deleteMany(); await tx.eventStatus.deleteMany();
        const event = await c.event();
        expect((await c.read()).relevantEventIds).toEqual([event.publicId]);
    }));
    it("uses exact elapsed seven-day/24-hour boundaries, including point events and subsecond instants", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const nextWeek = await c.event({ startsAt: at(7 * day), endDateTime: at(7 * day + hour) });
        await c.event({ startsAt: at(7 * day + 1), endDateTime: at(7 * day + hour + 1) });
        const point = await c.event({ startsAt: at(hour), endDateTime: at(hour), durationMillis: BigInt(0) });
        const recent = await c.event({ startsAt: at(-day - hour), endDateTime: at(-day) });
        await c.event({ startsAt: at(-day - hour - 1), endDateTime: at(-day - 1) });
        expect((await c.read()).relevantEventIds).toEqual([point.publicId, nextWeek.publicId, recent.publicId]);
    }));
    it("classifies canonical all-day UTC spans across Brussels DST", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
        const range = createAllDayRange({ startDate: "2026-10-25", endDateExclusive: "2026-10-26" }, "Europe/Brussels");
        expect(range.getDurationMillis()).toBe(25 * hour);
        const event = await c.event({ startsAt: range.getStartDateTime(), endDateTime: range.getEndDateTime(), durationMillis: BigInt(range.getDurationMillis()), isAllDay: true });
        expect((await c.read()).relevantEventIds).toEqual([event.publicId]);
    }));
    it.each(["nonpublic-grant", "member-visibility", "roleless", "outsider", "inactive-member", "deleted-person", "merged-person"] as const)(
        "refreshes %s before selecting or disclosing an Event identity", kind => run(async (tx, fixture) => {
            const c = await prepare(tx, fixture); await c.event();
            if (kind === "nonpublic-grant" || kind === "member-visibility") {
                const permission = await tx.permission.findUniqueOrThrow({ where: { name: kind === "nonpublic-grant" ? Permission.view_events_nonpublic : Permission.visibility_members } });
                await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.member.bandRoleId!, permissionId: permission.id } });
            }
            if (kind === "roleless") { await tx.bandUser.update({ where: { id: c.member.id }, data: { bandRoleId: null } }); }
            if (kind === "outsider") { await tx.bandUser.delete({ where: { id: c.member.id } }); }
            if (kind === "inactive-member") { await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } }); }
            if (kind === "deleted-person") { await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: true } }); }
            if (kind === "merged-person") { await tx.user.update({ where: { id: fixture.user.id }, data: { mergedIntoUserId: fixture.admin.id } }); }
            expect((await c.read()).relevantEventIds).toEqual([]);
        }));
    it("does not query Event data for anonymous, no-band or platform-only bootstrap", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture); await c.event();
        const raw = vi.spyOn(tx, "$queryRaw");
        for (const person of [null, fixture.user, fixture.admin]) {
            const auth = await loadAuthorizationForUser(person, tx);
            expect((await loadDashboardData(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, {})).relevantEventIds).toEqual([]);
        }
        const anonymous = await loadAuthorizationForUser(null, tx, c.bandPublicId);
        expect((await loadDashboardData(await bindDB3ReadSnapshot(tx, anonymous, { isolationLevel: "Serializable" }), anonymous, { bandPublicId: c.bandPublicId })).relevantEventIds).toEqual([]);
        expect(raw).not.toHaveBeenCalled();
    }));
    it("keeps shared-person contexts independent and permits selected-band platform authority without requiring membership", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const first = await c.event(), second = await c.event({ bandId: fixture.bands[1]!.id });
        expect((await c.read()).relevantEventIds).toEqual([first.publicId]);
        const otherBand = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        const auth = await loadAuthorizationForUser(fixture.user, tx, otherBand);
        const readOther = async () => loadDashboardData(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, { bandPublicId: otherBand, routeLocale: "nl-BE" });
        expect((await readOther()).relevantEventIds).toEqual([]);
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: c.member.bandRoleId } });
        expect((await readOther()).relevantEventIds).toEqual([second.publicId]);
        const platform = await loadAuthorizationForUser(fixture.admin, tx, otherBand);
        expect((await loadDashboardData(await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" }), platform, { bandPublicId: otherBand })).relevantEventIds).toEqual([second.publicId]);
    }));
    it("derives the limited-access notice from fresh membership role designations independently of the shared account", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        expect((await c.read()).hasLimitedAccess).toBe(false);
        await tx.bandRole.updateMany({ where: { isRoleForNewUsers: true }, data: { isRoleForNewUsers: false } });
        await tx.bandRole.update({ where: { id: c.member.bandRoleId! }, data: { isRoleForNewUsers: true } });
        expect((await c.read()).hasLimitedAccess).toBe(true);
        await tx.bandRole.update({ where: { id: c.member.bandRoleId! }, data: { isRoleForNewUsers: false, isDeleted: true } });
        expect((await c.read()).hasLimitedAccess).toBe(true);
        await tx.bandUser.update({ where: { id: c.member.id }, data: { bandRoleId: null } });
        expect((await c.read()).hasLimitedAccess).toBe(true);
        const platform = await loadAuthorizationForUser(fixture.admin, tx, c.bandPublicId);
        expect((await loadDashboardData(await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" }), platform, { bandPublicId: c.bandPublicId })).hasLimitedAccess).toBe(false);
    }));
    it("refreshes the global account designation outside a band and suppresses the notice for anonymous accounts", () => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.user, tx);
        const read = async () => loadDashboardData(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, {});
        expect((await read()).hasLimitedAccess).toBe(true);
        const role = await tx.globalRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } } } });
        await tx.user.update({ where: { id: fixture.user.id }, data: { globalRoleId: role.id } });
        expect((await read()).hasLimitedAccess).toBe(false);
        await tx.globalRole.updateMany({ data: { isRoleForNewUsers: false } });
        await tx.globalRole.update({ where: { id: role.id }, data: { isRoleForNewUsers: true } });
        expect((await read()).hasLimitedAccess).toBe(true);
        await tx.globalRole.update({ where: { id: role.id }, data: { isRoleForNewUsers: false, isDeleted: true } });
        expect((await read()).hasLimitedAccess).toBe(true);
        const anonymous = await loadAuthorizationForUser(null, tx);
        expect((await loadDashboardData(await bindDB3ReadSnapshot(tx, anonymous, { isolationLevel: "Serializable" }), anonymous, {})).hasLimitedAccess).toBe(false);
    }));
});
