import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot, type DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { readPublicFeed } from "src/core/db3/server/publicFeed";
import type { PublicFeedInput } from "src/core/db3/shared/publicFeedInput";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { prepareEventAttendanceFixture } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareEventAttendanceFixture(tx, fixture, [Permission.view_events_nonpublic, Permission.view_files, Permission.visibility_members]);
    const publicVisibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_public } });
    const memberVisibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const makeEvent = (bandId: number, title: string, visiblePermissionId: number | null, frontpageVisible = true) => tx.event.create({ data: {
        publicId: generatePublicId(), bandId, name: "Unpublished internal name", revision: 1, frontpageVisible, visiblePermissionId,
        frontpageTitle: title, frontpageTitle_fr: "Français " + title, frontpageTitle_nl: "Nederlands " + title,
        frontpageDetails: "English details", frontpageDetails_fr: null, frontpageDetails_nl: "Nederlandse details",
        startsAt: new Date("2099-01-01T12:00:00Z"),
    } });
    const published = await makeEvent(c.band.id, "Published", publicVisibility.id);
    const memberEvent = await makeEvent(c.band.id, "Member", memberVisibility.id);
    await makeEvent(c.band.id, "Private", null);
    await makeEvent(c.band.id, "Unlisted", publicVisibility.id, false);
    const other = await makeEvent(fixture.bands[1]!.id, "Other band", publicVisibility.id);
    const makeFile = (bandId: number, visiblePermissionId: number | null) => tx.file.create({ data: {
        publicId: generatePublicId(), bandId, uploadedByUserId: fixture.admin.id, uploadedAt: new Date(),
        fileLeafName: "publication.png", storedLeafName: generatePublicId() + ".png", description: "Unpublished file description",
        visiblePermissionId, mimeType: "image/png", sizeBytes: 123, customData: JSON.stringify({ imageMetadata: { width: 600, height: 400 } }),
    } });
    const source = await makeFile(c.band.id, publicVisibility.id);
    const hiddenSource = await makeFile(c.band.id, null);
    const otherSource = await makeFile(fixture.bands[1]!.id, publicVisibility.id);
    const makeGallery = (fileId: number, sortOrder: number, visiblePermissionId: number | null) => tx.frontpageGalleryItem.create({ data: {
        publicId: generatePublicId(), fileId, sortOrder, visiblePermissionId, createdByUserId: fixture.admin.id,
        caption: "English caption", caption_fr: "", caption_nl: "Nederlands bijschrift", displayParams: "{}",
    } });
    const gallery = await makeGallery(source.id, 2, publicVisibility.id);
    const earlier = await makeGallery(source.id, 0, publicVisibility.id);
    const memberGallery = await makeGallery(source.id, 3, memberVisibility.id);
    await makeGallery(hiddenSource.id, 4, publicVisibility.id);
    await makeGallery(source.id, 5, null);
    const otherGallery = await makeGallery(otherSource.id, 0, publicVisibility.id);
    const input: PublicFeedInput = { bandPublicId: c.args.bandPublicId, routeLocale: "fr-BE", browserLanguages: ["nl-NL"] };
    const anonymous = await loadAuthorizationForUser(null, tx, input.bandPublicId);
    const read = async (patch: Partial<PublicFeedInput> = {}, auth = anonymous) => readPublicFeed(
        await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, { ...input, ...patch }, { baseURL: "https://publication.invalid" });
    return { ...c, input, anonymous, published, memberEvent, other, source, gallery, earlier, memberGallery, otherGallery, read };
}

