import { beforeEach, describe, expect, it, vi } from "vitest";

// Vitest hoists the factory, so its mocked database must be loaded here.
vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { DefaultRolePermissionAssignments } from "shared/defaultRolePermissionAssignments";
import { Permission } from "shared/permissions";
import getUser from "src/core/db3/queries/getUser";
import getUserExtraInfo from "src/core/db3/queries/getUserExtraInfo";
import db3queries from "src/core/db3/queries/db3queries";
import { bandUserProfileView } from "src/core/db3/shared/entities/user/bandUserProfile";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { readFixtureBandId, readFixtureMembershipId, scopedReadFixture } from "./support/scopedReadFixture";
import { invokeResolver } from "./support/resolverHarness";

const owner = createAuthorizationTestUser("normal", { id: 1201, name: "Profile owner", phone: "+32 100" });
const target = createAuthorizationTestUser("normal", { id: 1202, name: "Directory target", phone: "+32 200" });
const basicViewer = createAuthorizationTestUser("normal", { id: 1203 });
const contactViewer = createAuthorizationTestUser("normal", { id: 1204 });
const userManager = createAuthorizationTestUser("bandAdmin", { id: 1205 });
const sysadmin = createAuthorizationTestUser("sysadmin", { id: 1206 });
const fixture = scopedReadFixture([
    { user: owner, permissions: [] },
    { user: target, permissions: [] },
    { user: basicViewer, permissions: [Permission.view_users_basic_info] },
    { user: contactViewer, permissions: [Permission.view_users_basic_info, Permission.view_user_contact_info] },
    { user: userManager, permissions: [Permission.view_users_basic_info, Permission.view_user_contact_info, Permission.manage_users] },
    { user: sysadmin, permissions: [] },
]);
const instrumentId = "BandInstrument21";
const tagId = "BandUserTag00022";

async function queryProfileAs(actor: typeof owner, person = target) {
    return invokeResolver(db3queries, {
        table: { tableID: bandUserProfileView.tableID, tableName: bandUserProfileView.tableName, viewID: bandUserProfileView.viewID },
        filter: { tableParams: { personPublicId: person.publicId } },
        bandPublicId: readFixtureBandId, cmdbQueryContext: "member visibility regression",
    }, createAuthorizationTestContext(actor));
}

function expectNoAccountSecrets(value: unknown) {
    expect(JSON.stringify(value)).not.toMatch(/"(?:id|bandId|bandUserId|globalRoleId|isSysAdmin|roleId|role|signInMethods|hashedPassword|calendarFeedToken)":/);
}

