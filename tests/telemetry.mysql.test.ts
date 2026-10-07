import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ActivityFeature, ZTRecordActionArgs } from "src/core/components/featureReports/activityTracking";
import { createActionRecord } from "src/core/db3/server/recordActionServer";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function seedAssociations(tx: Prisma.TransactionClient, bandId: number) {
    const name = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } });
    const description = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), format: "Markdown" } });
    const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId } });
    const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId, functionalGroupId: group.id } });
    const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId, name: "Tune", description: "", aliases: "" } });
    const event = await tx.event.create({ data: { publicId: generatePublicId(), bandId, name: "Concert", revision: 1 } });
    const segment = await tx.eventSegment.create({ data: { publicId: generatePublicId(), eventId: event.id,
        name: "First set", description: "", durationMillis: BigInt(0) } });
    const songList = await tx.eventSongList.create({ data: { publicId: generatePublicId(), eventId: event.id, name: "Programme", description: "" } });
    const file = await tx.file.create({ data: { publicId: generatePublicId(), bandId, fileLeafName: "score.pdf",
        storedLeafName: generatePublicId(), description: "", uploadedAt: new Date() } });
    const gallery = await tx.frontpageGalleryItem.create({ data: { publicId: generatePublicId(), fileId: file.id, caption: "Photo", displayParams: "{}" } });
    const wiki = await tx.wikiPage.create({ data: { publicId: generatePublicId(), bandId, slug: "programme" } });
    const link = await tx.customLink.create({ data: { publicId: generatePublicId(), bandId, name: "Scores", description: "", slug: "scores", redirectType: "Temporary" } });
    const menu = await tx.menuLink.create({ data: { publicId: generatePublicId(), bandId, captionId: name.id,
        groupName: "Music", groupCssClass: "", itemCssClass: "", linkType: "external" } });
    const plan = await tx.setlistPlan.create({ data: { publicId: generatePublicId(), bandId, name: "Draft", description: "", payloadJson: "{}" } });
    const credit = await tx.songCreditType.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: description.id } });
    const attendance = await tx.eventAttendance.create({ data: { publicId: generatePublicId(), descriptionId: description.id,
        buttonCaptionId: name.id, personalCaptionId: name.id, pastCaptionId: name.id, personalPastCaptionId: name.id, strength: 100 } });
    return {
        input: ZTRecordActionArgs.parse({ feature: ActivityFeature.song_view, songId: song.publicId, eventId: event.publicId,
            eventSegmentId: segment.publicId, eventSongListId: songList.publicId, fileId: file.publicId,
            frontpageGalleryItemId: gallery.publicId, wikiPageId: wiki.publicId, customLinkId: link.publicId,
            menuLinkId: menu.publicId, setlistPlanId: plan.publicId, bandInstrumentId: instrument.publicId,
            songCreditTypeId: credit.publicId, attendanceId: attendance.publicId }),
        expected: { songId: song.id, eventId: event.id, eventSegmentId: segment.id, eventSongListId: songList.id,
            fileId: file.id, frontpageGalleryItemId: gallery.id, wikiPageId: wiki.id, customLinkId: link.id,
            menuLinkId: menu.id, setlistPlanId: plan.id, bandInstrumentId: instrument.id },
        global: { songCreditTypeId: credit.id, attendanceId: attendance.id },
    };
}

describe.skipIf(!settingsMysqlTestUrl)("telemetry persistence on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasources: { db: { url: settingsMysqlTestUrl } } }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());

    it("persists every association with band and presentation locale context", () => withSettingsMysqlFixture(database!, async (tx, fixture) => {
        const resources = await seedAssociations(tx, fixture.bands[0]!.id);
        const context = { bandId: fixture.bands[0]!.id, localeContextId: fixture.frenchId };
        await createActionRecord({ ...resources.input, userId: fixture.user.id, isClient: true,
            deviceInfo: { language: "DE", locale: "DE-DE" } }, context, tx);
        expect(await tx.action.findFirstOrThrow()).toMatchObject({ ...resources.expected, ...resources.global, ...context,
            userId: fixture.user.id, language: "de", locale: "de-de" });
    }));

    it("omits all foreign-band associations including children of events and files", () => withSettingsMysqlFixture(database!, async (tx, fixture) => {
        const resources = await seedAssociations(tx, fixture.bands[1]!.id);
        await createActionRecord({ ...resources.input, isClient: true }, { bandId: fixture.bands[0]!.id, localeContextId: fixture.englishId }, tx);
        expect(await tx.action.findFirstOrThrow()).toMatchObject({
            ...Object.fromEntries(Object.keys(resources.expected).map(key => [key, null])),
            ...resources.global, bandId: fixture.bands[0]!.id,
        });
    }));

    it("retains valid references when one association belongs to a different band", () => withSettingsMysqlFixture(database!, async (tx, fixture) => {
        const first = await seedAssociations(tx, fixture.bands[0]!.id);
        const second = await seedAssociations(tx, fixture.bands[1]!.id);
        await createActionRecord({ ...first.input, eventSegmentId: second.input.eventSegmentId, isClient: true },
            { bandId: fixture.bands[0]!.id, localeContextId: null }, tx);
        expect(await tx.action.findFirstOrThrow()).toMatchObject({ ...first.expected, eventSegmentId: null });
    }));

    it("keeps platform context null and only resolves global catalog associations", () => withSettingsMysqlFixture(database!, async (tx, fixture) => {
        const resources = await seedAssociations(tx, fixture.bands[0]!.id);
        await createActionRecord({ ...resources.input, isClient: true }, { bandId: null, localeContextId: null }, tx);
        expect(await tx.action.findFirstOrThrow()).toMatchObject({ bandId: null, localeContextId: null,
            ...Object.fromEntries(Object.keys(resources.expected).map(key => [key, null])), ...resources.global });
    }));

    it("retains account-level server actions and calendar credential redaction", () => withSettingsMysqlFixture(database!, async (tx, fixture) => {
        await createActionRecord({ feature: ActivityFeature.login_google, userId: fixture.user.id, isClient: false,
            uri: "/api/ical/user/private-feed-token/upcoming" }, { bandId: null, localeContextId: null }, tx);
        expect(await tx.action.findFirstOrThrow()).toMatchObject({ userId: fixture.user.id, isClient: false,
            bandId: null, localeContextId: null, uri: "/api/ical/user/[calendarFeedToken]/upcoming" });
    }));
});
