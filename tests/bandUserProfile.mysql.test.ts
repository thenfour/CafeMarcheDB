import { PrismaClient, type Prisma } from "@prisma/client";
import type { AuthenticatedCtx } from "blitz";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import * as authorization from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { bandUserProfileCommand, bandUserProfileView } from "src/core/db3/shared/entities/user/bandUserProfile";
import { xBandUser } from "src/core/db3/shared/entities/user/bandUser";
import { editBandUserProfile } from "src/core/db3/server/commands/bandUserProfileCommand";
import { DB3PaginatedQueryCore, queryView } from "src/core/db3/server/db3QueryCore";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { executeDB3Command } from "src/core/db3/server/db3CommandCore";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, grants: readonly Permission[] = [Permission.view_users_basic_info]) {
    const role = await tx.bandRole.create({ data: {
        publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
        bandRolePermissions: { create: (await tx.permission.findMany({ where: { name: { in: [...grants] } } }))
            .map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) },
    } });
    const band = fixture.bands[0]!;
    const membership = await tx.bandUser.update({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } }, data: { bandRoleId: role.id } });
    const auth = await authorization.loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(band.publicId));
    const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
    const read = async (personPublicId = person.publicId) => queryView({
        view: bandUserProfileView, filter: { tableParams: { personPublicId } }, cmdbQueryContext: "profile fixture",
    }, auth, await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
    const search = async (overrides: Partial<Parameters<typeof DB3PaginatedQueryCore>[0]> = {}) => DB3PaginatedQueryCore({
        table: { tableID: bandUserProfileView.tableID, tableName: bandUserProfileView.tableName, viewID: bandUserProfileView.viewID },
        filter: {}, orderBy: { user: "asc" }, skip: 0, take: 20, cmdbQueryContext: "directory fixture", ...overrides,
    }, auth, await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
    const addMember = async (name: string, index = 0) => {
        const user = await tx.user.create({ data: { publicId: generatePublicId(), name, email: `${generatePublicId()}@test.invalid`, phone: "secret-phone" } });
        const member = await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[index]!.id, userId: user.id } });
        return { user, member };
    };
    return { role, membership, auth, person, read, search, addMember };
}