describe("membership profile data visibility", () => {
    beforeEach(() => {
        authorizationTestDb.reset({
            ...fixture,
            user: fixture.user.map(user => ({ ...user, hashedPassword: "secret-password-hash" })),
            bandInstrument: [{ id: 21, publicId: instrumentId, bandId: 1, isHidden: false }],
            bandUserTag: [{ id: 22, publicId: tagId, bandId: 1, isHidden: false }],
            bandUserInstrument: [{ id: 11, publicId: "BandUserInstr011", bandUserId: target.id, bandInstrumentId: 21, isPrimary: true }],
            bandUserTagAssignment: [{ id: 12, publicId: "BandUserTagAs012", bandUserId: target.id, bandUserTagId: 22 }],
            userSignInMethod: [{ id: 2, publicId: "SignInMethod0002", userId: target.id, createdAt: new Date(), type: "google", identifier: "target-google", displayId: "target-google@example.com" }],
        });
    });

    it("lets a roleless member read their own shared contact data through their membership", async () => {
        await authorizationTestDb.getDelegate("bandUser").update({ where: { id: owner.id }, data: { bandRoleId: null } });
        const result = await queryProfileAs(owner, owner);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({
            publicId: readFixtureMembershipId(owner.id), userId: owner.publicId,
            user: { publicId: owner.publicId, name: owner.name, email: owner.email, phone: owner.phone },
            bandRoleId: null, bandUserInstruments: [], bandUserTagAssignments: [],
        });
        expect(result.items[0]).not.toHaveProperty("createdAt");
        expectNoAccountSecrets(result.items[0]);
    });

    it("does not let login or search_users alone reveal another member", async () => {
        const permission = fixture.permission.find(item => item.name === Permission.search_users)!;
        await authorizationTestDb.getDelegate("bandRolePermission").create({ data: { bandRoleId: owner.id, permissionId: permission.id } });
        expect((await queryProfileAs(owner)).items).toEqual([]);
        await expect(invokeResolver(getUser, { userId: target.publicId, bandPublicId: readFixtureBandId },
            createAuthorizationTestContext(owner))).resolves.toBeNull();
    });

    it("returns basic identity and public membership assignment references without contact fields", async () => {
        const result = (await queryProfileAs(basicViewer)).items[0]!;
        expect(result).toMatchObject({
            publicId: readFixtureMembershipId(target.id), userId: target.publicId,
            user: { publicId: target.publicId, name: target.name },
            bandUserInstruments: [{ publicId: "BandUserInstr011", bandInstrumentId: instrumentId, isPrimary: true }],
            bandUserTagAssignments: [{ publicId: "BandUserTagAs012", bandUserTagId: tagId }],
        });
        expect(result.user).not.toHaveProperty("email");
        expect(result.user).not.toHaveProperty("phone");
        expect(result).not.toHaveProperty("createdAt");
        expectNoAccountSecrets(result);
    });

    it("adds contact fields only with the selected band's view_user_contact_info grant", async () => {
        const result = (await queryProfileAs(contactViewer)).items[0]!;
        expect(result.user).toEqual({ publicId: target.publicId, name: target.name, email: target.email, phone: target.phone });
        expectNoAccountSecrets(result);
    });

    it("gives band managers membership bookkeeping without exposing shared account administration", async () => {
        const result = (await queryProfileAs(userManager)).items[0]!;
        expect(result).toMatchObject({
            publicId: readFixtureMembershipId(target.id), createdAt: fixture.bandUser[0]!.createdAt,
            user: { publicId: target.publicId, name: target.name, email: target.email, phone: target.phone },
        });
        expect(result.user).not.toHaveProperty("createdAt");
        expectNoAccountSecrets(result);
    });

    it("requires a selected band and does not treat the session's cached grants as authority", async () => {
        await expect(invokeResolver(db3queries, {
            table: { tableID: bandUserProfileView.tableID, tableName: bandUserProfileView.tableName, viewID: bandUserProfileView.viewID },
            filter: {}, cmdbQueryContext: "unscoped membership",
        }, createAuthorizationTestContext(basicViewer))).rejects.toThrow();
        await authorizationTestDb.getDelegate("bandRolePermission").deleteMany({ where: { bandRoleId: basicViewer.id } });
        expect((await queryProfileAs(basicViewer)).items).toEqual([]);
    });

    it.each(["inactive", "deleted", "merged"])("hides a target with %s membership/account state", async state => {
        if (state === "inactive") {
            await authorizationTestDb.getDelegate("bandUser").update({ where: { id: target.id }, data: { isDeleted: true } });
        } else {
            await authorizationTestDb.getDelegate("user").update({ where: { id: target.id },
                data: state === "deleted" ? { isDeleted: true } : { mergedIntoUserId: owner.id } });
        }
        expect((await queryProfileAs(basicViewer)).items).toEqual([]);
    });

    it("reserves shared-account sign-in summaries for fresh platform Sysadmin authority", async () => {
        for (const actor of [owner, basicViewer, userManager]) {
            await expect(invokeResolver(getUserExtraInfo, { userId: target.publicId }, createAuthorizationTestContext(actor))).rejects.toThrow();
        }
        await expect(invokeResolver(getUserExtraInfo, { userId: target.publicId }, createAuthorizationTestContext(sysadmin)))
            .resolves.toEqual({ signinMethods: [{ type: "google", displayId: "target-google@example.com" }] });
    });

    it("keeps search and basic-view distinct while assigning them to the same default roles", () => {
        const rolesWith = (permission: Permission) => DefaultRolePermissionAssignments
            .filter(([, assignedPermission]) => assignedPermission === permission)
            .map(([roleName]) => roleName).sort();
        expect(rolesWith(Permission.search_users)).toEqual(rolesWith(Permission.view_users_basic_info));
        expect(rolesWith(Permission.view_users_basic_info)).toEqual(["Admin", "Band Admin", "Editors", "Moderators", "Normal Users"]);
    });
});
