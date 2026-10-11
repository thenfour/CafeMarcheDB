import { PrismaClient, type Prisma } from "@prisma/client";
import { NotFoundError } from "blitz";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readUserAccountAnalysisChoices, readUserMassAnalysis } from "src/core/db3/server/userMassAnalysisRead";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
async function read(tx: Prisma.TransactionClient, auth: CMServerAuthorization, personId: string,
    locale: { routeLocale?: string; browserLanguages?: string[] } = { routeLocale: "fr-BE" },
) {
    return readUserMassAnalysis(await snapshot(tx, auth), auth, parsePublicId<"User">(personId), locale);
}
async function localized(tx: Prisma.TransactionClient, localeId: number, value: string) {
    return tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: {
        publicId: generatePublicId(), localeId, indexedValue: value,
    } } } });
}

/** Each band has one of every original creator/participation dependency, including hidden and deleted rows. */
async function createDependencies(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    for (const band of fixture.bands) {
        const membership = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } } });
        const userId = fixture.user.id;
        const song = await tx.song.create({ data: { publicId: generatePublicId(), name: "Hidden song body", description: "Private song text",
            bandId: band.id, createdByUserId: userId, isDeleted: true } });
        const event = await tx.event.create({ data: { publicId: generatePublicId(), name: "Private event name", revision: 1,
            bandId: band.id, createdByUserId: userId, isDeleted: true } });
        const segment = await tx.eventSegment.create({ data: { publicId: generatePublicId(), eventId: event.id, name: "Private segment",
            description: "Private description", durationMillis: BigInt(0) } });
        const page = await tx.wikiPage.create({ data: { publicId: generatePublicId(), slug: "private-page", bandId: band.id, createdByUserId: userId } });
        await tx.wikiPageRevision.create({ data: { publicId: generatePublicId(), wikiPageId: page.id, name: "Private wiki name",
            content: "Private wiki content", createdByUserId: userId } });
        const file = await tx.file.create({ data: { publicId: generatePublicId(), fileLeafName: "Private file", storedLeafName: generatePublicId(),
            description: "Private file description", uploadedAt: new Date(), bandId: band.id, uploadedByUserId: userId, isDeleted: true } });
        await tx.frontpageGalleryItem.create({ data: { publicId: generatePublicId(), fileId: file.id, caption: "Private caption",
            displayParams: "{}", createdByUserId: userId, isDeleted: true } });
        const text = await localized(tx, fixture.englishId, "Private menu caption");
        await tx.menuLink.create({ data: { publicId: generatePublicId(), captionId: text.id, groupName: "", groupCssClass: "",
            itemCssClass: "", linkType: "ExternalURL", bandId: band.id, createdByUserId: userId } });
        await tx.customLink.create({ data: { publicId: generatePublicId(), slug: "private-link", name: "Private custom link",
            description: "Private description", redirectType: "Temporary", bandId: band.id, createdByUserId: userId } });
        const type = await tx.songCreditType.create({ data: { publicId: generatePublicId(), nameId: text.id, descriptionId: text.id, sortOrder: 0 } });
        await tx.songCredit.create({ data: { publicId: generatePublicId(), songId: song.id, userId, typeId: type.id, comment: "Private credit" } });
        await tx.setlistPlan.create({ data: { publicId: generatePublicId(), name: "Private plan", description: "Private plan text",
            payloadJson: "{}", bandId: band.id, createdByUserId: userId, isDeleted: true } });
        await tx.eventUserResponse.create({ data: { publicId: generatePublicId(), eventId: event.id, bandUserId: membership.id, userComment: "Private response" } });
        await tx.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), eventSegmentId: segment.id, bandUserId: membership.id } });
        await tx.fileUserTag.create({ data: { publicId: generatePublicId(), fileId: file.id, bandUserId: membership.id } });
        const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: band.id, isHidden: true } });
        const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id, functionalGroupId: group.id, isHidden: true } });
        await tx.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: membership.id, bandInstrumentId: instrument.id } });
        const tag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: band.id, isHidden: true } });
        await tx.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserId: membership.id, bandUserTagId: tag.id } });
        await tx.bandUserSetting.create({ data: { bandUserId: membership.id, name: "FixturePrivateSetting", value: "Private membership setting" } });
    }
    await tx.action.createMany({ data: ["2026-01-01", "2026-02-02"].map(date => ({ userId: fixture.user.id,
        createdAt: new Date(date), isClient: true, feature: "Private action feature", context: "Private action context" })) });
    await tx.session.create({ data: { userId: fixture.user.id, handle: generatePublicId(), hashedSessionToken: "Private session hash",
        antiCSRFToken: "Private csrf", expiresAt: new Date("2000-01-01") } });
    await tx.token.create({ data: { userId: fixture.user.id, hashedToken: generatePublicId(), type: "RESET_PASSWORD",
        sentTo: "Private token address", expiresAt: new Date("2000-01-01") } });
    await tx.change.create({ data: { userId: fixture.user.id, action: "update", context: "Private audit", operationId: generatePublicId(),
        table: "User", recordId: fixture.user.id, oldValues: "Private old values" } });
    await tx.userSignInMethod.createMany({ data: (["email", "google"] as const).map(type => ({ publicId: generatePublicId(), userId: fixture.user.id,
        type, identifier: generatePublicId() })) });
    await tx.userSetting.create({ data: { userId: fixture.user.id, name: "FixturePrivateSetting", value: "Private account setting" } });
}

