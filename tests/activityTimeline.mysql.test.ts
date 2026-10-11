import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readActivityTimeline } from "src/core/components/featureReports/server/activityTimeline";
import type { GeneralFeatureReportInput } from "src/core/components/featureReports/activityReportTypes";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const band = fixture.bands[0]!;
    const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } } });
    const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_feature_reports } });
    const roleId = member.bandRoleId!;
    if (!await tx.bandRolePermission.findFirst({ where: { bandRoleId: roleId, permissionId: permission.id } })) {
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: roleId, permissionId: permission.id } });
    }
    const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(band.publicId));
    const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
    const input: GeneralFeatureReportInput = { bandPublicId: parsePublicId<"Band">(band.publicId),
        startDate: new Date("2026-01-01T00:00:00Z"), endDateExclusive: new Date("2027-01-01T00:00:00Z"),
        filterSpec: { bucketSize: ActivityReportTimeBucketSize.all, excludeYourself: false, excludeSysadmins: false,
            includeFeatures: [], excludeFeatures: [], contextBeginsWith: null } };
    const read = (args = input) => readActivityTimeline(snapshot, auth, args);
    const add = (data: Partial<Prisma.ActionUncheckedCreateInput> = {}) => tx.action.create({ data: {
        isClient: true, feature: "timeline-fixture", context: "fixture/report", bandId: band.id, createdAt: new Date("2026-04-01T00:00:00Z"), ...data,
    } });
    const zone = (timeZone: string) => tx.bandSetting.upsert({ where: { bandId_name: { bandId: band.id, name: "dateTime.bandTimeZone" } },
        create: { publicId: generatePublicId(), bandId: band.id, name: "dateTime.bandTimeZone", value: timeZone }, update: { value: timeZone } });
    return { band, member, permission, roleId, auth, snapshot, input, read, add, zone };
}

