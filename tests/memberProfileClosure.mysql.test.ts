import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { readUserManagementCapabilities } from "src/auth/server/userManagementCapabilitiesRead";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { userEditorView } from "src/core/db3/shared/entities/user/userViews";
import { platformUserEditorView } from "src/core/db3/shared/entities/user/platformUser";
import { bandUserProfileView } from "src/core/db3/shared/entities/user/bandUserProfile";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture } from "./support/settingsMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("profile closure on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });

    it("keeps self-service shared fields available without a band or active membership", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const person = await tx.user.update({ where: { id: fixture.user.id }, data: { phone: "+32 123" } });
        await tx.bandUser.updateMany({ where: { userId: person.id }, data: { isDeleted: true } });
        const auth = await loadAuthorizationForUser(person, tx, null);
        expect(auth.band).toBeNull();
        const result = await queryView({ view: userEditorView, bandPublicId: null, filter: { publicIds: [parsePublicId<"User">(person.publicId)] }, cmdbQueryContext: "unscoped self profile" },
            auth, await snapshot(tx, auth));
        expect(result.items).toEqual([{ publicId: person.publicId, name: person.name, email: person.email, phone: person.phone, cssClass: person.cssClass }]);
        expect(JSON.stringify(result)).not.toMatch(/hashedPassword|globalRoleId|bandUser|calendarFeedToken|"id":/);
        await executeCatalogCrud(tx, auth, userEditorView, { name: "Self-service name", phone: null }, parsePublicId<"User">(person.publicId));
        expect(await tx.user.findUniqueOrThrow({ where: { id: person.id } })).toMatchObject({ name: "Self-service name", phone: null });
    }));

    it("changes only shared fields, preserving both memberships, settings and credentials with a User audit", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const memberships = await tx.bandUser.findMany({ where: { userId: person.id }, orderBy: { id: "asc" } });
        const signIn = await tx.userSignInMethod.create({ data: { publicId: generatePublicId(), userId: person.id, type: "email", identifier: person.email } });
        const preference = await tx.userSetting.create({ data: { userId: person.id, name: "calendar.showDeclinedEvents", value: false } });
        const auth = await loadAuthorizationForUser(person, tx, null);
        await executeCatalogCrud(tx, auth, userEditorView, { name: "Updated shared name", phone: "+32 456" }, parsePublicId<"User">(person.publicId));
        expect(await tx.bandUser.findMany({ where: { userId: person.id }, orderBy: { id: "asc" } })).toEqual(memberships);
        expect(await tx.userSignInMethod.findUnique({ where: { id: signIn.id } })).toEqual(signIn);
        expect(await tx.userSetting.findUnique({ where: { id: preference.id } })).toEqual(preference);
        const updated = await tx.user.findUniqueOrThrow({ where: { id: person.id } });
        expect(updated).toEqual({ ...person, name: "Updated shared name", phone: "+32 456" });
        expect(await tx.change.findMany({ where: { table: "User", recordId: person.id } })).toHaveLength(1);
    }));

    it("does not turn self-service into another-account, contact, credential or privilege editing", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const target = await tx.user.create({ data: { publicId: generatePublicId(), name: "Private account", email: "private@test.invalid" } });
        const auth = await loadAuthorizationForUser(person, tx, null);
        expect((await queryView({ view: userEditorView, filter: { publicIds: [parsePublicId<"User">(target.publicId)] }, cmdbQueryContext: "self-profile target probe" },
            auth, await snapshot(tx, auth))).items).toEqual([]);
        await expect(executeCatalogCrud(tx, auth, userEditorView, { name: "Forged" }, parsePublicId<"User">(target.publicId))).rejects.toThrow();
        for (const patch of [{ email: "forged@test.invalid" }, { isSysAdmin: true }, { isDeleted: true }, { cssClass: "forged" }]) {
            await expect(executeCatalogCrud(tx, auth, userEditorView, patch, parsePublicId<"User">(person.publicId))).rejects.toThrow();
        }
        expect(await tx.user.findUniqueOrThrow({ where: { id: person.id } })).toEqual(person);
    }));

    it.each(["deactivated", "merged"] as const)("rejects a freshly %s actor's captured self-profile read and edit", state => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const auth = await loadAuthorizationForUser(person, tx, null);
        const context = await snapshot(tx, auth);
        await tx.user.update({ where: { id: person.id }, data: state === "deactivated" ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
        await expect(queryView({ view: userEditorView, filter: { publicIds: [parsePublicId<"User">(person.publicId)] }, cmdbQueryContext: "revoked self profile" },
            auth, context)).rejects.toThrow();
        await expect(executeCatalogCrud(tx, auth, userEditorView, { name: "Stale name" }, parsePublicId<"User">(person.publicId))).rejects.toThrow();
    }));

    it.each(["deactivated", "merged", "membership-free"] as const)("keeps %s targets inspectable only through the independent platform account profile", state => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const person = await tx.user.update({ where: { id: fixture.user.id }, data: state === "deactivated" ? { isDeleted: true }
            : state === "merged" ? { isDeleted: true, mergedIntoUserId: fixture.admin.id } : {} });
        if (state === "membership-free") {
            await tx.bandUser.deleteMany({ where: { userId: person.id } });
        }
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const context = await snapshot(tx, auth);
        const result = await queryView({ view: platformUserEditorView, bandPublicId: null, includeDeleted: true,
            filter: { publicIds: [parsePublicId<"User">(person.publicId)] }, cmdbQueryContext: "inactive account profile" }, auth, context);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({ publicId: person.publicId, name: person.name, isDeleted: person.isDeleted });
        const capabilities = await readUserManagementCapabilities(context, auth, parsePublicId<"User">(person.publicId), { routeLocale: "fr-BE" });
        expect(capabilities.canReactivate).toBe(state === "deactivated");
        expect(capabilities.mergedIntoUserId).toBe(state === "merged"
            ? (await tx.user.findUniqueOrThrow({ where: { id: fixture.admin.id } })).publicId : null);
        const scoped = await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        expect((await queryView({ view: bandUserProfileView, filter: { tableParams: { personPublicId: person.publicId } }, cmdbQueryContext: "inactive band profile" },
            scoped, await snapshot(tx, scoped))).items).toEqual([]);
    }));

    it("keeps a band manager's scoped profile access separate from inactive account administration", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        expect(auth.hasPermission(Permission.manage_users)).toBe(true);
        expect(auth.hasPermission(Permission.manage_global_users)).toBe(false);
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.admin.id } });
        await expect(queryView({ view: platformUserEditorView, includeDeleted: true, filter: { publicIds: [parsePublicId<"User">(person.publicId)] }, cmdbQueryContext: "band manager account profile" },
            auth, await snapshot(tx, auth))).rejects.toThrow();
    }));
});
