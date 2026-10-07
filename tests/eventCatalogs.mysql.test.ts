import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadSharedEventCatalogs } from "src/core/db3/server/db3DashboardCatalogs";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { DB3PaginatedQueryCore, queryView } from "src/core/db3/server/db3QueryCore";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { eventAttendanceEditorView, eventStatusEditorView, eventTypeEditorView, xEventAttendance } from "src/core/db3/shared/entities/event/eventCatalogs";
import { createDashboardReferenceStore, eventAttendanceDashboardView, eventStatusDashboardView, eventTypeDashboardView } from "src/core/db3/shared/references/dashboardReferences";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const text = (value: string, localeTag = "en-US", stringPublicId: string | null = null) => ({ kind: "set", value, localeTag, stringPublicId });

describe.skipIf(!settingsMysqlTestUrl)("shared event catalogs on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });

    async function catalogManager(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_global_catalogs } });
        const role = await tx.globalRole.create({ data: {
            publicId: generatePublicId(),
            name: { create: { publicId: generatePublicId(), values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Event catalog manager" } } } },
            permissions: { create: { publicId: generatePublicId(), permissionId: permission.id } },
        } });
        const user = await tx.user.create({ data: { publicId: generatePublicId(), name: "Catalog manager", email: "catalog@test.invalid", globalRoleId: role.id } });
        return { user, role, auth: await loadAuthorizationForUser(user, tx) };
    }

    async function createAttendance(tx: Prisma.TransactionClient, auth: CMServerAuthorization) {
        return executeCatalogCrud(tx, auth, eventAttendanceEditorView, {
            buttonCaption: text("Yes"), personalCaption: text("You are going"), pastCaption: text("Went"),
            personalPastCaption: text("You went"), description: text("**Attendance**"), strength: 100,
            sortOrder: 1, color: "green", iconName: "CheckCircleOutline", isActive: true,
        });
    }

    it("creates shared catalogs with only the platform catalog grant and audits global translations", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await catalogManager(tx, fixture);
        expect(auth.band).toBeNull();
        expect(auth.hasPermission(Permission.manage_global_localization)).toBe(false);
        const type = await executeCatalogCrud(tx, auth, eventTypeEditorView, { name: text("Concert"), description: text("Public concert"), significance: "Concert", sortOrder: 1 });
        const status = await executeCatalogCrud(tx, auth, eventStatusEditorView, { name: text("Confirmed"), description: text("Confirmed event"), significance: "FinalConfirmation", sortOrder: 1 });
        const attendance = await createAttendance(tx, auth);
        const catalogs = await loadSharedEventCatalogs(await snapshot(tx, auth), auth, { routeLocale: "en-US" });
        expect(catalogs.eventType).toEqual([expect.objectContaining({ publicId: type.identity, name: "Concert" })]);
        expect(catalogs.eventStatus).toEqual([expect.objectContaining({ publicId: status.identity, name: "Confirmed" })]);
        const option = catalogs.eventAttendance.find(row => row.publicId === attendance.identity)!;
        expect(option).toMatchObject({ buttonCaption: "Yes", personalCaption: "You are going", pastCaption: "Went", personalPastCaption: "You went", description: "**Attendance**", strength: 100 });
        const client = eventAttendanceDashboardView.hydrate(option, createDashboardReferenceStore());
        expect(client).toMatchObject({ buttonCaption: "Yes", description: "**Attendance**", color: { id: "green" } });
        const editor = eventAttendanceEditorView.hydrate(option, createDashboardReferenceStore());
        expect(xEventAttendance.getRowInfo(editor)).toMatchObject({ name: "Yes", iconName: "CheckCircleOutline", color: { id: "green" } });
        for (const row of [...catalogs.eventType, ...catalogs.eventStatus, ...catalogs.eventAttendance]) {
            expect(row).not.toHaveProperty("id");
            expect(row).not.toHaveProperty("nameId");
            expect(row).not.toHaveProperty("buttonCaptionId");
        }
        expect(await tx.bandDynamicLocalizedStringValue.count()).toBe(0);
        expect(await tx.change.count({ where: { table: "DynamicLocalizedStringValue", userId: auth.userId } })).toBe(9);
    }));

    it("updates an exact translation without copying fallback text or changing other languages", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await catalogManager(tx, fixture);
        const result = await executeCatalogCrud(tx, auth, eventStatusEditorView, { name: text("Confirmed"), description: text("Details") });
        const read = async (routeLocale: string) => (await queryView({ view: eventStatusEditorView, filter: { publicIds: [eventStatusEditorView.entity.parseIdentity(result.identity)] }, routeLocale, cmdbQueryContext: "event translation" }, auth, await snapshot(tx, auth))).items[0]!;
        const english = await read("en-US");
        await executeCatalogCrud(tx, auth, eventStatusEditorView, { name: text("Confirmé", "fr-BE", english.nameStringPublicId) }, result.identity);
        expect(await read("fr-BE")).toMatchObject({ name: "Confirmé", description: "Details", descriptionResolution: { localeTag: "en-US" } });
        expect(await read("en-US")).toMatchObject({ name: "Confirmed" });
        await executeCatalogCrud(tx, auth, eventStatusEditorView, { name: text("", "fr-BE", english.nameStringPublicId) }, result.identity);
        expect(await read("fr-BE")).toMatchObject({ name: "", nameResolution: { reason: "exact" } });
    }));

    it("filters, sorts and paginates by resolved names in the requested locale", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await catalogManager(tx, fixture);
        const first = await executeCatalogCrud(tx, auth, eventTypeEditorView, { name: text("Alpha"), description: text(""), sortOrder: 1 });
        const second = await executeCatalogCrud(tx, auth, eventTypeEditorView, { name: text("Zulu"), description: text(""), sortOrder: 1 });
        const rows = await queryView({ view: eventTypeEditorView, filter: {}, cmdbQueryContext: "event types" }, auth, await snapshot(tx, auth));
        for (const row of rows.items) {
            await executeCatalogCrud(tx, auth, eventTypeEditorView, { name: text(row.publicId === first.identity ? "Zulu français" : "Alpha français", "fr-BE", row.nameStringPublicId) }, row.publicId);
        }
        const table = { tableID: eventTypeEditorView.tableID, tableName: eventTypeEditorView.tableName, viewID: eventTypeEditorView.viewID };
        const page = await DB3PaginatedQueryCore({ table, routeLocale: "fr-BE", filter: { quickFilterValues: ["français"] }, orderBy: { name: "asc" }, skip: 0, take: 1, cmdbQueryContext: "localized event type page" }, auth, await snapshot(tx, auth));
        expect(page.count).toBe(2);
        expect(page.items).toEqual([expect.objectContaining({ publicId: second.identity, name: "Alpha français" })]);
    }));

    it("reads shared metadata for public visitors and keeps band translation overrides isolated", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const manager = await catalogManager(tx, fixture);
        const result = await executeCatalogCrud(tx, manager.auth, eventTypeEditorView, { name: text("Concert"), description: text("") });
        const type = await tx.eventType.findUniqueOrThrow({ where: { publicId: String(result.identity) } });
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: type.nameId, localeId: fixture.englishId, bandId: fixture.bands[0]!.id, indexedValue: "Band concert" } });
        const publicAuth = await loadAuthorizationForUser(null, tx);
        const bandAuth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        const otherAuth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        for (const [auth, name] of [[publicAuth, "Concert"], [bandAuth, "Band concert"], [otherAuth, "Concert"]] as const) {
            const catalogs = await loadSharedEventCatalogs(await snapshot(tx, auth), auth, { routeLocale: "en-US" });
            expect(catalogs.eventType[0]?.name).toBe(name);
            expect(eventTypeDashboardView.hydrate(catalogs.eventType[0]!, createDashboardReferenceStore()).name).toBe(name);
        }
    }));

    it("retains retired attendance for history while excluding it from default option queries", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await catalogManager(tx, fixture);
        const created = await createAttendance(tx, auth);
        await createCommandRowServices(auth, tx).delete(xEventAttendance, xEventAttendance.parseIdentity(created.identity), "softWhenPossible");
        const visitor = await loadAuthorizationForUser(null, tx);
        expect((await queryView({ view: eventAttendanceDashboardView, filter: {}, cmdbQueryContext: "selectable attendance" }, visitor, await snapshot(tx, visitor))).items).toEqual([]);
        const history = await loadSharedEventCatalogs(await snapshot(tx, visitor), visitor, {});
        expect(history.eventAttendance).toEqual([expect.objectContaining({ publicId: created.identity, isDeleted: true, buttonCaption: "Yes" })]);
        await executeCatalogCrud(tx, auth, eventAttendanceEditorView, { isDeleted: false, isActive: false }, created.identity);
        const restored = await queryView({ view: eventAttendanceDashboardView, filter: {}, cmdbQueryContext: "restored attendance" }, visitor, await snapshot(tx, visitor));
        expect(restored.items[0]).toMatchObject({ isDeleted: false, isActive: false, strength: 100 });
        expect(xEventAttendance.activeAsSelectable!(restored.items[0]!)).toBe(false);
    }));

    it("rejects band authority, selected-band global writes and revoked platform grants", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const manager = await catalogManager(tx, fixture);
        const created = await createAttendance(tx, manager.auth);
        const memberAuth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        await expect(executeCatalogCrud(tx, memberAuth, eventAttendanceEditorView, { strength: 0 }, created.identity)).rejects.toThrow();
        const selected = await loadAuthorizationForUser(manager.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        await expect(executeCatalogCrud(tx, selected, eventAttendanceEditorView, { strength: 0 }, created.identity)).rejects.toThrow();
        await tx.globalRolePermission.deleteMany({ where: { globalRoleId: manager.role.id } });
        await expect(executeCatalogCrud(tx, manager.auth, eventAttendanceEditorView, { strength: 0 }, created.identity)).rejects.toThrow();
        expect(await tx.eventAttendance.findUniqueOrThrow({ where: { publicId: String(created.identity) } })).toMatchObject({ strength: 100 });
    }));

    it("rejects another field's string identity, inheritance and disabled locales before writing", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await catalogManager(tx, fixture);
        const created = await createAttendance(tx, auth);
        const row = (await queryView({ view: eventAttendanceEditorView, filter: {}, cmdbQueryContext: "attendance editor" }, auth, await snapshot(tx, auth))).items[0]!;
        const count = await tx.dynamicLocalizedStringValue.count();
        await expect(executeCatalogCrud(tx, auth, eventAttendanceEditorView, { buttonCaption: text("Stolen", "en-US", row.descriptionStringPublicId) }, created.identity)).rejects.toThrow("does not belong");
        await expect(executeCatalogCrud(tx, auth, eventAttendanceEditorView, { buttonCaption: { kind: "inherit", stringPublicId: row.buttonCaptionStringPublicId } }, created.identity)).rejects.toThrow();
        await tx.locale.update({ where: { id: fixture.frenchId }, data: { isDeleted: true } });
        await expect(executeCatalogCrud(tx, auth, eventAttendanceEditorView, { buttonCaption: text("Oui", "fr-BE", row.buttonCaptionStringPublicId) }, created.identity)).rejects.toThrow("enabled global locale");
        expect(await tx.dynamicLocalizedStringValue.count()).toBe(count);
        expect(eventStatusDashboardView.viewID).toBe("EventStatus_Dashboard");
    }));
});
