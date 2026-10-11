import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readUserAttendanceHistory } from "src/core/db3/server/eventAttendanceRead";
import { readUserWikiContributions } from "src/core/wiki/server/userWikiContributions";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture, responseGrants } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareEventAttendanceFixture(tx, fixture, [...responseGrants,
        Permission.view_users_basic_info, Permission.view_wiki_pages, Permission.view_wiki_page_revisions]);
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const createPage = async (slug: string, bandId = c.band.id, visiblePermissionId: number | null = visibility.id) => {
        const page = await tx.wikiPage.create({ data: { publicId: generatePublicId(), bandId, slug,
            createdByUserId: fixture.admin.id, visiblePermissionId } });
        await tx.wikiPageRevision.createMany({ data: ["2025-02-10T08:00:00Z", "2026-03-28T23:30:00Z"].map(createdAt => ({
            publicId: generatePublicId(), wikiPageId: page.id, name: slug, content: "Private revision body",
            createdByUserId: c.person.id, createdAt: new Date(createdAt),
        })) });
        return page;
    };
    const input = { bandPublicId: c.args.bandPublicId, userId: c.args.userId };
    const read = async () => readUserWikiContributions(await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" }), c.auth, input);
    return { ...c, visibility, createPage, input, contributions: read };
}

describe.skipIf(!settingsMysqlTestUrl)("profile analytics parity on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    beforeEach(() => { vi.stubEnv("CMDB_BASE_URL", "https://profile.test.invalid"); });
    afterEach(() => { vi.unstubAllEnvs(); });
    afterAll(() => database.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database, work);

    it("groups only the requested author's visible revisions and retains first/latest/count semantics", () => withFixture(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const zeta = await c.createPage("zeta");
        const alpha = await c.createPage("alpha");
        await c.createPage("private", c.band.id, null);
        await tx.wikiPageRevision.create({ data: { publicId: generatePublicId(), wikiPageId: alpha.id,
            name: "Other author", content: "Other person's content", createdByUserId: fixture.admin.id } });
        const result = await c.contributions();
        expect(result.wikiContributions.map(page => page.publicId)).toEqual([alpha.publicId, zeta.publicId]);
        expect(result.wikiContributions.every(page => page.revisions.length === 2)).toBe(true);
        expect(result.wikiContributions[0]!.revisions.map(revision => revision.createdAt.toISOString())).toEqual([
            "2026-03-28T23:30:00.000Z", "2025-02-10T08:00:00.000Z",
        ]);
        expect(JSON.stringify(result)).not.toMatch(/"(?:id|userId|bandId|wikiPageId|email|phone|content)":|Private revision body/);
    }));

    it("keeps identical slugs and the same person's contributions independent across two bands", () => withFixture(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const first = await c.createPage("handbook");
        const otherBand = fixture.bands[1]!;
        const second = await c.createPage("handbook", otherBand.id);
        expect((await c.contributions()).wikiContributions.map(page => page.publicId)).toEqual([first.publicId]);
        const input = { ...c.input, bandPublicId: parsePublicId<"Band">(otherBand.publicId) };
        const firstSnapshot = await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
        await expect(readUserWikiContributions(firstSnapshot, c.auth, input)).rejects.toThrow("selected band");
        await tx.bandUser.update({ where: { bandId_userId: { bandId: otherBand.id, userId: c.person.id } }, data: { bandRoleId: c.role.id } });
        const auth = await loadAuthorizationForUser(c.person, tx, input.bandPublicId);
        const result = await readUserWikiContributions(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, input);
        expect(result.wikiContributions.map(page => page.publicId)).toEqual([second.publicId]);
    }));

    it("rechecks Wiki revision grants and page visibility after a previously successful read", () => withFixture(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const page = await c.createPage("handbook");
        expect((await c.contributions()).wikiContributions).toHaveLength(1);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_wiki_page_revisions } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        await expect(c.contributions()).rejects.toThrow();
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: permission.id } });
        expect((await c.contributions()).wikiContributions).toHaveLength(1);
        await tx.wikiPage.update({ where: { id: page.id }, data: { visiblePermissionId: null } });
        expect((await c.contributions()).wikiContributions).toEqual([]);
        await tx.wikiPage.delete({ where: { id: page.id } });
        expect((await c.contributions()).wikiContributions).toEqual([]);
    }));

    it.each(["membership", "deleted", "merged"])("rejects a stale %s actor for both analytic readers", kind => withFixture(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.createPage("handbook");
        await c.contributions();
        if (kind === "membership") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: c.person.id }, data: kind === "deleted" ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
        }
        await expect(c.contributions()).rejects.toThrow();
        await expect(c.history()).rejects.toThrow();
    }));

    it("rejects a valid unknown person rather than returning every contributor", () => withFixture(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.createPage("handbook");
        const snapshot = await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
        await expect(readUserWikiContributions(snapshot, c.auth, { ...c.input, userId: generatePublicId<"User">() })).rejects.toThrow("User was not found");
    }));

    it("keeps attendance statistics membership-owned when the same person answers in both bands", () => withFixture(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.write({ comment: "First band", segmentResponses: c.answers });
        const otherBand = fixture.bands[1]!;
        const otherMember = await tx.bandUser.update({ where: { bandId_userId: { bandId: otherBand.id, userId: c.person.id } }, data: { bandRoleId: c.role.id } });
        const otherEvent = await tx.event.create({ data: { publicId: generatePublicId(), bandId: otherBand.id,
            name: "Second band", revision: 1, visiblePermissionId: c.visibility.id, startsAt: new Date("2099-01-01T12:00:00Z"),
            responses: { create: { publicId: generatePublicId(), bandUserId: otherMember.id, userComment: "Second band comment", isInvited: false } },
            segments: { create: { publicId: generatePublicId(), name: "Second set", description: "", durationMillis: BigInt(0),
                responses: { create: { publicId: generatePublicId(), bandUserId: otherMember.id, attendanceId: c.attendance.id } } } },
        } });
        expect((await c.history()).events.map(event => event.name)).toEqual(["Concert"]);
        const input = { ...c.input, bandPublicId: parsePublicId<"Band">(otherBand.publicId), take: 50 };
        const auth = await loadAuthorizationForUser(c.person, tx, input.bandPublicId);
        const result = await readUserAttendanceHistory(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, input);
        expect(result.events).toEqual([expect.objectContaining({ publicId: otherEvent.publicId, userComment: "Second band comment", isInvited: false })]);
        expect(result.events[0]!.segments[0]!.attendanceId).toBe(c.attendance.publicId);
    }));

    it("rechecks attendance read grants and returns only future Events for a member without answers", () => withFixture(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.event.update({ where: { id: c.event.id }, data: { startsAt: new Date("2000-01-01T12:00:00Z") } });
        await tx.event.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Future without answers",
            revision: 1, visiblePermissionId: c.visibility.id, startsAt: new Date("2099-01-01T12:00:00Z") } });
        expect((await c.history()).events.map(event => event.name)).toEqual(["Future without answers"]);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_events_nonpublic } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        await expect(c.history()).rejects.toThrow();
    }));
});
