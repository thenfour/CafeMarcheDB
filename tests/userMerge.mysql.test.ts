import { Prisma, PrismaClient } from "@prisma/client";
import { SecurePassword } from "@blitzjs/auth/secure-password";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import * as activityLog from "shared/activityLog";
import { prepareUserMerge } from "src/auth/server/userMerge/prepareUserMerge";
import { commitUserMerge, MERGE_REVIEW_CHANGED } from "src/auth/server/userMerge/commitUserMerge";
import { findSignInUser } from "src/auth/server/signInMethods";
//import { requireUnmergedUserReferences } from "src/auth/server/mergedUserReferences";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./authorization/support/authorizationFixtures";

const url = process.env.USER_MERGE_TEST_DATABASE_URL;
const db = new PrismaClient({ datasourceUrl: url });
const adminContext = () => createAuthorizationTestContext(createAuthorizationTestUser("sysadmin", { id: 1 }));
const pair = { mainUserId: 10, retiringUserId: 20 };
let mainPassword: string;
let retiringPassword: string;

async function clearDisposableDatabase() {
    if (!url || !/^\/cmdb_merge_test_[a-f0-9]{16}$/.test(new URL(url).pathname)) throw new Error("A disposable merge-test database is required.");
    await db.$transaction(async tx => {
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
        try {
            for (const model of Prisma.dmmf.datamodel.models) await tx.$executeRawUnsafe(`DELETE FROM \`${model.dbName || model.name}\``);
        } finally { await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1"); }
    });
}

async function seedAccounts() {
    await db.permission.createMany({ data: Object.values(Permission).map((name, index) => ({ id: index + 1, name })) });
    const permissions = await db.permission.findMany();
    await db.role.create({
        data: {
            id: 1, name: "Sysadmin", isSysAdminRole: true,
            permissions: { create: permissions.filter(permission => permission.name !== Permission.never_grant).map(permission => ({ permissionId: permission.id })) },
        }
    });
    await db.role.create({
        data: {
            id: 2, name: "Member", permissions: {
                create: permissions
                    .filter(permission => permission.name === Permission.login)
                    .map(permission => ({ permissionId: permission.id }))
            }
        }
    });
    await db.user.createMany({
        data: [
            { id: 1, name: "Operator", email: "operator@test.invalid", isSysAdmin: true, roleId: 1 },
            { id: 10, name: "Main", email: "main-contact@test.invalid", roleId: 2, hashedPassword: mainPassword, calendarFeedToken: "main-calendar-secret" },
            { id: 20, name: "Retiring", email: "retiring-contact@test.invalid", roleId: 2, hashedPassword: retiringPassword, calendarFeedToken: "retiring-calendar-secret" },
        ]
    });
    await db.userSignInMethod.createMany({
        data: [
            { id: 1, userId: 10, type: "email", identifier: "main-login@test.invalid" },
            { id: 2, userId: 20, type: "email", identifier: "retiring-login@test.invalid" },
            { id: 3, userId: 20, type: "google", identifier: "private-google-subject" },
        ]
    });
    await db.session.createMany({ data: [{ userId: 10, handle: "main-session" }, { userId: 20, handle: "retiring-session" }] });
    await db.token.createMany({ data: [10, 20].map(userId => ({ userId, hashedToken: `reset-${userId}`, type: "RESET_PASSWORD", sentTo: "private@test.invalid", expiresAt: new Date("2099-01-01") })) });
}

async function seedContent() {
    await db.event.createMany({ data: [1, 2].map(id => ({ id, name: `Private event ${id}`, createdByUserId: 20, revision: 1 })) });
    await db.eventSegment.createMany({ data: [1, 2].map(id => ({ id, eventId: id, name: "Private segment", description: "", durationMillis: 0 })) });
    await db.eventUserResponse.createMany({
        data: [
            { id: 1, userId: 10, eventId: 1, userComment: "", revision: 5 },
            { id: 2, userId: 20, eventId: 1, userComment: "discarded-private-comment", revision: 8 },
            { id: 3, userId: 20, eventId: 2, userComment: "transferred-private-comment", revision: 2 },
        ]
    });
    await db.eventSegmentUserResponse.createMany({
        data: [
            { id: 1, userId: 10, eventSegmentId: 1, attendanceId: null },
            { id: 2, userId: 20, eventSegmentId: 1, attendanceId: null, createdByUserId: 20 },
            { id: 3, userId: 20, eventSegmentId: 2, attendanceId: null, createdByUserId: 20 },
        ]
    });
    await db.song.create({ data: { id: 1, name: "Private song", description: "", createdByUserId: 20 } });
    await db.songCreditType.create({ data: { id: 1, publicId: "CreditType000001", text: "Composer", description: "" } });
    await db.songCredit.createMany({
        data: [
            { id: 1, publicId: "SongCredit000001", songId: 1, typeId: 1, userId: 10, comment: "same", year: "2025" },
            { id: 2, publicId: "SongCredit000002", songId: 1, typeId: 1, userId: 20, comment: "same", year: "2025" },
            { id: 3, publicId: "SongCredit000003", songId: 1, typeId: 1, userId: 20, comment: "private credit", year: "2026" },
        ]
    });
    await db.userSetting.createMany({ data: [{ userId: 10, name: "calendar.showDeclinedEvents", value: false }, { userId: 20, name: "calendar.showDeclinedEvents", value: true }] });
    await db.userTag.createMany({ data: [
        { id: 1, publicId: "MergeUserTag0001", text: "Shared", description: "" },
        { id: 2, publicId: "MergeUserTag0002", text: "Retiring only", description: "" },
    ] });
    await db.userTagAssignment.createMany({ data: [
        { publicId: "MergeUsrAsgn0001", userId: 10, userTagId: 1 },
        { publicId: "MergeUsrAsgn0002", userId: 20, userTagId: 1 },
        { publicId: "MergeUsrAsgn0003", userId: 20, userTagId: 2 },
    ] });
    await db.instrumentFunctionalGroup.create({ data: { id: 1, publicId: "merge_test_group", name: "Group", description: "", sortOrder: 0 } });
    await db.instrument.createMany({ data: [1, 2].map(id => ({
        id,
        publicId: `mergeinst${String(id).padStart(7, "0")}`,
        name: `Instrument ${id}`,
        description: "",
        sortOrder: id,
        functionalGroupId: 1,
    })) });
    await db.userInstrument.createMany({ data: [
        { publicId: "MergeUsrInst0001", userId: 10, instrumentId: 1, isPrimary: true },
        { publicId: "MergeUsrInst0002", userId: 20, instrumentId: 1 },
        { publicId: "MergeUsrInst0003", userId: 20, instrumentId: 2, isPrimary: true },
    ] });
    await db.change.create({ data: { action: "update", context: "historical", operationId: "original", table: "Song", recordId: 1, userId: 20 } });
}

async function preview() { return (await prepareUserMerge(db, adminContext(), pair)).preview; }
async function merge(confirmation: string) { return commitUserMerge(db, adminContext(), { participants: pair, confirmation }); }

describe.skipIf(!url)("user merge with real MySQL", () => {
    beforeAll(async () => {
        mainPassword = await SecurePassword.hash("main-password");
        retiringPassword = await SecurePassword.hash("retiring-password");
    });
    beforeEach(async () => { await clearDisposableDatabase(); await seedAccounts(); });
    afterAll(async () => db.$disconnect());

    it("previews aggregate data, executes the exact policy and resolves every transferred login to Main", async () => {
        await seedContent();
        const before = await preview();
        expect(before.canCommit).toBe(true);
        const serialized = JSON.stringify(before);
        for (const secret of ["discarded-private-comment", "transferred-private-comment", "private-google-subject", "private credit", "main-login@test.invalid", mainPassword, "Private event", "main-calendar-secret"]) expect(serialized).not.toContain(secret);
        expect(before.sections.find(section => section.key === "eventResponses")?.effects).toContainEqual({ label: "Different non-empty comments discarded", count: 1 });
        expect(await db.eventUserResponse.count({ where: { userId: 20 } })).toBe(2);
        const originalMain = await db.user.findUniqueOrThrow({ where: { id: 10 } });

        await expect(merge(before.confirmation)).resolves.toEqual({ mainUserId: 10, alreadyMerged: false });
        const main = await db.user.findUniqueOrThrow({ where: { id: 10 } });
        const retired = await db.user.findUniqueOrThrow({ where: { id: 20 } });
        expect(main.uid).toBe(originalMain.uid);
        expect(main.calendarFeedToken).toBe("main-calendar-secret");
        expect(main.hashedPassword).toBe(mainPassword);
        expect(retired).toMatchObject({ isDeleted: true, mergedIntoUserId: 10, hashedPassword: null, calendarFeedToken: null });
        expect(retired.mergedAt).toBeInstanceOf(Date);
        expect(await db.session.count()).toBe(0);
        expect(await db.token.count()).toBe(0);
        expect(await db.userSignInMethod.count({ where: { userId: 20 } })).toBe(0);
        for (const method of await db.userSignInMethod.findMany()) {
            expect((await findSignInUser(db, method, { allowInactive: false }))?.id).toBe(10);
        }
        expect(await SecurePassword.verify(main.hashedPassword!, "main-password")).toBe(SecurePassword.VALID);
        await expect(SecurePassword.verify(main.hashedPassword!, "retiring-password")).rejects.toThrow();
        expect(await db.eventUserResponse.findMany({ orderBy: { eventId: "asc" } })).toMatchObject([
            { userId: 10, eventId: 1, userComment: "", revision: 5 },
            { userId: 10, eventId: 2, userComment: "transferred-private-comment", revision: 4 },
        ]);
        expect(await db.eventSegmentUserResponse.count({ where: { userId: 20 } })).toBe(0);
        expect(await db.eventSegmentUserResponse.findUnique({ where: { id: 3 } })).toMatchObject({ userId: 10, createdByUserId: 20 });
        expect(await db.songCredit.findMany({ orderBy: { id: "asc" } })).toMatchObject([{ id: 1, userId: 10 }, { id: 3, userId: 10 }]);
        expect(await db.userInstrument.findMany({ orderBy: { instrumentId: "asc" } })).toMatchObject([{ userId: 10, instrumentId: 1, isPrimary: true }, { userId: 10, instrumentId: 2, isPrimary: false }]);
        expect(await db.userTagAssignment.findMany()).toMatchObject([{ userId: 10, userTagId: 1 }]);
        expect(await db.userSetting.findMany()).toMatchObject([{ userId: 10, value: false }]);
        expect(await db.song.findUnique({ where: { id: 1 } })).toMatchObject({ createdByUserId: 10 });
        const audit = await db.change.findFirstOrThrow({ where: { context: "mergeUsers" } });
        expect(audit.userId).toBe(1);
        expect(JSON.parse(audit.newValues!).sections).toEqual(before.sections);
        expect(audit.newValues).not.toContain("private");
        expect(await db.change.findFirst({ where: { context: "historical" } })).toMatchObject({ userId: 20 });
        await expect(merge(before.confirmation)).resolves.toEqual({ mainUserId: 10, alreadyMerged: true });
        expect(await db.change.count({ where: { context: "mergeUsers" } })).toBe(1);
        //await expect(requireUnmergedUserReferences(db, [20])).rejects.toThrow("merged");
    });

    it("uses Retiring's password only when Main has none", async () => {
        await db.user.update({ where: { id: 10 }, data: { hashedPassword: null } });
        await merge((await preview()).confirmation);
        expect(await db.user.findUnique({ where: { id: 10 } })).toMatchObject({ hashedPassword: retiringPassword });
    });

    it("revokes impersonation sessions originating from a merged account and retains unrelated sessions", async () => {
        await db.session.createMany({
            data: [
                { userId: 1, handle: "impersonation", publicData: JSON.stringify({ impersonatingFromUserId: 20 }) },
                { userId: 1, handle: "unrelated", publicData: JSON.stringify({ impersonatingFromUserId: null }) },
            ]
        });
        await merge((await preview()).confirmation);
        expect(await db.session.findMany()).toMatchObject([{ handle: "unrelated" }]);
    });

    it("supports an ordinary deactivated retiring account with recovery authority", async () => {
        await db.user.update({ where: { id: 20 }, data: { isDeleted: true } });
        await merge((await preview()).confirmation);
        expect(await db.userSignInMethod.count({ where: { userId: 10 } })).toBe(3);
    });

    it("rejects changes to hidden data even when report counts stay the same", async () => {
        await seedContent();
        const before = await preview();
        await db.eventUserResponse.update({ where: { id: 2 }, data: { userComment: "another-private-comment" } });
        const after = await preview();
        expect(after.sections).toEqual(before.sections);
        expect(after.confirmation).not.toBe(before.confirmation);
        await expect(merge(before.confirmation)).rejects.toThrow(MERGE_REVIEW_CHANGED);
        expect(await db.userSignInMethod.count({ where: { userId: 20 } })).toBe(2);
    });

    it("rechecks authorization and blocks changing Main or forging confirmation", async () => {
        const before = await preview();
        await expect(merge("a".repeat(64))).rejects.toThrow(MERGE_REVIEW_CHANGED);
        await expect(commitUserMerge(db, adminContext(), { participants: { mainUserId: 20, retiringUserId: 10 }, confirmation: before.confirmation })).rejects.toThrow(MERGE_REVIEW_CHANGED);
        await db.user.update({ where: { id: 1 }, data: { isDeleted: true } });
        await expect(merge(before.confirmation)).rejects.toThrow("merge_users");
    });

    it("blocks embedded references without changing any account data", async () => {
        await db.setlistPlan.create({
            data: {
                name: "Private plan", description: "", createdByUserId: 1, payloadJson: JSON.stringify({
                    version: 1, rows: [], cells: [], columns: [{ columnId: "a", name: "Private column", associatedItem: { itemType: "user", id: 20, name: "Retiring" } }],
                })
            }
        });
        const report = await preview();
        expect(report.canCommit).toBe(false);
        await expect(merge(report.confirmation)).rejects.toThrow("blockers");
        expect(await db.user.findUnique({ where: { id: 20 } })).toMatchObject({ isDeleted: false });
        expect(await db.session.count()).toBe(2);
    });

    it("rolls back every earlier policy if the final audit write fails", async () => {
        await seedContent();
        const before = await preview();
        vi.spyOn(activityLog, "RegisterChange").mockRejectedValueOnce(new Error("injected audit failure"));
        await expect(merge(before.confirmation)).rejects.toThrow("injected audit failure");
        expect(await db.user.findUnique({ where: { id: 20 } })).toMatchObject({ isDeleted: false, mergedIntoUserId: null, hashedPassword: retiringPassword });
        expect(await db.userSignInMethod.count({ where: { userId: 20 } })).toBe(2);
        expect(await db.eventUserResponse.count({ where: { userId: 20 } })).toBe(2);
        expect(await db.songCredit.count()).toBe(3);
        expect(await db.session.count()).toBe(2);
        expect(await db.token.count()).toBe(2);
        expect(await db.change.count({ where: { context: "mergeUsers" } })).toBe(0);
    });

    it("allows only one effect from concurrent commits and makes a retry idempotent", async () => {
        const report = await preview();
        const results = await Promise.allSettled([merge(report.confirmation), merge(report.confirmation)]);
        expect(results.some(result => result.status === "fulfilled")).toBe(true);
        expect(await db.change.count({ where: { context: "mergeUsers" } })).toBe(1);
        await expect(merge(report.confirmation)).resolves.toEqual({ mainUserId: 10, alreadyMerged: true });
    });
});
