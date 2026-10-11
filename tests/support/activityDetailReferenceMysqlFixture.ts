import type { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import { generatePublicId } from "src/server/publicId";
import { prepareActivityReport } from "./activityReportMysqlFixture";
import type { SettingsMysqlFixture } from "./settingsMysqlFixture";

export async function prepareActivityDetailReferences(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const report = await prepareActivityReport(tx, fixture);
    const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.view_files, Permission.setlist_planner_access] } } });
    await tx.bandRolePermission.createMany({ data: permissions.map(permission => ({ publicId: generatePublicId(), bandRoleId: report.role.id, permissionId: permission.id })) });
    const text = (english: string, french: string, format: "PlainText" | "Markdown" = "PlainText") => tx.dynamicLocalizedString.create({ data: {
        publicId: generatePublicId(), format, values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: english },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: french },
        ] },
    } });
    const name = await text("Global trumpet", "Trompette globale"), description = await text("", "", "Markdown");
    const group = await tx.globalInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: description.id, sortOrder: 0, color: "light_brown" } });
    const globalInstrument = await tx.globalInstrument.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: description.id, sortOrder: 0, functionalGroupId: group.id } });
    const bandGroup = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: report.band.id, globalFunctionalGroupId: group.id } });
    const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: report.band.id, functionalGroupId: bandGroup.id, globalInstrumentId: globalInstrument.id } });
    const attendanceCaption = await text("Going", "Présent"), creditName = await text("Composer", "Compositeur");
    const attendance = await tx.eventAttendance.create({ data: { publicId: generatePublicId(), buttonCaptionId: attendanceCaption.id,
        personalCaptionId: attendanceCaption.id, pastCaptionId: attendanceCaption.id, personalPastCaptionId: attendanceCaption.id,
        descriptionId: description.id, strength: 100, color: "light_green" } });
    const creditType = await tx.songCreditType.create({ data: { publicId: generatePublicId(), nameId: creditName.id, descriptionId: description.id, color: "light_blue" } });
    const event = await report.event("Reference event");
    const segment = await tx.eventSegment.create({ data: { publicId: generatePublicId(), eventId: event.id, name: "Sound check", description: "private segment description", durationMillis: BigInt(3_600_000), startsAt: new Date("2026-04-01T17:00:00Z") } });
    const setlist = await tx.eventSongList.create({ data: { publicId: generatePublicId(), eventId: event.id, name: "Main set", description: "private song list contents" } });
    const file = await tx.file.create({ data: { publicId: generatePublicId(), bandId: report.band.id, fileLeafName: "Score.pdf", storedLeafName: "secret-storage-leaf.pdf",
        externalURI: "https://private-download.invalid", description: "private file description", uploadedAt: new Date(), uploadedByUserId: fixture.admin.id, visiblePermissionId: report.publicPermission.id } });
    const gallery = await tx.frontpageGalleryItem.create({ data: { publicId: generatePublicId(), fileId: file.id, caption: "private gallery caption",
        displayParams: "private image configuration", createdByUserId: fixture.admin.id, visiblePermissionId: report.publicPermission.id } });
    const plan = await tx.setlistPlan.create({ data: { publicId: generatePublicId(), bandId: report.band.id, name: "Summer plan", description: "private plan description", payloadJson: "private plan contents",
        createdByUserId: fixture.admin.id, visiblePermissionId: report.publicPermission.id } });
    const actionFields = { fileId: file.id, eventSegmentId: segment.id, eventSongListId: setlist.id, frontpageGalleryItemId: gallery.id,
        setlistPlanId: plan.id, songCreditTypeId: creditType.id, attendanceId: attendance.id, bandInstrumentId: instrument.id };
    return { report, text, file, gallery, event, segment, setlist, plan, attendance, attendanceCaption, creditType, creditName, instrument, bandGroup, name, actionFields };
}