describe.skipIf(!settingsMysqlTestUrl)("member profiles and directory on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasources: { db: { url: settingsMysqlTestUrl } } }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    afterEach(() => { vi.restoreAllMocks(); });
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database!, work);

    it("reads the same person through distinct memberships, roles and assignment identities", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const identities: string[] = [];
        for (const band of fixture.bands) {
            const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } } });
            const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: band.id } });
            const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id, functionalGroupId: group.id } });
            const tag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: band.id } });
            await tx.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: member.id, bandInstrumentId: instrument.id, isPrimary: true } });
            await tx.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserId: member.id, bandUserTagId: tag.id } });
            const auth = await authorization.loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(band.publicId));
            const result = await queryView({ view: bandUserProfileView, filter: { tableParams: { personPublicId: context.person.publicId } }, cmdbQueryContext: "two-band profile" },
                auth, await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
            const row = result.items[0]!;
            identities.push(row.publicId);
            expect(row).toMatchObject({ publicId: member.publicId, userId: context.person.publicId, bandRoleId: band.id === fixture.bands[0]!.id ? context.role.publicId : null,
                user: { publicId: context.person.publicId, name: context.person.name, email: context.person.email },
                bandUserInstruments: [{ bandInstrumentId: instrument.publicId, isPrimary: true }], bandUserTagAssignments: [{ bandUserTagId: tag.publicId }] });
            expect(JSON.stringify(row)).not.toMatch(/"(?:id|bandId|bandUserId|globalRoleId|hashedPassword|uid|calendarFeedToken)":/);
        }
        expect(new Set(identities).size).toBe(2);
    }));

    it("redacts other people's contact data and prevents contact probes through filtering or sorting", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const target = await context.addMember("Other member");
        const row = (await context.read(target.user.publicId)).items[0]!;
        expect(row.user).toEqual({ publicId: target.user.publicId, name: target.user.name });
        expect(row).not.toHaveProperty("createdAt");
        expect((await context.read()).items[0]!.user.email).toBe(context.person.email);
        for (const token of [target.user.email, "secret-phone"]) {
            expect(await context.search({ filter: { quickFilterValues: [token] } })).toMatchObject({ items: [], count: 0 });
        }
        await expect(context.search({ orderBy: { email: "asc" } })).rejects.toThrow();
        await expect(context.search({ orderBy: { createdAt: "asc" } })).rejects.toThrow();
        const contact = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_user_contact_info } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: context.role.id, permissionId: contact.id } });
        expect((await context.read(target.user.publicId)).items[0]!.user).toMatchObject({ email: target.user.email, phone: target.user.phone });
    }));

    it("restricts roleless members to their own profile and excludes outsiders and other-band people", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture, [Permission.search_users]);
        const target = await context.addMember("Other member");
        const foreign = await context.addMember("Other band", 1);
        expect((await context.read()).items).toHaveLength(1);
        expect((await context.read(target.user.publicId)).items).toEqual([]);
        expect((await context.read(foreign.user.publicId)).items).toEqual([]);
        expect(await context.search()).toMatchObject({ count: 1 });
        const outsider = await authorization.loadAuthorizationForUser(foreign.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        const result = await queryView({ view: bandUserProfileView, filter: {}, cmdbQueryContext: "outsider directory" }, outsider,
            await bindDB3ReadSnapshot(tx, outsider, { isolationLevel: "Serializable" }));
        expect(result.items).toEqual([]);
        const noBand = await authorization.loadAuthorizationForUser(fixture.user, tx);
        await expect(queryView({ view: bandUserProfileView, filter: {}, cmdbQueryContext: "missing band" }, noBand,
            await bindDB3ReadSnapshot(tx, noBand, { isolationLevel: "Serializable" }))).rejects.toThrow();
    }));

    it("omits inactive memberships and deleted or merged people from both rows and totals", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const target = await context.addMember("Inactive member");
        for (const state of ["membership", "deleted", "merged"] as const) {
            await tx.bandUser.update({ where: { id: target.member.id }, data: { isDeleted: state === "membership" } });
            await tx.user.update({ where: { id: target.user.id }, data: { isDeleted: state === "deleted", mergedIntoUserId: state === "merged" ? fixture.user.id : null } });
            expect((await context.read(target.user.publicId)).items).toEqual([]);
            expect(await context.search()).toMatchObject({ count: 1 });
        }
        await expect(context.search({ includeDeleted: true })).rejects.toThrow();
    }));

    it("filters names by every token and pages stable ascending/descending display-name order", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        await tx.user.update({ where: { id: fixture.user.id }, data: { name: "Zulu" } });
        const first = await context.addMember("Alice Alpha");
        const second = await context.addMember("Alice Alpha");
        // Fixed ties make the expected order independent of random ID case and database collation.
        await tx.bandUser.update({ where: { id: first.member.id }, data: { publicId: "Member0000000001" } });
        await tx.bandUser.update({ where: { id: second.member.id }, data: { publicId: "Member0000000002" } });
        await context.addMember("Bob Beta");
        await context.addMember("Foreign Alpha", 1);
        const all = await context.search();
        const ids = all.items.map(item => bandUserProfileView.parseDto(item).publicId);
        expect(ids.slice(0, 2)).toEqual(["Member0000000001", "Member0000000002"]);
        expect(all.count).toBe(4);
        const page = await context.search({ skip: 1, take: 1 });
        expect(page).toMatchObject({ count: 4, hasMore: true, nextPage: { skip: 2, take: 1 } });
        expect(page.items[0]!.publicId).toBe(ids[1]);
        expect((await context.search({ orderBy: { user: "desc" }, take: 1 })).items[0]!.user.name).toBe("Zulu");
        expect(await context.search({ filter: { quickFilterValues: ["alice", "alpha"] } })).toMatchObject({ count: 2 });
        expect(await context.search({ filter: { quickFilterValues: ["alice", "beta"] } })).toMatchObject({ count: 0 });
    }));

    it("sorts membership join dates for managers rather than shared-account creation dates", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture, [Permission.manage_users, Permission.view_users_basic_info]);
        const target = await context.addMember("Recent account, old membership");
        await tx.bandUser.update({ where: { id: target.member.id }, data: { createdAt: new Date("2000-01-01T00:00:00Z") } });
        expect((await context.search({ orderBy: { createdAt: "asc" }, take: 1 })).items[0]).toMatchObject({ publicId: target.member.publicId, createdAt: new Date("2000-01-01T00:00:00Z") });
    }));

    it("combines role, instrument and tag predicates using same-band public identities", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const target = await context.addMember("Tagged musician");
        const bandId = fixture.bands[0]!.id;
        const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId } });
        const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId, functionalGroupId: group.id } });
        const tag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId } });
        const foreignTag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id } });
        await tx.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: target.member.id, bandInstrumentId: instrument.id } });
        await tx.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserId: target.member.id, bandUserTagId: tag.id } });
        expect(await context.search({ filter: { tableParams: { roleId: null, tagId: tag.publicId, instrumentId: instrument.publicId } } })).toMatchObject({ count: 1, items: [{ publicId: target.member.publicId }] });
        expect(await context.search({ filter: { tableParams: { roleId: context.role.publicId, tagId: tag.publicId } } })).toMatchObject({ count: 0 });
        await expect(context.search({ filter: { tableParams: { tagId: foreignTag.publicId } } })).rejects.toThrow();
        await tx.bandUserTag.update({ where: { id: tag.id }, data: { isHidden: true } });
        expect((await context.read(target.user.publicId)).items[0]!.bandUserTagAssignments).toMatchObject([{ bandUserTagId: tag.publicId }]);
        await expect(context.search({ filter: { tableParams: { tagId: tag.publicId } } })).rejects.toThrow();
    }));

    it("updates shared name and phone through self service without changing any memberships, auditing once", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture, []);
        const before = await tx.bandUser.findMany({ where: { userId: fixture.user.id } });
        const edit = { membershipId: xBandUser.parseIdentity(context.membership.publicId), name: "  New shared name  ", phone: " +32 123 " };
        expect(await editBandUserProfile(tx, context.auth, edit)).toMatchObject({ personId: context.person.publicId, membershipId: context.membership.publicId });
        expect(await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).toMatchObject({ name: "New shared name", phone: "+32 123", email: context.person.email });
        expect(await tx.bandUser.findMany({ where: { userId: fixture.user.id } })).toEqual(before);
        const audits = await tx.change.findMany({ where: { table: "User", recordId: fixture.user.id } });
        expect(audits).toHaveLength(1);
        await editBandUserProfile(tx, context.auth, edit);
        expect(await tx.change.count({ where: { table: "User", recordId: fixture.user.id } })).toBe(1);
        await editBandUserProfile(tx, context.auth, { membershipId: edit.membershipId, name: "Only name" });
        expect((await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).phone).toBe("+32 123");
        await editBandUserProfile(tx, context.auth, { ...edit, phone: "" });
        expect((await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).phone).toBeNull();
        const other = await authorization.loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        expect((await queryView({ view: bandUserProfileView, filter: {}, cmdbQueryContext: "shared profile update" }, other,
            await bindDB3ReadSnapshot(tx, other, { isolationLevel: "Serializable" }))).items[0]!.user.name).toBe("New shared name");
    }));

    it("rejects another person's edit by band managers while allowing platform user administration", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture, [Permission.manage_users, Permission.view_users_basic_info]);
        const target = await context.addMember("Other person");
        const foreign = await context.addMember("Other band", 1);
        const edit = { membershipId: xBandUser.parseIdentity(target.member.publicId), name: "Platform edit", phone: null };
        await expect(editBandUserProfile(tx, context.auth, edit)).rejects.toThrow(Permission.manage_global_users);
        expect((await tx.user.findUniqueOrThrow({ where: { id: target.user.id } })).name).toBe(target.user.name);
        expect(await tx.change.count()).toBe(0);
        const admin = await authorization.loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        await editBandUserProfile(tx, admin, edit);
        expect((await tx.user.findUniqueOrThrow({ where: { id: target.user.id } })).name).toBe(edit.name);
        await expect(editBandUserProfile(tx, admin, { ...edit, membershipId: xBandUser.parseIdentity(foreign.member.publicId) })).rejects.toThrow();
        await tx.bandUser.update({ where: { id: target.member.id }, data: { isDeleted: true } });
        await expect(editBandUserProfile(tx, admin, edit)).rejects.toThrow();
    }));

    it("refreshes platform grants at the shared endpoint and rejects stale authority before writing", () => withFixture(async (tx, fixture) => {
        const context = await prepare(tx, fixture);
        const target = await context.addMember("Other person");
        const admin = await authorization.loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        await tx.user.update({ where: { id: fixture.admin.id }, data: { globalRoleId: null } });
        vi.spyOn(authorization, "loadAuthorization").mockResolvedValue(admin);
        // Only the mocked outer loader consumes session; the endpoint refresh uses real persisted grants.
        const ctx = { session: {} } as AuthenticatedCtx;
        await expect(executeDB3Command({ commandID: bandUserProfileCommand.commandID,
            payload: { membershipId: target.member.publicId, name: "Forged edit" } },
        getDB3CommandHandler(bandUserProfileCommand.commandID), ctx, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId))).rejects.toThrow(Permission.manage_global_users);
        expect((await tx.user.findUniqueOrThrow({ where: { id: target.user.id } })).name).toBe(target.user.name);
        expect(await tx.change.count()).toBe(0);
    }));
});
