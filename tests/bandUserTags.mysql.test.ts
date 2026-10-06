import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { xBandUser } from "src/core/db3/shared/entities/user/bandUser";
import { bandUserTagView, xBandUserTag } from "src/core/db3/shared/entities/user/bandUserTagViews";
import { bandUserTagsCommand, bandUserTagsView } from "src/core/db3/shared/entities/user/bandUserTags";
import { editBandUserTags } from "src/core/db3/server/commands/bandUserTagsCommand";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { queryView, DB3PaginatedQueryCore } from "src/core/db3/server/db3QueryCore";
import { loadDashboardCatalogs } from "src/core/db3/server/db3DashboardCatalogs";
import { userTagDashboardView, createDashboardReferenceStore, registerDashboardReferences } from "src/core/db3/shared/references/dashboardReferences";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const text = (value: string, localeTag = "en-US") => ({ kind: "set", stringPublicId: null, localeTag, value });
const authorize = (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) =>
    loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));
const readSnapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) =>
    bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });

async function prepareFixture(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
    const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.manage_user_taxonomy, Permission.manage_users] } } });
    await tx.bandRolePermission.createMany({ data: permissions.map(permission => ({
        publicId: generatePublicId(), bandRoleId: member.bandRoleId!, permissionId: permission.id,
    })), skipDuplicates: true });
    const auth = await authorize(tx, fixture);
    const replace = (tagIds: readonly string[]) => editBandUserTags(tx, auth, {
        membershipId: xBandUser.parseIdentity(member.publicId), tagIds: tagIds.map(id => xBandUserTag.parseIdentity(id)),
    });
    const assignments = () => tx.bandUserTagAssignment.findMany({ where: { bandUserId: member.id }, orderBy: { publicId: "asc" } });
    const read = async () => queryView({ view: bandUserTagsView, filter: { publicIds: [xBandUser.parseIdentity(member.publicId)] },
        cmdbQueryContext: "member tag fixture" }, auth, await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
    return { auth, member, replace, assignments, read };
}

async function createTag(tx: Prisma.TransactionClient, auth: CMServerAuthorization, name: string) {
    const created = await executeCatalogCrud(tx, auth, bandUserTagView, { name: text(name), sortOrder: 0 });
    return tx.bandUserTag.findUniqueOrThrow({ where: { publicId: String(created.identity) } });
}

