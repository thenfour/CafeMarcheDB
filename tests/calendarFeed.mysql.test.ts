import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { resolveActiveCalendarFeedUser, saveCalendarFeedSubscription } from "src/auth/server/calendarFeedSubscription";
import { readCalendarFeedInTransaction } from "src/core/db3/server/calendarFeedRead";
import type { DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { CalExportCore, exportCalendarFeedForToken } from "src/core/db3/server/ical";
import { MakeICalEventUid } from "src/core/db3/shared/apiTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture as prepare, responseGrants } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const token = "a".repeat(64);

async function prepareFeed(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepare(tx, fixture, [...responseGrants, Permission.view_songs, Permission.view_wiki_pages, Permission.view_wiki_page_revisions]);
    await tx.user.update({ where: { id: c.person.id }, data: { uid: "stable-person-uid", calendarFeedToken: token } });
    // The outer fixture owns the real transaction; nested feed calls reuse its snapshot.
    const root: DB3ReadRootDatabase = { $transaction: async (work, options) => {
        expect(options.isolationLevel).toBe("RepeatableRead");
        return work(tx);
    } };
    const feed = () => exportCalendarFeedForToken(token, { type: "upcoming", bandPublicId: c.args.bandPublicId }, root);
    const read = (now?: Date) => readCalendarFeedInTransaction(tx, c.auth, { type: "upcoming", bandPublicId: c.args.bandPublicId }, now);
    return { ...c, root, feed, read };
}

describe.skipIf(!settingsMysqlTestUrl)("band-scoped personalized calendar feeds on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    beforeEach(() => { vi.stubEnv("CMDB_BASE_URL", "https://calendar.test.invalid"); });
    afterEach(() => { vi.unstubAllEnvs(); });
    afterAll(() => database.$disconnect());
    const fixtureTest = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("uses only the subscriber's selected-band answers, stable UIDs and combined revisions", () => fixtureTest(async (tx, fixture) => {
        const c = await prepareFeed(tx, fixture);
        const foreignMember = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: c.person.id } } });
        const response = await tx.eventUserResponse.create({ data: { publicId: generatePublicId(), bandUserId: c.member.id, eventId: c.event.id, revision: 3, isInvited: false } });
        await tx.eventUserResponse.create({ data: { publicId: generatePublicId(), bandUserId: foreignMember.id, eventId: c.event.id, revision: 98, isInvited: true } });
        await tx.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), bandUserId: foreignMember.id, eventSegmentId: c.event.segments[0]!.id, attendanceId: c.attendance.id } });
        await tx.userSetting.create({ data: { userId: c.person.id, name: "calendar.showUninvitedEvents", value: false } });
        expect((await c.feed()).calendar.events()).toHaveLength(0);
        await tx.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), bandUserId: c.member.id, eventSegmentId: c.event.segments[1]!.id, attendanceId: c.attendance.id } });
        await tx.eventAttendance.update({ where: { id: c.attendance.id }, data: { isDeleted: true, isActive: false } });
        const original = (await c.feed()).calendar;
        expect(original.events()).toHaveLength(2);
        expect(original.events().map(event => event.sequence())).toEqual([4, 4]);
        expect(original.events()[0]!.uid()).toBe(MakeICalEventUid(c.event.segments[0]!.uid!, "stable-person-uid"));
        expect(original.events()[0]!.summary()).toContain("\u{1F44D}");
        expect(original.events()[0]!.url()).toContain(`/backstage/event/${c.event.publicId}/`);
        expect(original.events()[0]!.url()).toContain(`bandPublicId=${c.args.bandPublicId}`);
        const snapshot = await c.read();
        expect(snapshot.events[0]!.responses).toEqual([{ revision: response.revision, isInvited: false }]);
        expect(snapshot.events[0]!.segments[0]!.responses).toEqual([]);
        await tx.event.update({ where: { id: c.event.id }, data: { publicId: generatePublicId(), revision: 7 } });
        const updated = (await c.feed()).calendar;
        expect(updated.events().map(event => event.uid())).toEqual(original.events().map(event => event.uid()));
        expect(updated.events().map(event => event.sequence())).toEqual([10, 10]);
        expect(updated.toString()).not.toContain(token);
    }));

    it("rechecks membership invitation groups, including hidden tags and stored false invitations", () => fixtureTest(async (tx, fixture) => {
        const c = await prepareFeed(tx, fixture);
        await tx.userSetting.create({ data: { userId: c.person.id, name: "calendar.showUninvitedEvents", value: false } });
        await tx.eventUserResponse.create({ data: { publicId: generatePublicId(), bandUserId: c.member.id, eventId: c.event.id, isInvited: false } });
        const tag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, isHidden: true } });
        await tx.event.update({ where: { id: c.event.id }, data: { expectedAttendanceUserTagId: tag.id } });
        const foreign = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: c.person.id } } });
        await tx.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserTagId: tag.id, bandUserId: foreign.id } });
        expect((await c.feed()).calendar.events()).toHaveLength(0);
        const assignment = await tx.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserTagId: tag.id, bandUserId: c.member.id } });
        const invited = (await c.feed()).calendar.events();
        expect(invited).toHaveLength(2);
        await tx.bandUserTagAssignment.delete({ where: { id: assignment.id } });
        expect((await c.feed()).calendar.events()).toHaveLength(0);
        await tx.eventUserResponse.updateMany({ where: { bandUserId: c.member.id }, data: { isInvited: true } });
        expect((await c.feed()).calendar.events().map(event => event.uid())).toEqual(invited.map(event => event.uid()));
    }));

    it("keeps bands' event content, calendar branding and subscriber locale separate", () => fixtureTest(async (tx, fixture) => {
        const c = await prepareFeed(tx, fixture);
        const otherBand = fixture.bands[1]!;
        await tx.bandUser.update({ where: { bandId_userId: { bandId: otherBand.id, userId: c.person.id } }, data: { bandRoleId: c.role.id } });
        const otherMember = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: otherBand.id, userId: c.person.id } } });
        await tx.bandUserSetting.create({ data: { bandUserId: otherMember.id, name: "calendar.locale", value: "fr-BE" } });
        for (const [index, band] of fixture.bands.entries()) {
            await tx.bandSetting.create({ data: { publicId: generatePublicId(), bandId: band.id, name: "ical.calendarName", value: `Band ${index + 1} agenda` } });
            await tx.bandSetting.create({ data: { publicId: generatePublicId(), bandId: band.id, name: "ical.calendarEventPrefix", value: `Band ${index + 1}: ` } });
        }
        const foreignEvent = await tx.event.create({ data: { publicId: generatePublicId(), bandId: otherBand.id, name: "Other concert", revision: 1,
            visiblePermissionId: c.event.visiblePermissionId, segments: { create: { publicId: generatePublicId(), name: "", description: "", startsAt: new Date("2099-01-02T12:00:00Z"), durationMillis: BigInt(3600000), isAllDay: false } } } });
        const first = await c.feed();
        const second = await exportCalendarFeedForToken(token, { type: "upcoming", bandPublicId: parsePublicId<"Band">(otherBand.publicId) }, c.root);
        expect(first.calendar.name()).toBe("Band 1 agenda");
        expect(first.calendar.prodId()).toContain("//EN");
        expect(first.calendar.events().every(event => event.summary().startsWith("Band 1: "))).toBe(true);
        expect(second.calendar.name()).toBe("Band 2 agenda");
        expect(second.calendar.prodId()).toContain("//FR");
        expect(second.calendar.events()).toHaveLength(1);
        expect(second.calendar.events()[0]!.summary()).toContain("Other concert");
        expect(first.actionContext).toEqual({ bandId: c.band.id, localeContextId: fixture.englishId });
        expect(second.actionContext).toEqual({ bandId: otherBand.id, localeContextId: fixture.frenchId });
        expect((await CalExportCore({ type: "event", eventUid: foreignEvent.uid!, currentUser: c.person, bandPublicId: c.args.bandPublicId }, c.root)).events()).toHaveLength(0);
    }));

    it("checks visibility and band ownership for embedded songs and wiki descriptions", () => fixtureTest(async (tx, fixture) => {
        const c = await prepareFeed(tx, fixture);
        const page = await tx.wikiPage.create({ data: { publicId: generatePublicId(), bandId: c.band.id, slug: "concert", visiblePermissionId: c.event.visiblePermissionId } });
        const revision = await tx.wikiPageRevision.create({ data: { publicId: generatePublicId(), wikiPageId: page.id, name: "Concert", content: "Visible wiki description" } });
        await tx.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: revision.id } });
        await tx.event.update({ where: { id: c.event.id }, data: { descriptionWikiPageId: page.id } });
        const list = await tx.eventSongList.create({ data: { publicId: generatePublicId(), eventId: c.event.id, name: "Setlist", description: "Set description" } });
        const songs = await Promise.all([
            { name: "Visible song", bandId: c.band.id, visiblePermissionId: c.event.visiblePermissionId, isDeleted: false },
            { name: "Private song", bandId: c.band.id, visiblePermissionId: null, isDeleted: false },
            { name: "Foreign song", bandId: fixture.bands[1]!.id, visiblePermissionId: c.event.visiblePermissionId, isDeleted: false },
            { name: "Deleted song", bandId: c.band.id, visiblePermissionId: c.event.visiblePermissionId, isDeleted: true },
        ].map(data => tx.song.create({ data: { ...data, publicId: generatePublicId(), description: "" } })));
        for (const [sortOrder, song] of songs.entries()) {
            await tx.eventSongListSong.create({ data: { publicId: generatePublicId(), eventSongListId: list.id, songId: song.id, sortOrder } });
        }
        await tx.eventSongListDivider.create({ data: { publicId: generatePublicId(), eventSongListId: list.id, subtitle: "Intermission", sortOrder: 2 } });
        const original = (await c.feed()).calendar.toString().replace(/\r\n /g, "");
        expect(original).toContain("Visible song");
        expect(original).toContain("Visible wiki description");
        expect(original).toContain("Intermission");
        for (const hidden of ["Private song", "Foreign song", "Deleted song"]) {
            expect(original).not.toContain(hidden);
        }
        const foreignPage = await tx.wikiPage.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, slug: "foreign" } });
        const foreignRevision = await tx.wikiPageRevision.create({ data: { publicId: generatePublicId(), wikiPageId: foreignPage.id, name: "Secret", content: "Foreign revision secret" } });
        await tx.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: foreignRevision.id } });
        expect((await c.feed()).calendar.toString()).not.toContain("Foreign revision secret");
        await tx.wikiPage.update({ where: { id: page.id }, data: { currentRevisionId: revision.id } });
        await tx.wikiPage.update({ where: { id: page.id }, data: { bandId: fixture.bands[1]!.id } });
        expect((await c.feed()).calendar.toString()).not.toContain("Visible wiki description");
        await tx.wikiPage.update({ where: { id: page.id }, data: { bandId: c.band.id, visiblePermissionId: null } });
        expect((await c.feed()).calendar.toString()).not.toContain("Visible wiki description");
        await tx.wikiPage.update({ where: { id: page.id }, data: { visiblePermissionId: c.event.visiblePermissionId } });
        const contentPermissions = await tx.permission.findMany({ where: { name: { in: [Permission.view_songs, Permission.view_wiki_page_revisions] } } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: { in: contentPermissions.map(permission => permission.id) } } });
        const revoked = (await c.feed()).calendar.toString().replace(/\r\n /g, "");
        expect(revoked).not.toContain("Visible song");
        expect(revoked).not.toContain("Visible wiki description");
    }));

    it("excludes private/deleted events and canceled segments while retaining retired status meaning", () => fixtureTest(async (tx, fixture) => {
        const c = await prepareFeed(tx, fixture);
        await tx.event.update({ where: { id: c.event.id }, data: { visiblePermissionId: null, createdByUserId: fixture.admin.id } });
        expect((await c.feed()).calendar.events()).toHaveLength(0);
        await tx.event.update({ where: { id: c.event.id }, data: { createdByUserId: c.person.id } });
        expect((await c.feed()).calendar.events()).toHaveLength(2);
        await tx.event.update({ where: { id: c.event.id }, data: { isDeleted: true } });
        expect((await c.feed()).calendar.events()).toHaveLength(0);
        await tx.event.update({ where: { id: c.event.id }, data: { isDeleted: false } });
        const strings = await Promise.all([0, 1].map(() => tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } })));
        const cancelled = await tx.eventStatus.create({ data: { publicId: generatePublicId(), significance: "Cancelled", isDeleted: true, nameId: strings[0]!.id, descriptionId: strings[1]!.id } });
        await tx.eventSegment.update({ where: { id: c.event.segments[0]!.id }, data: { statusId: cancelled.id } });
        expect((await c.feed()).calendar.events()).toHaveLength(1);
        await tx.event.update({ where: { id: c.event.id }, data: { statusId: cancelled.id } });
        expect((await c.feed()).calendar.events()).toHaveLength(0);
    }));

    it("anchors twelve-month history to the band's day and clamps leap day", () => fixtureTest(async (tx, fixture) => {
        const c = await prepareFeed(tx, fixture);
        await tx.bandSetting.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "dateTime.bandTimeZone", value: "Europe/Brussels" } });
        await tx.event.update({ where: { id: c.event.id }, data: { endDateTime: new Date("2023-02-27T23:00:00Z") } });
        expect((await c.read(new Date("2024-02-29T12:00:00Z"))).events).toHaveLength(1);
        await tx.event.update({ where: { id: c.event.id }, data: { endDateTime: new Date("2023-02-27T22:59:59Z") } });
        expect((await c.read(new Date("2024-02-29T12:00:00Z"))).events).toHaveLength(0);
        await tx.event.update({ where: { id: c.event.id }, data: { endDateTime: null } });
        expect((await c.read(new Date("2024-02-29T12:00:00Z"))).events).toHaveLength(1);
    }));

    it.each(["grant", "membership", "band", "account", "merged"])("rejects freshly revoked %s state despite previously loaded authority", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepareFeed(tx, fixture);
        expect((await c.feed()).calendar.events()).toHaveLength(2);
        if (kind === "grant") {
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_events_nonpublic } });
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        } else if (kind === "membership") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        } else if (kind === "band") {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: c.person.id }, data: kind === "merged" ? { mergedIntoUserId: fixture.admin.id } : { isDeleted: true } });
        }
        await expect(c.feed()).rejects.toThrow();
        await expect(c.read()).rejects.toThrow();
        await expect(saveCalendarFeedSubscription(tx, c.person.id, c.args.bandPublicId, "replace")).rejects.toThrow();
        expect((await tx.user.findUniqueOrThrow({ where: { id: c.person.id } })).calendarFeedToken).toBe(token);
        expect(await tx.change.count()).toBe(0);
    }));

    it("shares one account credential across band URLs and rotates it without leaking to the audit log", () => fixtureTest(async (tx, fixture) => {
        const c = await prepareFeed(tx, fixture);
        const otherBand = fixture.bands[1]!;
        const otherPublicId = parsePublicId<"Band">(otherBand.publicId);
        await tx.bandUser.update({ where: { bandId_userId: { bandId: otherBand.id, userId: c.person.id } }, data: { bandRoleId: c.role.id } });
        const first = await saveCalendarFeedSubscription(tx, c.person.id, c.args.bandPublicId, "existing");
        const second = await saveCalendarFeedSubscription(tx, c.person.id, otherPublicId, "existing");
        expect(first.subscriptionUrl).toContain(`${token}/upcoming?bandPublicId=${c.args.bandPublicId}`);
        expect(second.subscriptionUrl).toContain(`${token}/upcoming?bandPublicId=${otherPublicId}`);
        expect(await tx.change.count()).toBe(0);
        const replaced = await saveCalendarFeedSubscription(tx, c.person.id, otherPublicId, "replace");
        const replacement = (await tx.user.findUniqueOrThrow({ where: { id: c.person.id } })).calendarFeedToken!;
        expect(replacement).toMatch(/^[a-f0-9]{64}$/);
        expect(replaced.subscriptionUrl).toContain(replacement);
        expect(replacement).not.toBe(token);
        await expect(resolveActiveCalendarFeedUser(token, tx)).rejects.toThrow();
        expect((await exportCalendarFeedForToken(replacement, { type: "upcoming", bandPublicId: c.args.bandPublicId }, c.root)).calendar.events()).toHaveLength(2);
        const audit = await tx.change.findMany();
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({ context: "replaceCalendarFeedSubscription", userId: c.person.id, recordId: c.person.id });
        expect(JSON.stringify(audit)).not.toContain(token);
        expect(JSON.stringify(audit)).not.toContain(replacement);
        await tx.user.update({ where: { id: c.person.id }, data: { calendarFeedToken: null } });
        await saveCalendarFeedSubscription(tx, c.person.id, c.args.bandPublicId, "existing");
        const created = (await tx.user.findUniqueOrThrow({ where: { id: c.person.id } })).calendarFeedToken;
        await saveCalendarFeedSubscription(tx, c.person.id, c.args.bandPublicId, "existing");
        expect((await tx.user.findUniqueOrThrow({ where: { id: c.person.id } })).calendarFeedToken).toBe(created);
        expect(await tx.change.count()).toBe(2);
    }));

    it("requires membership even when a platform administrator has effective event grants", () => fixtureTest(async (tx, fixture) => {
        const c = await prepareFeed(tx, fixture);
        const auth = await loadAuthorizationForUser(fixture.admin, tx, c.args.bandPublicId);
        expect(auth.hasPermission(Permission.view_events_nonpublic)).toBe(true);
        await expect(readCalendarFeedInTransaction(tx, auth, { type: "upcoming", bandPublicId: c.args.bandPublicId })).rejects.toThrow("membership");
    }));
});
