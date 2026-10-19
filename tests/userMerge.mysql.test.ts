import { Prisma, PrismaClient } from "@prisma/client";
import { SecurePassword } from "@blitzjs/auth/secure-password";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import * as activityLog from "src/auth/server/activityLog";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { prepareUserMerge } from "src/auth/server/userMerge/prepareUserMerge";
import { commitUserMerge, MERGE_REVIEW_CHANGED, MERGE_TRANSACTION_CONFLICT } from "src/auth/server/userMerge/commitUserMerge";
import { searchMergeCandidates, readMergeAccountAnalysis } from "src/auth/server/userMerge/readUserMerge";
import type { MergeAuthority } from "src/auth/server/userMerge/types";
import { findSignInUser } from "src/auth/server/signInMethods";
import { readUserMassAnalysis } from "src/core/db3/server/userMassAnalysisRead";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { userPublicId } from "./support/userFixtures";

const url = process.env.USER_MERGE_TEST_DATABASE_URL;
if (url && (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || !/^\/cmdb_merge_test_[a-f0-9]{16}$/.test(new URL(url).pathname))) {
    throw new Error("A disposable merge-test database is required.");
}
const db = new PrismaClient(url ? { datasourceUrl: url } : undefined);
const pair = { mainUserId: userPublicId(10), retiringUserId: userPublicId(20) };
const locale = { routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"] };
let authority: MergeAuthority;
let mainPassword: string;
let retiringPassword: string;
let bands: { id: number; publicId: string }[];

async function resetPrivateDatabase() {
    if (!url) {
        throw new Error("A disposable merge-test database is required.");
    }
    await db.$transaction(async tx => {
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
        try {
            for (const model of Prisma.dmmf.datamodel.models) {
                // Model/table names come from Prisma's fixed schema, never a request.
                await tx.$executeRawUnsafe("DELETE FROM \u0060" + (model.dbName || model.name) + "\u0060");
            }
        } finally {
            await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
        }
    });
}
async function seedAccounts() {
    await initializeAccessControl(db);
    const adminRole = await db.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } });
    const memberRole = await db.globalRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } } } });
    await db.user.createMany({ data: [
        { id: 1, publicId: userPublicId(1), name: "Operator", email: "operator@test.invalid", globalRoleId: adminRole.id },
        { id: 10, publicId: pair.mainUserId, name: "Main", email: "main-contact@test.invalid", phone: "", globalRoleId: memberRole.id, hashedPassword: mainPassword, calendarFeedToken: "a".repeat(64) },
        { id: 20, publicId: pair.retiringUserId, name: "Retiring", email: "retiring-contact@test.invalid", phone: "private phone", globalRoleId: memberRole.id, hashedPassword: retiringPassword, calendarFeedToken: "b".repeat(64) },
    ] });
    bands = [];
    const locales = await db.locale.findMany();
    const bandRole = await db.bandRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } } } });
    for (let index = 0; index < 2; index++) {
        const band = await db.band.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } }, locales: { create: locales.map(item => ({ localeId: item.id })) } } });
        bands.push(band);
        await db.bandUser.createMany({ data: [20, 10].map(userId => ({ publicId: generatePublicId(), userId, bandId: band.id, bandRoleId: bandRole.id })) });
    }
    await db.userSignInMethod.createMany({ data: [
        { publicId: generatePublicId(), userId: 10, type: "email", identifier: "main-login@test.invalid" },
        { publicId: generatePublicId(), userId: 20, type: "email", identifier: "retiring-login@test.invalid" },
        { publicId: generatePublicId(), userId: 20, type: "google", identifier: "private-google-subject" },
    ] });
    await db.session.createMany({ data: [10, 20].map(userId => ({ userId, handle: "session-" + userId })) });
    await db.token.createMany({ data: [10, 20].map(userId => ({ userId, hashedToken: "reset-" + userId, type: "RESET_PASSWORD", sentTo: "private@test.invalid", expiresAt: new Date("2099-01-01") })) });
    authority = { authorization: await loadAuthorizationForUser({ id: 1 }, db, null), isImpersonating: false };
}
async function seedContent() {
    for (const band of bands) {
        const members = await db.bandUser.findMany({ where: { bandId: band.id } });
        const main = members.find(member => member.userId === 10);
        const retiring = members.find(member => member.userId === 20)!;
        for (let index = 0; index < 2; index++) {
            const event = await db.event.create({ data: { publicId: generatePublicId(), bandId: band.id, name: "Private event", revision: 1, createdByUserId: 20, updatedByUserId: 20, isDeleted: true } });
            const segment = await db.eventSegment.create({ data: { publicId: generatePublicId(), eventId: event.id, name: "Private segment", description: "", durationMillis: BigInt(0) } });
            if (index === 0 && main) {
                await db.eventUserResponse.create({ data: { publicId: generatePublicId(), bandUserId: main.id, eventId: event.id, userComment: "", revision: 5 } });
                await db.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), bandUserId: main.id, eventSegmentId: segment.id } });
            }
            await db.eventUserResponse.create({ data: { publicId: generatePublicId(), bandUserId: retiring.id, eventId: event.id, userComment: index === 0 ? "discarded-private-comment" : "transferred-private-comment", revision: index === 0 ? 8 : 2 } });
            await db.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), bandUserId: retiring.id, eventSegmentId: segment.id, createdByUserId: 20, updatedByUserId: 20 } });
        }
        const song = await db.song.create({ data: { publicId: generatePublicId(), bandId: band.id, name: "Private song", description: "", isDeleted: true, createdByUserId: 20, updatedByUserId: 20 } });
        const text = await db.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } });
        const type = await db.songCreditType.create({ data: { publicId: generatePublicId(), nameId: text.id, descriptionId: text.id, sortOrder: 0 } });
        await db.songCredit.createMany({ data: [
            { publicId: generatePublicId(), songId: song.id, userId: 10, typeId: type.id, comment: "same", year: "2025" },
            { publicId: generatePublicId(), songId: song.id, userId: 20, typeId: type.id, comment: "same", year: "2025" },
            { publicId: generatePublicId(), songId: song.id, userId: 20, typeId: type.id, comment: "private credit", year: "2026" },
        ] });
        const group = await db.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: band.id } });
        const instrument = await db.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id, functionalGroupId: group.id } });
        const imported = await db.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id, functionalGroupId: group.id } });
        if (main) {
            await db.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: main.id, bandInstrumentId: instrument.id, isPrimary: true } });
        }
        await db.bandUserInstrument.createMany({ data: [
            { publicId: generatePublicId(), bandUserId: retiring.id, bandInstrumentId: instrument.id, isPrimary: false },
            { publicId: generatePublicId(), bandUserId: retiring.id, bandInstrumentId: imported.id, isPrimary: true },
        ] });
        const tag = await db.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: band.id } });
        const otherTag = await db.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: band.id } });
        if (main) {
            await db.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserId: main.id, bandUserTagId: tag.id } });
            await db.bandUserSetting.create({ data: { bandUserId: main.id, name: "PrivatePreference", value: false } });
        }
        await db.bandUserTagAssignment.createMany({ data: [tag.id, otherTag.id].map(bandUserTagId => ({ publicId: generatePublicId(), bandUserId: retiring.id, bandUserTagId })) });
        await db.bandUserSetting.create({ data: { bandUserId: retiring.id, name: "PrivatePreference", value: true } });
        const file = await db.file.create({ data: { publicId: generatePublicId(), bandId: band.id, fileLeafName: "Private file", storedLeafName: generatePublicId(), uploadedAt: new Date(), uploadedByUserId: 20, description: "", isDeleted: true } });
        await db.fileUserTag.createMany({ data: [retiring.id, ...(main ? [main.id] : [])].map(bandUserId => ({ publicId: generatePublicId(), fileId: file.id, bandUserId })) });
        await db.frontpageGalleryItem.create({ data: { publicId: generatePublicId(), fileId: file.id, caption: "Private caption", displayParams: "{}", createdByUserId: 20 } });
        await db.menuLink.create({ data: { publicId: generatePublicId(), bandId: band.id, captionId: text.id, groupName: "", groupCssClass: "", itemCssClass: "", linkType: "ExternalURL", createdByUserId: 20 } });
        await db.customLink.create({ data: { publicId: generatePublicId(), bandId: band.id, slug: "private-link", name: "Private link", description: "", redirectType: "Temporary", createdByUserId: 20 } });
        const page = await db.wikiPage.create({ data: { publicId: generatePublicId(), bandId: band.id, slug: "private-page", lockedByUserId: 20, lockAcquiredAt: new Date(), createdByUserId: 20 } });
        await db.wikiPageRevision.create({ data: { publicId: generatePublicId(), wikiPageId: page.id, name: "Private revision", content: "Private content", createdByUserId: 20 } });
        const planGroup = await db.setlistPlanGroup.create({ data: { publicId: generatePublicId(), bandId: band.id, name: "Private group", description: "", createdByUserId: 20 } });
        await db.setlistPlan.create({ data: { publicId: generatePublicId(), bandId: band.id, name: "Private plan", description: "", groupId: planGroup.id, payloadJson: JSON.stringify({ version: 1, rows: [], columns: [], cells: [] }), createdByUserId: 20 } });
    }
    await db.userSetting.createMany({ data: [10, 20].map(userId => ({ userId, name: "PrivatePreference", value: userId === 20 })) });
    await db.action.create({ data: { userId: 20, isClient: true, feature: "Private feature" } });
    await db.change.create({ data: { userId: 20, operationId: "historical", context: "historical", table: "User", recordId: 20, action: "update" } });
}
async function preview() {
    return db.$transaction(async tx => (await prepareUserMerge(tx, authority, pair, locale)).preview, { isolationLevel: "Serializable" });
}
const merge = (confirmation: string) => commitUserMerge(db, authority, { ...locale, participants: pair, confirmation });
describe.skipIf(!url)("shared-account merge on native MySQL", () => {
    beforeAll(async () => {
        mainPassword = await SecurePassword.hash("main-password");
        retiringPassword = await SecurePassword.hash("retiring-password");
    });
    beforeEach(async () => { vi.restoreAllMocks(); await resetPrivateDatabase(); await seedAccounts(); }, 30_000);
    afterAll(() => db.$disconnect());

    it("previews aggregate policies and atomically transfers every current ownership across two bands", async () => {
        await seedContent();
        const before = await preview();
        expect(before.canCommit).toBe(true);
        expect(before.sections.find(section => section.key === "eventResponses")?.effects).toContainEqual({ label: "Different non-empty comments discarded", count: 2 });
        for (const secret of ["discarded-private-comment", "transferred-private-comment", "private-google-subject", "private credit", "main-login@test.invalid", mainPassword, "Private event", "a".repeat(64)]) {
            expect(JSON.stringify(before)).not.toContain(secret);
        }
        const original = await db.user.findUniqueOrThrow({ where: { id: 10 } });
        expect(await merge(before.confirmation)).toEqual({ mainUserId: pair.mainUserId });
        expect(await db.user.findUniqueOrThrow({ where: { id: 10 } })).toEqual(original);
        expect(await db.user.findUniqueOrThrow({ where: { id: 20 } })).toMatchObject({ isDeleted: true, mergedIntoUserId: 10, hashedPassword: null, calendarFeedToken: null, mergedAt: expect.any(Date) });
        expect(await db.session.count()).toBe(0); expect(await db.token.count()).toBe(0);
        for (const method of await db.userSignInMethod.findMany()) {
            expect((await findSignInUser(db, method, { allowInactive: false }))?.id).toBe(10);
        }
        expect(await SecurePassword.verify(original.hashedPassword!, "main-password")).toBe(SecurePassword.VALID);
        for (const band of bands) {
            const main = await db.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: 10 } } });
            const retired = await db.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: 20 } } });
            expect(retired.isDeleted).toBe(true);
            expect(await db.eventUserResponse.findMany({ where: { bandUserId: main.id }, orderBy: { eventId: "asc" } })).toMatchObject([
                { userComment: "", revision: 5 }, { userComment: "transferred-private-comment", revision: 4 },
            ]);
            expect(await db.eventSegmentUserResponse.count({ where: { bandUserId: retired.id } })).toBe(0);
            expect(await db.eventSegmentUserResponse.findMany({ where: { bandUserId: main.id, createdByUserId: 20 } })).toHaveLength(1);
            expect(await db.bandUserInstrument.findMany({ where: { bandUserId: main.id }, orderBy: { bandInstrumentId: "asc" } })).toMatchObject([{ isPrimary: true }, { isPrimary: false }]);
            expect(await db.bandUserTagAssignment.count({ where: { bandUserId: main.id } })).toBe(1);
            expect(await db.bandUserSetting.findMany({ where: { bandUserId: main.id } })).toMatchObject([{ value: false }]);
            expect(await db.bandUserSetting.count({ where: { bandUserId: retired.id } })).toBe(0);
        }
        expect(await db.songCredit.count({ where: { userId: 10 } })).toBe(4);
        const retiringOwnerships = await Promise.all([
            db.song.count({ where: { createdByUserId: 20 } }), db.event.count({ where: { createdByUserId: 20 } }),
            db.customLink.count({ where: { createdByUserId: 20 } }), db.menuLink.count({ where: { createdByUserId: 20 } }),
            db.frontpageGalleryItem.count({ where: { createdByUserId: 20 } }), db.wikiPage.count({ where: { createdByUserId: 20 } }),
            db.setlistPlan.count({ where: { createdByUserId: 20 } }), db.setlistPlanGroup.count({ where: { createdByUserId: 20 } }),
        ]);
        expect(retiringOwnerships).toEqual(Array(8).fill(0));
        expect(await db.file.count({ where: { uploadedByUserId: 20 } })).toBe(0);
        expect(await db.wikiPage.count({ where: { lockedByUserId: 20 } })).toBe(0);
        expect(await db.wikiPageRevision.count({ where: { createdByUserId: 20 } })).toBe(2);
        expect(await db.song.count({ where: { updatedByUserId: 20 } })).toBe(2);
        expect(await db.userSetting.findMany({ where: { userId: 10 } })).toMatchObject([{ value: false }]);
        const audit = await db.change.findFirstOrThrow({ where: { context: "mergeUsers" } });
        expect(audit.userId).toBe(1); expect(JSON.parse(audit.newValues!).sections).toEqual(before.sections);
        expect(audit.newValues).not.toContain("private");
        expect(await db.change.findFirst({ where: { context: "historical" } })).toMatchObject({ userId: 20 });
        // Exact replays are rejected by current participant eligibility, with no repeated writes/audit.
        await expect(merge(before.confirmation)).rejects.toThrow();
        expect(await db.change.count({ where: { context: "mergeUsers" } })).toBe(1);
    });
    it("uses Retiring's password only when Main has none", async () => {
        await db.user.update({ where: { id: 10 }, data: { hashedPassword: null } });
        await merge((await preview()).confirmation);
        expect((await db.user.findUniqueOrThrow({ where: { id: 10 } })).hashedPassword).toBe(retiringPassword);
    });
    it("revokes both public and natural impersonation origins and preserves unrelated sessions", async () => {
        await db.session.createMany({ data: [
            { userId: 1, handle: "impersonation-natural", publicData: JSON.stringify({ impersonatingFromUserId: 20 }) },
            { userId: 1, handle: "impersonation-public", publicData: JSON.stringify({ impersonatingFromUserId: pair.mainUserId }) },
            { userId: 1, handle: "unrelated", publicData: "invalid" },
        ] });
        await merge((await preview()).confirmation);
        expect(await db.session.findMany()).toMatchObject([{ handle: "unrelated" }]);
    });
    it("supports inactive Retiring but blocks inactive Main and retiring a receiver of prior merges", async () => {
        await db.user.update({ where: { id: 10 }, data: { isDeleted: true } });
        expect((await preview()).canCommit).toBe(false);
        await db.user.update({ where: { id: 10 }, data: { isDeleted: false } });
        await db.user.create({ data: { publicId: generatePublicId(), email: "prior@test.invalid", mergedIntoUserId: 20, isDeleted: true } });
        expect((await preview()).canCommit).toBe(false);
        await db.user.updateMany({ where: { email: "prior@test.invalid" }, data: { mergedIntoUserId: null } });
        await db.user.update({ where: { id: 20 }, data: { isDeleted: true } });
        await merge((await preview()).confirmation);
        expect(await db.userSignInMethod.count({ where: { userId: 10 } })).toBe(3);
    });
    it.each(["comment", "membership", "setting", "credential", "roleGrant"])("rejects changed hidden %s state", async change => {
        await seedContent(); const before = await preview();
        const retiring = await db.bandUser.findFirstOrThrow({ where: { userId: 20 } });
        if (change === "comment") { await db.eventUserResponse.updateMany({ where: { bandUserId: retiring.id }, data: { userComment: "different-private-comment" } }); }
        if (change === "membership") { await db.bandUser.update({ where: { id: retiring.id }, data: { isDeleted: true } }); }
        if (change === "setting") { await db.bandUserSetting.updateMany({ where: { bandUserId: retiring.id }, data: { value: false } }); }
        if (change === "credential") { await db.userSignInMethod.updateMany({ where: { userId: 20, type: "google" }, data: { identifier: "another-private-subject" } }); }
        if (change === "roleGrant") {
            const permission = await db.permission.findUniqueOrThrow({ where: { name: Permission.view_events } });
            await db.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: retiring.bandRoleId!, permissionId: permission.id } });
        }
        expect((await preview()).confirmation).not.toBe(before.confirmation);
        await expect(merge(before.confirmation)).rejects.toThrow(MERGE_REVIEW_CHANGED);
        expect(await db.userSignInMethod.count({ where: { userId: 20 } })).toBe(2);
    });
    it("rejects forged direction/hash and freshly revoked authority", async () => {
        const before = await preview();
        await expect(merge("a".repeat(64))).rejects.toThrow(MERGE_REVIEW_CHANGED);
        await expect(commitUserMerge(db, authority, { participants: { mainUserId: pair.retiringUserId, retiringUserId: pair.mainUserId }, confirmation: before.confirmation })).rejects.toThrow(MERGE_REVIEW_CHANGED);
        await db.globalRolePermission.deleteMany({ where: { globalRoleId: authority.authorization.user!.globalRoleId!, permission: { name: Permission.merge_users } } });
        await expect(merge(before.confirmation)).rejects.toThrow("merge_users");
    });
    it.each(["columns", "columnLeds", "rowLeds", "unreadable"])("blocks unsupported setlist %s references without changing data", async field => {
        const entry = field === "columns" ? { columnId: "c", name: "Private column" } : { ledId: "l", name: "Private LED" };
        await db.setlistPlan.create({ data: { publicId: generatePublicId(), bandId: bands[1]!.id, name: "Private plan", description: "", createdByUserId: 1,
            payloadJson: field === "unreadable" ? "invalid" : JSON.stringify({ version: 1, rows: [], columns: [], cells: [], [field]: [{ ...entry, associatedItem: { itemType: "user", id: pair.retiringUserId, name: "Private person" } }] }) } });
        const report = await preview(); expect(report.canCommit).toBe(false);
        await expect(merge(report.confirmation)).rejects.toThrow("blockers");
        expect(await db.session.count()).toBe(2);
    });
    it("rolls back all policies and retirement when the final audit fails", async () => {
        await seedContent(); const before = await preview();
        vi.spyOn(activityLog, "RegisterChange").mockRejectedValueOnce(new Error("injected audit failure"));
        await expect(merge(before.confirmation)).rejects.toThrow("injected audit failure");
        expect(await db.user.findUnique({ where: { id: 20 } })).toMatchObject({ isDeleted: false, mergedIntoUserId: null, hashedPassword: retiringPassword });
        expect(await db.eventUserResponse.count({ where: { bandUser: { userId: 20 } } })).toBe(4);
        expect(await db.userSignInMethod.count({ where: { userId: 20 } })).toBe(2);
        expect(await db.session.count()).toBe(2); expect(await db.token.count()).toBe(2);
        expect(await db.change.count({ where: { context: "mergeUsers" } })).toBe(0);
    });
    it("allows one effect from concurrent commits and no effect from a repeat", async () => {
        const report = await preview();
        const results = await Promise.allSettled([merge(report.confirmation), merge(report.confirmation)]);
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
        const failed = results.find(result => result.status === "rejected");
        if (failed?.status === "rejected" && failed.reason.message.includes("conflicted")) {
            expect(failed.reason.message).toBe(MERGE_TRANSACTION_CONFLICT);
        }
        await expect(merge(report.confirmation)).rejects.toThrow();
        expect(await db.change.count({ where: { context: "mergeUsers" } })).toBe(1);
    });
    it("imports Retiring-only memberships without their role grants and preserves inactive state, tags, settings and primary instrument", async () => {
        await db.bandUser.deleteMany({ where: { userId: 10, bandId: bands[1]!.id } });
        const imported = await db.bandUser.findFirstOrThrow({ where: { userId: 20, bandId: bands[1]!.id } });
        await db.bandUser.update({ where: { id: imported.id }, data: { isDeleted: true } });
        await db.band.update({ where: { id: bands[1]!.id }, data: { isDeleted: true } });
        await seedContent();
        const report = await preview();
        expect(report.sections.find(section => section.key === "memberships")?.effects).toContainEqual({ label: { key: "accountMerge.importedRoles" }, count: 1 });
        await merge(report.confirmation);
        expect(await db.bandUser.findUnique({ where: { id: imported.id } })).toMatchObject({ publicId: imported.publicId, userId: 10, isDeleted: true, bandRoleId: null });
        expect(await db.bandUserTagAssignment.count({ where: { bandUserId: imported.id } })).toBe(2);
        expect(await db.bandUserSetting.findFirst({ where: { bandUserId: imported.id } })).toMatchObject({ value: true });
        expect(await db.bandUserInstrument.count({ where: { bandUserId: imported.id, isPrimary: true } })).toBe(1);
    });
    it("permits a delegated platform operator without Sysadmin or a selected band, while protecting privileged identities", async () => {
        const permissions = await db.permission.findMany({ where: { name: { in: [Permission.merge_users, Permission.manage_global_users] } } });
        const role = await db.globalRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } }, permissions: { create: permissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) } } });
        await db.user.update({ where: { id: 1 }, data: { globalRoleId: role.id } });
        const choices = await searchMergeCandidates(db, authority, { query: "retiring test.invalid", excludeUserId: pair.mainUserId, ...locale });
        expect(choices.map(choice => choice.publicId)).toEqual([pair.retiringUserId]);
        expect(JSON.stringify(choices)).not.toMatch(/hashed|identifier|bandId|"id":/);
        const report = await readMergeAccountAnalysis(db, authority, { userId: pair.mainUserId, ...locale });
        expect(report.userInfo.publicId).toBe(pair.mainUserId);
        await expect(readUserMassAnalysis(db, authority.authorization, pair.mainUserId, locale)).rejects.toThrow("sysadmin");
        await db.user.update({ where: { id: 20 }, data: { isSysAdmin: true } });
        expect(await searchMergeCandidates(db, authority, { query: "", excludeUserId: pair.mainUserId }))
            .toMatchObject([{ publicId: pair.retiringUserId, isSysAdmin: false }]);
        const sysadminRole = await db.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } });
        await db.user.update({ where: { id: 20 }, data: { globalRoleId: sysadminRole.id, isSysAdmin: false } });
        expect(await searchMergeCandidates(db, authority, { query: "", excludeUserId: pair.mainUserId })).toEqual([]);
        await expect(preview()).rejects.toThrow("authorized");
    });
    it("requires explicit global band authority to merge an account with membership privileges", async () => {
        const permissions = await db.permission.findMany({ where: { name: { in: [Permission.merge_users, Permission.manage_global_users] } } });
        const role = await db.globalRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
            permissions: { create: permissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) } } });
        await db.user.update({ where: { id: 1 }, data: { globalRoleId: role.id } });
        const eventPermission = await db.permission.findUniqueOrThrow({ where: { name: Permission.manage_events } });
        const bandRole = await db.bandRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
            bandRolePermissions: { create: { publicId: generatePublicId(), permissionId: eventPermission.id } } } });
        await db.bandUser.updateMany({ where: { userId: 20 }, data: { bandRoleId: bandRole.id } });
        expect(await searchMergeCandidates(db, authority, { query: "retiring", excludeUserId: pair.mainUserId })).toEqual([]);
        await expect(preview()).rejects.toThrow("authorized");
        const globalAuthority = await db.permission.findUniqueOrThrow({ where: { name: Permission.global_band_admin } });
        await db.globalRolePermission.create({ data: { publicId: generatePublicId(), globalRoleId: role.id, permissionId: globalAuthority.id } });
        expect((await searchMergeCandidates(db, authority, { query: "retiring", excludeUserId: pair.mainUserId })).map(choice => choice.publicId)).toEqual([pair.retiringUserId]);
        expect((await authority.authorization.refresh(db)).hasPermission(Permission.manage_events)).toBe(false);
        await expect(preview()).resolves.toMatchObject({ canCommit: true });
    });
    it.each(["anonymous", "deleted", "merged", "impersonated", "bandOnly", "accountGrantRevoked"])("rejects %s actors before returning participant information", async reason => {
        if (reason === "anonymous") { authority.authorization = await loadAuthorizationForUser(null, db, null); }
        if (reason === "deleted") { await db.user.update({ where: { id: 1 }, data: { isDeleted: true } }); }
        if (reason === "merged") { await db.user.update({ where: { id: 1 }, data: { mergedIntoUserId: 10 } }); }
        if (reason === "impersonated") { authority.isImpersonating = true; }
        if (reason === "bandOnly") {
            await db.user.update({ where: { id: 1 }, data: { globalRoleId: null } });
            authority.authorization = await loadAuthorizationForUser({ id: 1 }, db, parsePublicId<"Band">(bands[0]!.publicId));
        }
        if (reason === "accountGrantRevoked") { await db.globalRolePermission.deleteMany({ where: { globalRoleId: authority.authorization.user!.globalRoleId!, permission: { name: Permission.manage_global_users } } }); }
        await expect(searchMergeCandidates(db, authority, { query: "", excludeUserId: pair.mainUserId })).rejects.toThrow();
        await expect(readMergeAccountAnalysis(db, authority, { userId: pair.mainUserId })).rejects.toThrow();
        await expect(preview()).rejects.toThrow();
        await expect(merge("a".repeat(64))).rejects.toThrow();
    });
    it("checks the delegation envelope across every membership and ignores retired roles and grants", async () => {
        const operatorPermissions = await db.permission.findMany({ where: { name: { in: [Permission.merge_users, Permission.manage_global_users] } } });
        const role = await db.globalRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
            permissions: { create: operatorPermissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) } } });
        await db.user.update({ where: { id: 1 }, data: { globalRoleId: role.id } });
        const membership = await db.bandUser.findFirstOrThrow({ where: { userId: 20, bandId: bands[1]!.id } });
        const permission = await db.permission.findUniqueOrThrow({ where: { name: Permission.manage_events } });
        await db.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: membership.bandRoleId!, permissionId: permission.id } });
        await expect(preview()).rejects.toThrow("authorized");
        await db.permission.update({ where: { id: permission.id }, data: { isDeleted: true } });
        expect((await preview()).canCommit).toBe(true);
        await db.permission.update({ where: { id: permission.id }, data: { isDeleted: false } });
        await db.bandRole.update({ where: { id: membership.bandRoleId! }, data: { isDeleted: true } });
        expect((await preview()).canCommit).toBe(true);
    });
    it("warns when shared-account or band retirement loses the last ordinary capability holder", async () => {
        const manageGlobal = await db.permission.findUniqueOrThrow({ where: { name: Permission.manage_global_users } });
        const globalRole = await db.globalRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
            permissions: { create: { publicId: generatePublicId(), permissionId: manageGlobal.id } } } });
        await db.user.update({ where: { id: 20 }, data: { globalRoleId: globalRole.id } });
        const deactivateMembership = await db.permission.findUniqueOrThrow({ where: { name: Permission.deactivate_users } });
        const retiringMembership = await db.bandUser.findFirstOrThrow({ where: { userId: 20, bandId: bands[1]!.id } });
        const role = await db.bandRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
            bandRolePermissions: { create: { publicId: generatePublicId(), permissionId: deactivateMembership.id } } } });
        await db.bandUser.update({ where: { id: retiringMembership.id }, data: { bandRoleId: role.id } });
        const before = await preview();
        expect(JSON.stringify(before.sections[0]!.consequences)).toContain("manage_global_users");
        expect(JSON.stringify(before.sections[0]!.consequences)).toContain(bands[1]!.publicId);
        expect(JSON.stringify(before.sections[0]!.consequences)).toContain("deactivate_users");
        const main = await db.bandUser.findFirstOrThrow({ where: { userId: 10, bandId: bands[1]!.id } });
        await db.bandUser.update({ where: { id: main.id }, data: { bandRoleId: role.id } });
        expect(JSON.stringify((await preview()).sections[0]!.consequences)).not.toContain(bands[1]!.publicId);
        await expect(merge(before.confirmation)).rejects.toThrow(MERGE_REVIEW_CHANGED);
    });
    it("resolves the account role globally for ordered language preferences, preserving intentional blanks", async () => {
        const main = await db.user.findUniqueOrThrow({ where: { id: 10 }, include: { globalRole: true } });
        const french = await db.locale.findUniqueOrThrow({ where: { ietfTag: "fr-BE" } });
        const dutch = await db.locale.findUniqueOrThrow({ where: { ietfTag: "nl-BE" } });
        await db.dynamicLocalizedStringValue.createMany({ data: [
            { publicId: generatePublicId(), stringId: main.globalRole!.nameId, localeId: french.id, indexedValue: "" },
            { publicId: generatePublicId(), stringId: main.globalRole!.nameId, localeId: dutch.id, indexedValue: "Nederlandse globale rol" },
        ] });
        await db.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), bandId: bands[0]!.id,
            stringId: main.globalRole!.nameId, localeId: french.id, indexedValue: "Wrong band override" } });
        expect((await preview()).main.roleName).toBe("");
        const dutchFirst = await db.$transaction(async tx => (await prepareUserMerge(tx, authority, pair,
            { routeLocale: "zz-ZZ", browserLanguages: ["nl-BE", "fr-BE"] })).preview, { isolationLevel: "Serializable" });
        expect(dutchFirst.main.roleName).toBe("Nederlandse globale rol");
    });
});