describe.skipIf(!settingsMysqlTestUrl)("member tags on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasources: { db: { url: settingsMysqlTestUrl } } }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database!, work);

    it("inherits global localized values and style, preserves empty overrides and invitation significance", () => withFixture(async (tx, fixture) => {
        const { auth } = await prepareFixture(tx, fixture);
        const name = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: {
            publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Global members",
        } } } });
        const description = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), format: "Markdown" } });
        const source = await tx.globalUserTag.create({ data: { publicId: generatePublicId(), nameId: name.id,
            descriptionId: description.id, sortOrder: 7, color: "blue", cssClass: "performers", significance: "DefaultInvitation" } });
        const services = createCommandRowServices(auth, tx);
        const opted = await services.optIn(xBandUserTag, source.publicId);
        expect((await services.optIn(xBandUserTag, source.publicId)).publicId).toBe(opted.publicId);
        const query = async () => queryView({ view: bandUserTagView, filter: { publicIds: [xBandUserTag.parseIdentity(opted.publicId)] },
            cmdbQueryContext: "tag inheritance" }, auth, await readSnapshot(tx, auth));
        const before = (await query()).items[0]!;
        expect(before).toMatchObject({ name: "Global members", color: "blue", sortOrder: 7, cssClass: "performers", significance: "DefaultInvitation" });
        const client = bandUserTagView.hydrate(before, createDashboardReferenceStore());
        await executeCatalogCrud(tx, auth, bandUserTagView, { color: xBandUserTag.fields.color.codec.encode(client.color), cssClass: "" }, client.publicId);
        await tx.globalUserTag.update({ where: { id: source.id }, data: { color: "red", cssClass: "changed", sortOrder: 9 } });
        expect((await query()).items[0]).toMatchObject({ color: "red", cssClass: "", sortOrder: 9, significance: "DefaultInvitation" });
        expect(await tx.bandUserTag.findUniqueOrThrow({ where: { publicId: opted.publicId } })).toMatchObject({ color: null, nameId: null, significance: null });
        await executeCatalogCrud(tx, auth, bandUserTagView, { cssClass: null }, client.publicId);
        expect((await query()).items[0]!.cssClass).toBe("changed");
        for (const patch of [{ significance: "changed" }, { bandId: fixture.bands[1]!.id }, { globalUserTagId: source.id }, { color: "invalid" }, { sortOrder: 1.5 }]) {
            await expect(executeCatalogCrud(tx, auth, bandUserTagView, patch, client.publicId)).rejects.toThrow();
        }
        expect(await tx.globalUserTag.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ significance: "DefaultInvitation" });
    }));

    it("uses resolved names for filtering, ordering, counts and pages with isolated dashboard references", () => withFixture(async (tx, fixture) => {
        const { auth } = await prepareFixture(tx, fixture);
        const tags = await Promise.all([createTag(tx, auth, "English A"), createTag(tx, auth, "English B")]);
        for (const tag of tags) {
            await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: tag.nameId!,
                bandId: tag.bandId, localeId: fixture.frenchId, indexedValue: "Musiciens" } });
        }
        const input = { table: { tableID: xBandUserTag.tableID, tableName: xBandUserTag.tableName, viewID: bandUserTagView.viewID },
            routeLocale: "fr-BE", filter: { quickFilterValues: ["musici"] }, orderBy: { name: "asc" }, take: 1, cmdbQueryContext: "tag pages" };
        const first = await DB3PaginatedQueryCore({ ...input, skip: 0 }, auth, await readSnapshot(tx, auth));
        const second = await DB3PaginatedQueryCore({ ...input, skip: 1 }, auth, await readSnapshot(tx, auth));
        expect(first).toMatchObject({ count: 2, hasMore: true });
        expect(second).toMatchObject({ count: 2, hasMore: false });
        expect([first.items[0]!.publicId, second.items[0]!.publicId]).toEqual(tags.map(tag => tag.publicId).sort());
        const french = await loadDashboardCatalogs(await readSnapshot(tx, auth), auth, { routeLocale: "fr-BE" });
        expect(french.userTag.map(tag => tag.name)).toEqual(["Musiciens", "Musiciens"]);
        const store = createDashboardReferenceStore();
        const hydrated = french.userTag.map(dto => userTagDashboardView.hydrate(dto, store));
        registerDashboardReferences(store, { userTag: hydrated });
        expect(store.get(xBandUserTag, hydrated[0]!.publicId)).toBe(hydrated[0]);
        const english = await loadDashboardCatalogs(await readSnapshot(tx, auth), auth, { routeLocale: "en-US" });
        expect(english.userTag.map(tag => tag.name)).toEqual(["English A", "English B"]);
        const other = await authorize(tx, fixture, 1);
        expect((await loadDashboardCatalogs(await readSnapshot(tx, other), other, { routeLocale: "fr-BE" })).userTag).toEqual([]);
        for (const row of french.userTag) {
            expect(row).not.toHaveProperty("id");
            expect(row).not.toHaveProperty("bandId");
            expect(row).not.toHaveProperty("nameId");
        }
    }));

    it("keeps assignments on independent memberships and projects only public identities", () => withFixture(async (tx, fixture) => {
        const context = await prepareFixture(tx, fixture);
        const tag = await createTag(tx, context.auth, "Performers");
        const otherMember = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } } });
        await tx.bandUser.update({ where: { id: otherMember.id }, data: { bandRoleId: context.member.bandRoleId } });
        const otherAuth = await authorize(tx, fixture, 1);
        const otherTag = await createTag(tx, otherAuth, "Volunteers");
        await context.replace([tag.publicId]);
        await editBandUserTags(tx, otherAuth, { membershipId: xBandUser.parseIdentity(otherMember.publicId), tagIds: [xBandUserTag.parseIdentity(otherTag.publicId)] });
        const result = await context.read();
        expect(result.items[0]).toMatchObject({ publicId: context.member.publicId,
            bandUserTagAssignments: [{ bandUserTagId: tag.publicId }] });
        expect(JSON.stringify(result.items)).not.toMatch(/"(?:id|bandId|bandUserId)":/);
        await context.replace([]);
        expect(await context.assignments()).toEqual([]);
        expect(await tx.bandUserTagAssignment.findMany({ where: { bandUserId: otherMember.id } })).toMatchObject([{ bandUserTagId: otherTag.id }]);
    }));

    it("retains hidden assignments and no-op identities while rejecting hidden additions and cross-band links", () => withFixture(async (tx, fixture) => {
        const context = await prepareFixture(tx, fixture);
        const first = await createTag(tx, context.auth, "Assigned");
        const hidden = await createTag(tx, context.auth, "Hidden new tag");
        await context.replace([first.publicId]);
        const original = await context.assignments();
        await tx.bandUserTag.updateMany({ where: { id: { in: [first.id, hidden.id] } }, data: { isHidden: true } });
        const audits = await tx.change.count();
        await context.replace([first.publicId]);
        expect(await context.assignments()).toEqual(original);
        expect(await tx.change.count()).toBe(audits);
        expect((await context.read()).items[0]!.bandUserTagAssignments).toHaveLength(1);
        expect((await loadDashboardCatalogs(await readSnapshot(tx, context.auth), context.auth, {})).userTag).toHaveLength(2);
        const taxonomy = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_user_taxonomy } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: context.member.bandRoleId!, permissionId: taxonomy.id } });
        // The original grant snapshot still includes taxonomy; dashboard execution must refresh it.
        expect((await loadDashboardCatalogs(await readSnapshot(tx, context.auth), context.auth, {})).userTag).toEqual([]);
        await expect(context.replace([first.publicId, hidden.publicId])).rejects.toThrow("was not found");
        const foreign = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id } });
        await expect(context.replace([foreign.publicId])).rejects.toThrow("was not found");
        await tx.bandUserTagAssignment.create({ data: { publicId: generatePublicId(), bandUserId: context.member.id, bandUserTagId: foreign.id } });
        expect((await context.read()).items[0]!.bandUserTagAssignments).toHaveLength(1);
        await expect(context.replace([])).rejects.toThrow();
        expect(await context.assignments()).toHaveLength(2);
    }));

    it("separates taxonomy authority from manager assignments and denies owner self-service with refreshed grants", () => withFixture(async (tx, fixture) => {
        const context = await prepareFixture(tx, fixture);
        const tag = await createTag(tx, context.auth, "Managers only");
        await context.replace([tag.publicId]);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_users } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: context.member.bandRoleId!, permissionId: permission.id } });
        const taxonomyOnly = await context.auth.refresh(tx);
        expect(taxonomyOnly.hasPermission(Permission.manage_user_taxonomy)).toBe(true);
        await expect(editBandUserTags(tx, taxonomyOnly, { membershipId: xBandUser.parseIdentity(context.member.publicId), tagIds: [] })).rejects.toThrow();
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: context.member.bandRoleId!, permissionId: permission.id } });
        const taxonomyPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_user_taxonomy } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: context.member.bandRoleId!, permissionId: taxonomyPermission.id } });
        const managerOnly = await context.auth.refresh(tx);
        expect(managerOnly.hasPermission(Permission.manage_user_taxonomy)).toBe(false);
        const person = await tx.user.create({ data: { publicId: generatePublicId(), name: "Other member", email: "manager-tags@test.invalid" } });
        const member = await tx.bandUser.create({ data: { publicId: generatePublicId(), userId: person.id, bandId: context.member.bandId } });
        await editBandUserTags(tx, managerOnly, { membershipId: xBandUser.parseIdentity(member.publicId), tagIds: [xBandUserTag.parseIdentity(tag.publicId)] });
        expect(await tx.bandUserTagAssignment.findMany({ where: { bandUserId: member.id } })).toMatchObject([{ bandUserTagId: tag.id }]);
        await expect(executeCatalogCrud(tx, managerOnly, bandUserTagView, { isHidden: true }, tag.publicId)).rejects.toThrow();
        await tx.bandUser.update({ where: { id: context.member.id }, data: { bandRoleId: null } });
        const owner = await context.auth.refresh(tx);
        expect((await context.read()).items[0]!.bandUserTagAssignments).toHaveLength(1);
        const handler = getDB3CommandHandler(bandUserTagsCommand.commandID);
        await expect(handler.execute({ membershipId: xBandUser.parseIdentity(context.member.publicId), tagIds: [] }, {
            authorization: owner, transaction: tx, rowServices: createCommandRowServices(owner, tx),
        })).rejects.toThrow();
        await expect(executeCatalogCrud(tx, owner, bandUserTagView, { isHidden: true }, tag.publicId)).rejects.toThrow();
        await expect(queryView({ view: bandUserTagView, filter: { tableParams: { includeHidden: true } },
            cmdbQueryContext: "denied hidden list" }, owner, await readSnapshot(tx, owner))).rejects.toThrow();
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(editBandUserTags(tx, platform, { membershipId: xBandUser.parseIdentity(context.member.publicId), tagIds: [] })).rejects.toThrow();
    }));

    it("rejects other memberships and inactive or merged people before mutation", () => withFixture(async (tx, fixture) => {
        const context = await prepareFixture(tx, fixture);
        const otherMember = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } } });
        await expect(editBandUserTags(tx, context.auth, { membershipId: xBandUser.parseIdentity(otherMember.publicId), tagIds: [] })).rejects.toThrow("cannot be edited");
        const person = await tx.user.create({ data: { publicId: generatePublicId(), name: "Member", email: "tag-member@test.invalid" } });
        const member = await tx.bandUser.create({ data: { publicId: generatePublicId(), userId: person.id, bandId: fixture.bands[0]!.id } });
        const edit = { membershipId: xBandUser.parseIdentity(member.publicId), tagIds: [] };
        await editBandUserTags(tx, context.auth, edit);
        await tx.bandUser.update({ where: { id: member.id }, data: { isDeleted: true } });
        await expect(editBandUserTags(tx, context.auth, edit)).rejects.toThrow("cannot be edited");
        await tx.bandUser.update({ where: { id: member.id }, data: { isDeleted: false } });
        await tx.user.update({ where: { id: person.id }, data: { isDeleted: true } });
        await expect(editBandUserTags(tx, context.auth, edit)).rejects.toThrow("cannot be edited");
        await tx.user.update({ where: { id: person.id }, data: { isDeleted: false, mergedIntoUserId: fixture.user.id } });
        await expect(editBandUserTags(tx, context.auth, edit)).rejects.toThrow("cannot be edited");
    }));

    it("keeps association changes and audits in one rollback transaction", async () => {
        const beforeAssignments = await database!.bandUserTagAssignment.count();
        const beforeAudits = await database!.change.count();
        await withFixture(async (tx, fixture) => {
            const context = await prepareFixture(tx, fixture);
            const first = await createTag(tx, context.auth, "First");
            const second = await createTag(tx, context.auth, "Second");
            const audits = await tx.change.count();
            await context.replace([first.publicId, second.publicId]);
            const changes = await tx.change.findMany({ where: { table: "bandUserTagAssignment" }, orderBy: { id: "asc" } });
            expect(await tx.change.count()).toBe(audits + 2);
            expect(changes).toHaveLength(2);
            expect(new Set(changes.map(change => change.operationId)).size).toBe(1);
            await context.replace([]);
            expect(await tx.change.count()).toBe(audits + 4);
        });
        expect(await database!.bandUserTagAssignment.count()).toBe(beforeAssignments);
        expect(await database!.change.count()).toBe(beforeAudits);
    });
});
