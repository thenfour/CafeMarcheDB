import { PrismaClient, type Prisma, type BandInstrument } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { editBandUserInstruments } from "src/core/db3/server/commands/bandUserInstrumentsCommand";
import { bandUserInstrumentsView } from "src/core/db3/shared/entities/user/bandUserInstruments";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function createCatalog(tx: Prisma.TransactionClient, bandId: number) {
    const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId } });
    const instruments: BandInstrument[] = [];
    for (let index = 0; index < 3; index++) {
        instruments.push(await tx.bandInstrument.create({ data: {
            publicId: generatePublicId(), bandId, functionalGroupId: group.id,
        } }));
    }
    return { group, instruments };
}

async function prepareFixture(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) {
    const band = fixture.bands[index]!;
    const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(band.publicId));
    const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } } });
    const catalog = await createCatalog(tx, band.id);
    const replace = (ids: readonly string[]) => editBandUserInstruments(tx, auth, {
        kind: "replace", membershipId: parsePublicId<"BandUser">(member.publicId), instrumentIds: ids.map(id => parsePublicId<"Instrument">(id)),
    });
    const primary = (id: string) => editBandUserInstruments(tx, auth, {
        kind: "setPrimary", membershipId: parsePublicId<"BandUser">(member.publicId), instrumentId: parsePublicId<"Instrument">(id),
    });
    const assignments = () => tx.bandUserInstrument.findMany({ where: { bandUserId: member.id }, orderBy: { publicId: "asc" } });
    return { auth, member: { ...member, publicId: parsePublicId<"BandUser">(member.publicId) }, ...catalog, replace, primary, assignments };
}