describe.skipIf(!settingsMysqlTestUrl)("activity timeline on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    afterEach(() => { vi.restoreAllMocks(); });
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database!, work);

    it("isolates bands, excludes unowned actions and returns only aggregate counts", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        await report.add({ userId: fixture.user.id, uri: "/private/person/42", queryText: "private query" });
        await report.add();
        await report.add({ bandId: fixture.bands[1]!.id });
        await report.add({ bandId: null });
        const result = await report.read();
        expect(result.data).toEqual([{ bucket: "all", count: 2 }]);
        expect(Object.keys(result).sort()).toEqual(["data", "metrics", "timeZone"]);
        expect(JSON.stringify(result)).not.toMatch(/private|userId|bandId|uri|queryText|context|publicId/);
        const otherMember = await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: report.roleId } });
        const otherAuth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        const otherSnapshot = await bindDB3ReadSnapshot(tx, otherAuth, { isolationLevel: "Serializable" });
        expect(otherMember.publicId).not.toBe(report.member.publicId);
        expect((await readActivityTimeline(otherSnapshot, otherAuth, { ...report.input, bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) })).data)
            .toEqual([{ bucket: "all", count: 1 }]);
    }));

    it("retains anonymous authors while excluding the current person and both administrator policies", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        const flagged = await tx.user.create({ data: { publicId: generatePublicId(), name: "Flagged administrator", email: "flagged@test.invalid", isSysAdmin: true } });
        const ordinary = await tx.user.create({ data: { publicId: generatePublicId(), name: "Ordinary person", email: "ordinary@test.invalid" } });
        expect(await tx.user.findUniqueOrThrow({ where: { id: fixture.admin.id } })).toMatchObject({ isSysAdmin: false });
        for (const userId of [null, fixture.user.id, fixture.admin.id, flagged.id, ordinary.id]) {
            await report.add({ userId });
        }
        const read = (excludeYourself: boolean, excludeSysadmins: boolean) => report.read({ ...report.input,
            filterSpec: { ...report.input.filterSpec, excludeYourself, excludeSysadmins } });
        expect((await read(true, true)).data).toEqual([{ bucket: "all", count: 2 }]);
        expect((await read(true, false)).data).toEqual([{ bucket: "all", count: 4 }]);
        expect((await read(false, true)).data).toEqual([{ bucket: "all", count: 3 }]);
        expect((await read(false, false)).data).toEqual([{ bucket: "all", count: 5 }]);
    }));

    it("applies include/exclude precedence, literal context prefixes and SQL parameters", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        const injection = "' OR 1=1 --";
        for (const data of [
            { feature: "keep", context: "a%_\\/child" }, { feature: "keep", context: "anything/child" },
            { feature: "remove", context: "a%_\\/child" }, { feature: injection, context: injection },
        ]) {
            await report.add(data);
        }
        const read = (filters: Partial<GeneralFeatureReportInput["filterSpec"]>) => report.read({ ...report.input, filterSpec: { ...report.input.filterSpec, ...filters } });
        expect((await read({ includeFeatures: ["keep", "remove"], excludeFeatures: ["remove"], contextBeginsWith: "a%_\\" })).data)
            .toEqual([{ bucket: "all", count: 1 }]);
        expect((await read({ includeFeatures: [injection], contextBeginsWith: injection })).data).toEqual([{ bucket: "all", count: 1 }]);
        expect((await read({ includeFeatures: ["missing"] })).data).toEqual([]);
    }));

    it("includes the start and excludes the end at the millisecond boundary", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        for (const createdAt of [new Date(report.input.startDate.valueOf() - 1), report.input.startDate,
            new Date(report.input.endDateExclusive.valueOf() - 1), report.input.endDateExclusive]) {
            await report.add({ createdAt });
        }
        expect((await report.read()).data).toEqual([{ bucket: "all", count: 2 }]);
    }));

    const bucketCases: Array<[ActivityReportTimeBucketSize, string[]]> = [
        [ActivityReportTimeBucketSize.day, ["2026-01-01", "2026-01-02"]],
        [ActivityReportTimeBucketSize.week, ["2026-01"]],
        [ActivityReportTimeBucketSize.month, ["2026-01"]],
        [ActivityReportTimeBucketSize.year, ["2026"]],
    ];
    it.each(bucketCases)("groups %s in the fresh band zone across the UTC year boundary", (bucketSize, buckets) => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        await report.zone("Asia/Tokyo");
        await report.add({ createdAt: new Date("2025-12-31T16:00:00Z") });
        await report.add({ createdAt: new Date("2026-01-01T16:00:00Z") });
        const result = await report.read({ ...report.input, startDate: new Date("2025-12-31T00:00:00Z"), filterSpec: { ...report.input.filterSpec, bucketSize } });
        expect(result.timeZone).toBe("Asia/Tokyo");
        expect(result.data.map(row => row.bucket)).toEqual(buckets);
        expect(result.data.reduce((sum, row) => sum + row.count, 0)).toBe(2);
    }));

    it("skips the nonexistent spring hour and combines both occurrences of the repeated autumn hour", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        await report.zone("Europe/Brussels");
        for (const instant of ["2026-03-29T00:30:00Z", "2026-03-29T01:00:00Z", "2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z"]) {
            await report.add({ createdAt: new Date(instant) });
        }
        expect((await report.read({ ...report.input, filterSpec: { ...report.input.filterSpec, bucketSize: ActivityReportTimeBucketSize.hour } })).data).toEqual([
            { bucket: "2026-03-29 01:00:00", count: 1 }, { bucket: "2026-03-29 03:00:00", count: 1 }, { bucket: "2026-10-25 02:00:00", count: 2 },
        ]);
    }));

    const revocations: Array<"grant" | "permission" | "membership" | "role" | "account" | "merge" | "band"> =
        ["grant", "permission", "membership", "role", "account", "merge", "band"];
    it.each(revocations)("rejects stale authority after revoking %s before aggregating", kind => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        await report.add();
        if (kind === "grant") {
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: report.roleId, permissionId: report.permission.id } });
        } else if (kind === "permission") {
            await tx.permission.update({ where: { id: report.permission.id }, data: { isDeleted: true } });
        } else if (kind === "membership") {
            await tx.bandUser.update({ where: { id: report.member.id }, data: { isDeleted: true } });
        } else if (kind === "role") {
            await tx.bandRole.update({ where: { id: report.roleId }, data: { isDeleted: true } });
        } else if (kind === "account") {
            await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: true } });
        } else if (kind === "merge") {
            await tx.user.update({ where: { id: fixture.user.id }, data: { mergedIntoUserId: fixture.admin.id } });
        } else {
            await tx.band.update({ where: { id: report.band.id }, data: { isDeleted: true } });
        }
        const query = vi.spyOn(tx, "$queryRaw");
        await expect(report.read()).rejects.toThrow();
        expect(query).not.toHaveBeenCalled();
    }));

    it("requires a selected band for platform readers and rejects anonymous, foreign-context and roleless readers", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        await report.add();
        const platform = await loadAuthorizationForUser(fixture.admin, tx, report.input.bandPublicId);
        const platformSnapshot = await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" });
        expect((await readActivityTimeline(platformSnapshot, platform, report.input)).data).toEqual([{ bucket: "all", count: 1 }]);
        const principals = [
            await loadAuthorizationForUser(fixture.admin, tx),
            await loadAuthorizationForUser(null, tx, report.input.bandPublicId),
            await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId)),
        ];
        for (const auth of principals) {
            const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
            await expect(readActivityTimeline(snapshot, auth, report.input)).rejects.toThrow();
        }
        await expect(report.read({ ...report.input, bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) })).rejects.toThrow();
    }));
});