describe.skipIf(!settingsMysqlTestUrl)("public publication on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(async () => {
        if (database) {
            await initializeAccessControl(database);
        }
    }, 30_000);
    afterAll(async () => { await database?.$disconnect(); });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => {
        if (!database) {
            throw new Error("A disposable publication database is required.");
        }
        return withSettingsMysqlFixture(database, work);
    };

    it("publishes only selected-band, listed, readable Events and independently readable Gallery/File pairs", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const feed = await c.read();
        expect(feed.agenda.map(item => item.id)).toEqual([c.published.publicId]);
        expect(feed.gallery.map(item => item.galleryItemId)).toEqual([c.earlier.publicId, c.gallery.publicId]);
        expect(feed.gallery.map(item => item.fileId)).toEqual([c.source.publicId, c.source.publicId]);
        expect(JSON.stringify(feed)).not.toMatch(/Unpublished|"(?:bandId|uploadedByUserId|createdByUserId|visiblePermissionId)":/);
        expect(feed.gallery[0]?.imageFileUri).toBe(`https://publication.invalid/api/files/download/${c.source.storedLeafName}?bandPublicId=${c.input.bandPublicId}&routeLocale=fr-BE`);
    }));
    it("resolves each field independently and keeps intentional French and Dutch blanks", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const french = await c.read();
        expect(french.agenda[0]).toMatchObject({ title: "Français Published", detailsMarkdown: "Nederlandse details" });
        expect(french.gallery[0]?.caption).toBe("");
        await tx.event.update({ where: { id: c.published.id }, data: { frontpageTitle_nl: "" } });
        expect((await c.read({ routeLocale: "nl-NL" })).agenda[0]?.title).toBe("");
        expect((await c.read({ routeLocale: "de-DE" })).agenda[0]?.title).toBe("");
    }));
    it("uses browser order when the route translation is missing and respects enabled band locales", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.bandLocale.deleteMany({ where: { bandId: c.band.id, localeId: fixture.frenchId } });
        expect((await c.read()).agenda[0]?.title).toBe("Nederlands Published");
        await tx.locale.update({ where: { id: fixture.dutchId }, data: { isDeleted: true } });
        expect((await c.read()).agenda[0]?.title).toBe("Published");
    }));
    it("gives members their readable preview while anonymous content stays public", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const member = await c.read({}, c.auth);
        expect(member.agenda.map(item => item.id)).toContain(c.memberEvent.publicId);
        expect(member.gallery.map(item => item.galleryItemId)).toContain(c.memberGallery.publicId);
        expect((await c.read()).agenda.map(item => item.id)).not.toContain(c.memberEvent.publicId);
    }));
    it("keeps second-band content independent and rejects a forged selected band", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const bandPublicId = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        await expect(c.read({ bandPublicId })).rejects.toThrow();
        const secondAuth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
        const feed = await c.read({ bandPublicId, routeLocale: "nl-NL" }, secondAuth);
        expect(feed.agenda.map(item => item.id)).toEqual([c.other.publicId]);
        expect(feed.agenda[0]?.title).toBe("Nederlands Other band");
        expect(feed.gallery.map(item => item.galleryItemId)).toEqual([c.otherGallery.publicId]);
    }));
    it("refreshes stale membership and account state before publication", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        expect((await c.read({}, c.auth)).agenda.map(item => item.id)).toEqual([c.published.publicId]);
        await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: true } });
        expect((await c.read({}, c.auth)).gallery.map(item => item.galleryItemId)).toEqual([c.earlier.publicId, c.gallery.publicId]);
    }));
    it("drops deleted Events, Gallery entries and source Files on the next read", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.event.update({ where: { id: c.published.id }, data: { isDeleted: true } });
        await tx.frontpageGalleryItem.update({ where: { id: c.earlier.id }, data: { isDeleted: true } });
        expect((await c.read()).gallery.map(item => item.galleryItemId)).toEqual([c.gallery.publicId]);
        await tx.file.update({ where: { id: c.source.id }, data: { isDeleted: true } });
        expect(await c.read()).toEqual({ agenda: [], gallery: [] });
    }));
    it("rejects a deleted selected band even when the caller retains earlier public authorization", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        await expect(c.read()).rejects.toThrow();
    }));
    it("retains epoch zero and puts undated Events after dated Events", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.event.update({ where: { id: c.published.id }, data: { startsAt: new Date(0) } });
        const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_public } });
        await tx.event.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "TBD", revision: 1,
            frontpageVisible: true, frontpageTitle: "TBD", visiblePermissionId: visibility.id } });
        const feed = await c.read();
        expect(feed.agenda[0]?.startsAt).toBe(0);
        expect(feed.agenda[1]?.startsAt).toBeNull();
    }));
    it("owns one RepeatableRead root snapshot for both content readers and locale availability", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const policies: string[] = [];
        const root: DB3ReadRootDatabase = { $transaction: async (work, options) => {
            policies.push(options.isolationLevel);
            return work(tx);
        } };
        await readPublicFeed(root, c.anonymous, c.input, { baseURL: "https://publication.invalid" });
        expect(policies).toEqual(["RepeatableRead"]);
    }));
});