describe.skipIf(!settingsMysqlTestUrl)("band member instruments on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());

    it("keeps a shared person's assignments and primaries independent in two bands, including a roleless membership", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const first = await prepareFixture(tx, fixture);
            const second = await prepareFixture(tx, fixture, 1);
            await first.replace(first.instruments.slice(0, 2).map(row => row.publicId));
            await second.replace([second.instruments[0]!.publicId]);
            await first.primary(first.instruments[1]!.publicId);
            expect((await first.assignments()).filter(row => row.isPrimary).map(row => row.bandInstrumentId)).toEqual([first.instruments[1]!.id]);
            expect(await second.assignments()).toMatchObject([{ bandInstrumentId: second.instruments[0]!.id, isPrimary: true }]);
            for (const context of [first, second]) {
                const snapshot = await bindDB3ReadSnapshot(tx, context.auth, { isolationLevel: "Serializable" });
                const result = await queryView({ view: bandUserInstrumentsView,
                    filter: { publicIds: [context.member.publicId] }, cmdbQueryContext: "membership fixture" }, context.auth, snapshot);
                expect(result.items).toHaveLength(1);
                expect(result.items[0]!.publicId).toBe(context.member.publicId);
                expect(result.items[0]!.bandUserInstruments).toHaveLength(context === first ? 2 : 1);
                const transport = JSON.stringify(result.items);
                expect(transport).not.toMatch(/"(?:id|bandId|bandUserId)":/);
                expect(result.items[0]!.userId).toBe((await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).publicId);
                expect(result.items[0]!.bandUserInstruments.every(row => typeof row.bandInstrumentId === "string")).toBe(true);
            }
        }));

    it("retains the existing primary, replaces a removed default deterministically, and supports an empty list", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const context = await prepareFixture(tx, fixture);
            await context.replace(context.instruments.map(row => row.publicId));
            await context.primary(context.instruments[1]!.publicId);
            const original = await context.assignments();
            const auditCount = await tx.change.count();
            await context.replace(context.instruments.map(row => row.publicId).reverse());
            await context.primary(context.instruments[1]!.publicId);
            expect(await context.assignments()).toEqual(original);
            expect(await tx.change.count()).toBe(auditCount);
            await context.replace([context.instruments[0]!.publicId, context.instruments[2]!.publicId]);
            const retained = await context.assignments();
            expect(retained.filter(row => row.isPrimary)).toEqual([retained[0]]);
            expect(retained.map(row => row.publicId)).toEqual(original.filter(row => row.bandInstrumentId !== context.instruments[1]!.id).map(row => row.publicId));
            await context.replace([]);
            expect(await context.assignments()).toEqual([]);
        }));

    it("preserves hidden instruments and groups already assigned while rejecting new hidden selections", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const context = await prepareFixture(tx, fixture);
            await context.replace([context.instruments[0]!.publicId]);
            const original = await context.assignments();
            await tx.bandInstrument.update({ where: { id: context.instruments[0]!.id }, data: { isHidden: true } });
            await tx.bandInstrument.update({ where: { id: context.instruments[1]!.id }, data: { isHidden: true } });
            await context.replace([context.instruments[0]!.publicId, context.instruments[2]!.publicId]);
            await expect(context.replace([context.instruments[0]!.publicId, context.instruments[1]!.publicId])).rejects.toThrow("was not found");
            await tx.bandInstrumentFunctionalGroup.update({ where: { id: context.group.id }, data: { isHidden: true } });
            await context.replace([context.instruments[0]!.publicId, context.instruments[2]!.publicId]);
            expect((await context.assignments()).find(row => row.id === original[0]!.id)).toEqual(original[0]);
            const snapshot = await bindDB3ReadSnapshot(tx, context.auth, { isolationLevel: "Serializable" });
            const result = await queryView({ view: bandUserInstrumentsView, filter: { publicIds: [context.member.publicId] },
                cmdbQueryContext: "hidden membership assignments" }, context.auth, snapshot);
            expect(result.items[0]!.bandUserInstruments).toHaveLength(2);
            await context.replace([]);
            expect(await context.assignments()).toEqual([]);
        }));

    it("rejects other-band membership/instrument IDs and unassigned primaries without changing rows or audits", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const first = await prepareFixture(tx, fixture);
            const second = await prepareFixture(tx, fixture, 1);
            await first.replace([first.instruments[0]!.publicId]);
            const original = await first.assignments();
            const auditCount = await tx.change.count();
            await expect(first.replace([second.instruments[0]!.publicId])).rejects.toThrow("was not found");
            await expect(first.primary(first.instruments[1]!.publicId)).rejects.toThrow("must already be assigned");
            await expect(first.primary(second.instruments[0]!.publicId)).rejects.toThrow("must already be assigned");
            await expect(editBandUserInstruments(tx, first.auth, { kind: "replace", membershipId: parsePublicId<"BandUser">(second.member.publicId), instrumentIds: [] })).rejects.toThrow("cannot be edited");
            expect(await first.assignments()).toEqual(original);
            expect(await tx.change.count()).toBe(auditCount);
        }));

    it("allows band managers to edit active members and rejects ordinary owners editing someone else", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const context = await prepareFixture(tx, fixture);
            const person = await tx.user.create({ data: { publicId: generatePublicId(), name: "Other member", email: "other@test.invalid" } });
            const member = await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: context.auth.requireBand().id, userId: person.id } });
            const command = { kind: "replace", membershipId: parsePublicId<"BandUser">(member.publicId), instrumentIds: [parsePublicId<"Instrument">(context.instruments[0]!.publicId)] };
            const manage = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_users } });
            await tx.bandRolePermission.createMany({ data: { publicId: generatePublicId(), bandRoleId: context.member.bandRoleId!, permissionId: manage.id }, skipDuplicates: true });
            await editBandUserInstruments(tx, await context.auth.refresh(tx), { ...command, kind: "replace" });
            expect(await tx.bandUserInstrument.count({ where: { bandUserId: member.id } })).toBe(1);
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: context.member.bandRoleId!, permissionId: manage.id } });
            await expect(editBandUserInstruments(tx, await context.auth.refresh(tx), { ...command, kind: "replace", instrumentIds: [] })).rejects.toThrow("cannot be edited");
            const ownerAuth = await loadAuthorizationForUser(person, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
            await editBandUserInstruments(tx, ownerAuth, { ...command, kind: "replace", instrumentIds: [] });
            expect(await tx.bandUserInstrument.count({ where: { bandUserId: member.id } })).toBe(0);
        }));

    it("rejects inactive memberships, deleted/merged people, outsiders, and platform requests", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const context = await prepareFixture(tx, fixture);
            await tx.bandUser.update({ where: { id: context.member.id }, data: { isDeleted: true } });
            await expect(context.replace([])).rejects.toThrow("cannot be edited");
            await tx.bandUser.update({ where: { id: context.member.id }, data: { isDeleted: false } });
            await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: true } });
            await expect(context.replace([])).rejects.toThrow("cannot be edited");
            await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: false, mergedIntoUserId: fixture.admin.id } });
            await expect(context.replace([])).rejects.toThrow("cannot be edited");
            await tx.user.update({ where: { id: fixture.user.id }, data: { mergedIntoUserId: null } });
            const outsider = await tx.user.create({ data: { publicId: generatePublicId(), email: "outsider@test.invalid" } });
            const request = { kind: "replace", membershipId: parsePublicId<"BandUser">(context.member.publicId), instrumentIds: [] };
            const outsiderAuth = await loadAuthorizationForUser(outsider, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
            await expect(editBandUserInstruments(tx, outsiderAuth, { ...request, kind: "replace" })).rejects.toThrow("cannot be edited");
            const platform = await loadAuthorizationForUser(fixture.admin, tx);
            await expect(editBandUserInstruments(tx, platform, { ...request, kind: "replace" })).rejects.toThrow("band context");
        }));

    it("writes assignment and primary audits in the same transaction and rolls them back together", async () => {
        let memberId: number | undefined;
        let operationId: string | undefined;
        await withSettingsMysqlFixture(database, async (tx, fixture) => {
            const context = await prepareFixture(tx, fixture);
            memberId = context.member.id;
            await context.replace([context.instruments[0]!.publicId]);
            const changes = await tx.change.findMany({ where: { userId: fixture.user.id, table: "bandUserInstrument" } });
            expect(changes).toHaveLength(2);
            expect(new Set(changes.map(row => row.operationId)).size).toBe(1);
            operationId = changes[0]!.operationId;
        });
        expect(await database.bandUserInstrument.count({ where: { bandUserId: memberId } })).toBe(0);
        expect(await database.change.count({ where: { operationId } })).toBe(0);
    });
});
