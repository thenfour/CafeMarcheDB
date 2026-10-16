import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { QuickSearchItemType as Type } from "shared/quickFilter";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";
import { saveSetlistPlanInTransaction } from "src/core/db3/server/setlistPlanPersistence";
import { QuickSearchResultsSchema, type QuickSearchInput } from "src/core/db3/shared/quickSearchTypes";
import type { SetlistPlanAssociatedItem, SetlistPlanPayload } from "src/core/db3/shared/setlistPlanTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareEventAttendanceFixture(tx, fixture, [Permission.search_users, Permission.view_users_basic_info,
        Permission.setlist_planner_access, Permission.view_songs, Permission.visibility_members]);
    const createPerson = async (name: string, bandIds: number[] = [c.band.id]) => tx.user.create({ data: {
        publicId: generatePublicId(), name, email: "contact-only@lookup.invalid", phone: "contact-only-123",
        bandUsersByUser: { create: bandIds.map(bandId => ({ publicId: generatePublicId(), bandId })) },
    } });
    const shared = await createPerson("Quick compass", fixture.bands.map(band => band.id));
    const foreign = await createPerson("Quick foreign", [fixture.bands[1]!.id]);
    const outsider = await createPerson("Quick outsider", []);
    const inactive = await createPerson("Quick inactive");
    await tx.bandUser.updateMany({ where: { userId: inactive.id }, data: { isDeleted: true } });
    const deleted = await createPerson("Quick deleted");
    await tx.user.update({ where: { id: deleted.id }, data: { isDeleted: true } });
    const merged = await createPerson("Quick merged");
    await tx.user.update({ where: { id: merged.id }, data: { mergedIntoUserId: shared.id } });
    const search = async (keyword = "Quick", patch: Partial<QuickSearchInput> = {}, auth: CMServerAuthorization = c.auth) => {
        const input: QuickSearchInput = { bandPublicId: c.args.bandPublicId, keyword, allowedItemTypes: [Type.user],
            permissionPolicy: "requireAll", routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"], ...patch };
        return getQuickSearchResults(input, auth, await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
    };
    return { ...c, shared, foreign, outsider, inactive, deleted, merged, search };
}

describe.skipIf(!settingsMysqlTestUrl)("selected-band person quick search on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(async () => {
        vi.stubEnv("CMDB_BASE_URL", "https://association.test.invalid");
        if (database) {
            await initializeAccessControl(database);
        }
    }, 30_000);
    afterAll(async () => {
        vi.unstubAllEnvs();
        await database?.$disconnect();
    });
    function run(work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) {
        if (!database) {
            throw new Error("Native lookup tests require a disposable database.");
        }
        return withSettingsMysqlFixture(database, work);
    }

    it("returns only visible active band people, retaining shared public profile identities", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const results = await c.search();
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ id: c.shared.publicId, name: "Quick compass", itemType: Type.user, matchingField: "name" });
        expect(QuickSearchResultsSchema.parse(results)).toEqual(results);
        const uri = new URL(results[0]!.absoluteUri!);
        expect(uri.pathname).toBe(`/fr-BE/b/${c.args.bandPublicId}/user/${c.shared.publicId}`);
        expect(uri.pathname).toContain(`/fr-BE/b/${c.args.bandPublicId}/`);
        expect(uri.searchParams.has("routeLocale")).toBe(false);
        expect(JSON.stringify(results)).not.toMatch(/"(?:email|phone|userId|bandId|bandRoleId|isDeleted)":/);
    }));

    it.each(["u", "user"])("retains the %s prefix and authored-name-only matching", prefix => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        expect((await c.search(`${prefix}:Quick compass`)).map(result => result.id)).toEqual([c.shared.publicId]);
        expect(await c.search("contact-only")).toEqual([]);
        expect(await c.search(c.shared.publicId)).toEqual([]);
        expect(await c.search("#Quick")).toEqual([]);
        expect(await c.search("song:Quick")).toEqual([]);
    }));

    it("shares people across independent bands with fresh role and membership eligibility", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const bandPublicId = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        const platform = await loadAuthorizationForUser(fixture.admin, tx, bandPublicId);
        expect((await c.search("Quick", { bandPublicId, routeLocale: "nl-BE" }, platform)).map(result => result.id).sort())
            .toEqual([c.shared.publicId, c.foreign.publicId].sort());
        await tx.bandUser.updateMany({ where: { userId: c.shared.id, bandId: c.band.id }, data: { isDeleted: true } });
        expect(await c.search()).toEqual([]);
        expect((await c.search("Quick", { bandPublicId }, platform)).map(result => result.id)).toContain(c.shared.publicId);
        const roleless = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
        expect(await c.search("Quick", { bandPublicId, permissionPolicy: "omitUnavailable" }, roleless)).toEqual([]);
        await expect(c.search("Quick", { bandPublicId }, roleless)).rejects.toThrow();
    }));

    it("applies shared person read policy separately from the search grant", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_users_basic_info } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        expect(await c.search()).toEqual([]);
        // Shared policy still allows the account owner to read their own name.
        expect((await c.search(c.person.name)).map(result => result.id)).toEqual([c.person.publicId]);
    }));

    it.each(["grant", "role", "membership", "deleted", "merged", "band"])("refreshes %s authority from stale callers", revoked => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        if (revoked === "grant") {
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.search_users } });
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        } else if (revoked === "role") {
            await tx.bandRole.update({ where: { id: c.role.id }, data: { isDeleted: true } });
        } else if (revoked === "membership") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        } else if (revoked === "deleted") {
            await tx.user.update({ where: { id: c.person.id }, data: { isDeleted: true } });
        } else if (revoked === "merged") {
            await tx.user.update({ where: { id: c.person.id }, data: { mergedIntoUserId: c.shared.id } });
        } else {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        }
        await expect(c.search()).rejects.toThrow();
        if (revoked === "grant" || revoked === "role" || revoked === "membership") {
            expect(await c.search("Quick", { permissionPolicy: "omitUnavailable" })).toEqual([]);
        }
    }));

    it.each(["anonymous", "unscoped", "outsider"])("rejects %s person search", kind => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const auth = await loadAuthorizationForUser(kind === "anonymous" ? null : kind === "outsider" ? c.outsider : fixture.user,
            tx, kind === "unscoped" ? null : c.args.bandPublicId);
        await expect(c.search("Quick", {}, auth)).rejects.toThrow();
    }));

    it("keeps 100 authorized candidates and fifteen ranked results before a stronger late match", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        for (let index = 0; index < 101; index++) {
            await tx.user.create({ data: { publicId: `LimitUser${String(index).padStart(7, "0")}`,
                name: index === 100 ? "Limit compass" : "Limit compass phrase", email: "",
                bandUsersByUser: { create: { publicId: generatePublicId(), bandId: c.band.id } } } });
        }
        const results = await c.search("Limit compass");
        expect(results.map(result => result.id)).toEqual(Array.from({ length: 15 }, (_, index) => `LimitUser${String(index).padStart(7, "0")}`));
    }));

    it.each(["columns", "columnLeds", "rowLeds"] as const)("persists a picked person in %s and revalidates eligibility before saving", position => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const selected = (await c.search())[0];
        if (!selected || selected.itemType !== Type.user) {
            throw new Error("The fixture needs a selected person.");
        }
        const reference: SetlistPlanAssociatedItem = { itemType: selected.itemType, id: selected.id, name: selected.name, absoluteUri: selected.absoluteUri };
        const payload: SetlistPlanPayload = { version: 1, rows: [], columns: [], cells: [], notes: "Keep authored notes" };
        if (position === "columns") {
            payload.columns = [{ columnId: "segment", name: "Rehearsal", associatedItem: reference }];
        } else {
            payload[position] = [{ ledId: "led", name: "Attendance", descriptionMarkdown: "Keep LED notes", associatedItem: reference }];
        }
        const args = { bandPublicId: c.args.bandPublicId, plan: { publicId: null, name: "Selected association", description: "Keep description",
            visiblePermissionId: null, payload } };
        const saved = await saveSetlistPlanInTransaction(tx, c.auth, args);
        expect(saved.payload).toEqual(payload);
        await tx.bandUser.updateMany({ where: { userId: c.shared.id, bandId: c.band.id }, data: { isDeleted: true } });
        const before = { plans: await tx.setlistPlan.findMany(), changes: await tx.change.count() };
        await expect(saveSetlistPlanInTransaction(tx, c.auth, { ...args, plan: { ...args.plan, publicId: saved.publicId } })).rejects.toThrow();
        expect({ plans: await tx.setlistPlan.findMany(), changes: await tx.change.count() }).toEqual(before);
    }));
});