describe.skipIf(!settingsMysqlTestUrl)("shared-account dependency inventory on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("counts all original categories across two memberships, including hidden/retired content, without disclosing its contents", () => run(async (tx, fixture) => {
        await createDependencies(tx, fixture);
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const admin = await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        await tx.bandUser.updateMany({ where: { userId: person.id, bandId: fixture.bands[1]!.id }, data: { isDeleted: true } });
        await tx.band.update({ where: { id: fixture.bands[1]!.id }, data: { isDeleted: true } });
        const changesBefore = await tx.change.count();
        const report = await read(tx, admin, person.publicId);
        expect(report.contentCounts).toEqual({ createdSongs: 2, createdEvents: 2, createdWikiPages: 2, createdGalleryItems: 2,
            uploadedFiles: 2, createdMenuLinks: 2, createdCustomLinks: 2, songCredits: 2, setlistPlans: 2, wikiPageRevisions: 2 });
        expect(report.participationCounts).toEqual({ eventResponses: 2, eventSegmentResponses: 2, taggedFiles: 2, instruments: 2, userTags: 2 });
        expect(report.systemCounts).toEqual({ actions: 2, sessions: 1, tokens: 1, changes: 1, signInMethods: 2, userSettings: 1 });
        expect(report.memberships).toHaveLength(2);
        expect(report.memberships.map(member => member.counts)).toEqual(Array(2).fill({ eventResponses: 1, eventSegmentResponses: 1,
            taggedFiles: 1, instruments: 1, userTags: 1, settings: 1 }));
        expect(report.memberships.find(member => member.bandPublicId === fixture.bands[1]!.publicId)).toMatchObject({ isDeleted: true, bandIsDeleted: true });
        expect(report.activityMetrics.lastActivityDate).toEqual(new Date("2026-02-02"));
        expect(report.activityMetrics.hasEverLoggedIn).toBe(true);
        expect(report.userInfo.hasGoogleIdentity).toBe(true);
        expect(report.riskAssessment.warnings.map(reason => reason.kind)).not.toContain("activeSessions");
        expect(JSON.stringify(report)).not.toMatch(/Private|hashed|identifier|csrf|"id":|"userId":|"bandId":/i);
        const another = await read(tx, admin, (await tx.user.findUniqueOrThrow({ where: { id: fixture.admin.id } })).publicId);
        expect(Object.values(another.contentCounts).every(count => count === 0)).toBe(true);
        expect(Object.values(another.participationCounts).every(count => count === 0)).toBe(true);
        expect(another.memberships).toEqual([]);
        expect(another.activityMetrics.daysSinceLastActivity).toBeNull();
        expect(await tx.change.count()).toBe(changesBefore);
    }));

    it("keeps inactive and merged targets inspectable and lists every account for comparison", () => run(async (tx, fixture) => {
        const admin = await loadAuthorizationForUser(fixture.admin, tx, null);
        const target = await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: true, mergedIntoUserId: fixture.admin.id, mergedAt: new Date("2026-03-01") } });
        const report = await read(tx, admin, target.publicId);
        expect(report.userInfo).toMatchObject({ isDeleted: true, mergedAt: new Date("2026-03-01"), mergedIntoUserId:
            (await tx.user.findUniqueOrThrow({ where: { id: fixture.admin.id } })).publicId });
        expect(report.riskAssessment).toMatchObject({ riskLevel: "high", safeToDelete: false, blockers: [{ kind: "merged" }] });
        const choices = await readUserAccountAnalysisChoices(await snapshot(tx, admin), admin);
        expect(choices.find(choice => choice.publicId === target.publicId)).toEqual({ publicId: target.publicId, name: target.name, email: target.email, isDeleted: true });
        expect(choices.some(choice => choice.publicId === report.userInfo.mergedIntoUserId)).toBe(true);
        await expect(read(tx, admin, generatePublicId())).rejects.toThrow(NotFoundError);
    }));

    it.each(["anonymous", "band manager", "revoked", "deleted", "merged"])("requires fresh platform Sysadmin authority: %s", reason => run(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(reason === "anonymous" ? null : reason === "band manager" ? fixture.user : fixture.admin,
            tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        if (reason === "revoked") {
            await tx.globalRolePermission.deleteMany({ where: { globalRoleId: auth.user!.globalRoleId!, permission: { name: Permission.sysadmin } } });
        }
        if (reason === "deleted") {
            await tx.user.update({ where: { id: fixture.admin.id }, data: { isDeleted: true } });
        }
        if (reason === "merged") {
            await tx.user.update({ where: { id: fixture.admin.id }, data: { mergedIntoUserId: fixture.user.id, mergedAt: new Date() } });
        }
        await expect(read(tx, auth, generatePublicId())).rejects.toThrow(/sysadmin|active user/);
        await expect(readUserAccountAnalysisChoices(await snapshot(tx, auth), auth)).rejects.toThrow(/sysadmin|active user/);
    }));

    it("lets a role-carried Sysadmin read reports and choices without account-management or selected-band authority", () => run(async (tx, fixture) => {
        const name = await localized(tx, fixture.englishId, "Report reader");
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.sysadmin } });
        const role = await tx.globalRole.create({ data: { publicId: generatePublicId(), nameId: name.id,
            permissions: { create: { publicId: generatePublicId(), permissionId: permission.id } } } });
        await tx.user.update({ where: { id: fixture.admin.id }, data: { globalRoleId: role.id } });
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        expect(auth.hasPermission(Permission.manage_global_users)).toBe(false);
        const target = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        expect((await read(tx, auth, target.publicId)).userInfo.publicId).toBe(target.publicId);
        expect((await readUserAccountAnalysisChoices(await snapshot(tx, auth), auth)).some(choice => choice.publicId === target.publicId)).toBe(true);
    }));

    it("uses real grants for risk instead of localized role names; ignores retired grants and counts only live sessions for warnings", () => run(async (tx, fixture) => {
        const admin = await loadAuthorizationForUser(fixture.admin, tx, null);
        const name = await localized(tx, fixture.frenchId, "Member");
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.sysadmin } });
        const role = await tx.globalRole.create({ data: { publicId: generatePublicId(), nameId: name.id,
            permissions: { create: { publicId: generatePublicId(), permissionId: permission.id } } } });
        const person = await tx.user.update({ where: { id: fixture.user.id }, data: { globalRoleId: role.id } });
        let report = await read(tx, admin, person.publicId);
        expect(report.userInfo).toMatchObject({ isSysAdmin: false, isProtectedAdministrator: true, globalRoleName: "Member" });
        expect(report.riskAssessment).toMatchObject({ riskLevel: "high", blockers: [{ kind: "sysadmin" }] });
        await tx.globalRole.update({ where: { id: role.id }, data: { isDeleted: true } });
        report = await read(tx, admin, person.publicId);
        expect(report.userInfo).toMatchObject({ globalRoleIsDeleted: true, isProtectedAdministrator: false });
        expect(report.riskAssessment.riskLevel).toBe("low");
        await tx.globalRole.update({ where: { id: role.id }, data: { isDeleted: false } });
        const management = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_global_users } });
        await tx.globalRolePermission.deleteMany({ where: { globalRoleId: role.id } });
        await tx.globalRolePermission.create({ data: { publicId: generatePublicId(), globalRoleId: role.id, permissionId: management.id } });
        expect((await read(tx, admin, person.publicId)).riskAssessment.warnings).toContainEqual({ kind: "globalRole", name: "Member" });
        await tx.permission.update({ where: { id: management.id }, data: { isDeleted: true } });
        report = await read(tx, admin, person.publicId);
        expect(report.userInfo.isProtectedAdministrator).toBe(false);
        expect(report.riskAssessment.riskLevel).toBe("low");
        await tx.user.update({ where: { id: person.id }, data: { isSysAdmin: true } });
        expect((await read(tx, admin, person.publicId)).riskAssessment.blockers).toContainEqual({ kind: "sysadmin" });
        await tx.user.update({ where: { id: person.id }, data: { isSysAdmin: false } });
        const bandManagement = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_events } });
        await tx.globalRolePermission.create({ data: { publicId: generatePublicId(), globalRoleId: role.id, permissionId: bandManagement.id } });
        expect((await read(tx, admin, person.publicId)).riskAssessment.warnings).toContainEqual({ kind: "globalRole", name: "Member" });
        await tx.user.update({ where: { id: person.id }, data: { globalRoleId: null } });
        await tx.session.createMany({ data: [new Date("2000-01-01"), new Date("2099-01-01"), null].map(expiresAt => ({ userId: person.id,
            handle: generatePublicId(), expiresAt })) });
        report = await read(tx, admin, person.publicId);
        expect(report.systemCounts.sessions).toBe(3);
        expect(report.riskAssessment.warnings).toEqual([{ kind: "activeSessions" }]);
    }));

    it("resolves labels in each membership's own band, retains blanks and ordered preferences, and gives the global role no band override", () => run(async (tx, fixture) => {
        const admin = await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        const name = await localized(tx, fixture.frenchId, "Global French");
        const role = await tx.globalRole.create({ data: { publicId: generatePublicId(), nameId: name.id } });
        const person = await tx.user.update({ where: { id: fixture.user.id }, data: { globalRoleId: role.id } });
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id,
            stringId: name.id, localeId: fixture.frenchId, indexedValue: "Wrong band role name" } });
        const membership = await tx.bandUser.findFirstOrThrow({ where: { userId: person.id, bandId: fixture.bands[0]!.id }, include: { bandRole: true } });
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), bandId: membership.bandId,
            stringId: membership.bandRole!.nameId, localeId: fixture.frenchId, indexedValue: "" } });
        await tx.bandRole.update({ where: { id: membership.bandRoleId! }, data: { isDeleted: true } });
        const band = await tx.band.findUniqueOrThrow({ where: { id: fixture.bands[1]!.id } });
        const translations: Array<[number, string]> = [[fixture.dutchId, "Dutch band"], [fixture.englishId, "English band"]];
        await tx.bandDynamicLocalizedStringValue.createMany({ data: translations.map(([localeId, value]) => ({
            publicId: generatePublicId(), bandId: band.id, stringId: band.nameId, localeId, indexedValue: value,
        })) });
        const first = await read(tx, admin, person.publicId, { browserLanguages: ["fr-BE", "nl-BE"] });
        const second = await read(tx, admin, person.publicId, { browserLanguages: ["fr-BE", "en-US"] });
        expect(first.userInfo.globalRoleName).toBe("Global French");
        expect(first.memberships.find(member => member.bandPublicId === fixture.bands[0]!.publicId)).toMatchObject({ roleName: "", roleIsDeleted: true });
        expect(first.memberships.find(member => member.bandPublicId === band.publicId)?.bandName).toBe("Dutch band");
        expect(second.memberships.find(member => member.bandPublicId === band.publicId)?.bandName).toBe("English band");
    }));
});
