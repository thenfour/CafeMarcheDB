import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bandUserSearchView } from "src/core/db3/db3";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { DiscreteCriterionFilterType as Behavior, type GetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const basicGrants = [Permission.search_users, Permission.view_users_basic_info];
async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, grants: Permission[] = [...basicGrants, Permission.manage_users]) {
    const band = fixture.bands[0]!;
    const bandPublicId = parsePublicId<"Band">(band.publicId);
    const text = (english: string, french = english) => tx.dynamicLocalizedString.create({ data: {
        publicId: generatePublicId(), values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: english },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: french },
        ] },
    } });
    const roleName = await text("Directory manager", "Gestionnaire");
    const role = await tx.bandRole.create({ data: { publicId: generatePublicId(), nameId: roleName.id,
        bandRolePermissions: { create: (await tx.permission.findMany({ where: { name: { in: grants } } }))
            .map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) },
    } });
    const actor = await tx.bandUser.update({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } }, data: { bandRoleId: role.id } });
    const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
    const tagName = await text("Member", "Membre");
    const secondName = await text("Volunteer", "Benevole");
    const description = await text("Shared description", "Description partagee");
    const globalTag = await tx.globalUserTag.create({ data: { publicId: generatePublicId(), nameId: tagName.id, descriptionId: description.id } });
    const tag1 = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: band.id, globalUserTagId: globalTag.id, sortOrder: 2 } });
    const tag2 = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: band.id, nameId: secondName.id, sortOrder: 1 } });
    const hiddenTag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: band.id, nameId: secondName.id, isHidden: true } });
    const foreignTag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, globalUserTagId: globalTag.id } });
    const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: band.id } });
    const instrument1 = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id, functionalGroupId: group.id, nameId: tagName.id } });
    const instrument2 = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id, functionalGroupId: group.id, nameId: secondName.id } });
    const hiddenInstrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id, functionalGroupId: group.id, isHidden: true } });
    const members = await Promise.all(["Alpha", "Bravo", "Charlie", "Delta"].map(async (name, index) => {
        const user = await tx.user.create({ data: { publicId: generatePublicId(), name, email: `${name.toLowerCase()}-contact@test.invalid`, phone: `hidden-phone-${index}`,
            signInMethods: { create: { publicId: generatePublicId(), type: "email", identifier: `${name.toLowerCase()}-signin@test.invalid` } } } });
        return tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: band.id, userId: user.id, bandRoleId: index === 0 ? role.id : null,
            createdAt: new Date(`2026-01-0${index + 1}T12:00:00Z`),
            bandUserTagAssignments: { create: (index === 0 ? [tag1] : index === 1 ? [tag2] : index === 2 ? [tag1, tag2] : [hiddenTag]).map(tag => ({ publicId: generatePublicId(), bandUserTagId: tag.id })) },
            bandUserInstruments: { create: (index === 0 ? [instrument1] : index === 1 ? [instrument2] : index === 2 ? [instrument1, instrument2] : [hiddenInstrument]).map(instrument => ({ publicId: generatePublicId(), bandInstrumentId: instrument.id })) },
        }, include: { user: true } });
    }));
    const query = (patch: Partial<GetSearchResultsInput> = {}): GetSearchResultsInput => ({
        tableID: "BandUser", viewID: bandUserSearchView.viewID, bandPublicId, offset: 0, take: 20, quickFilter: "",
        sort: [{ db3Column: "user", direction: "asc" }], discreteCriteria: [
            { db3Column: "bandUserTagAssignments", behavior: Behavior.alwaysMatch, options: [] },
            { db3Column: "bandRole", behavior: Behavior.alwaysMatch, options: [] },
            { db3Column: "bandUserInstruments", behavior: Behavior.alwaysMatch, options: [] },
        ], ...patch,
    });
    const snapshot = () => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
    const search = async (patch: Partial<GetSearchResultsInput> = {}) => GetSearchResultsCore(query(patch), auth, await snapshot());
    const names = async (patch: Partial<GetSearchResultsInput> = {}) => (await search(patch)).results.map(row => bandUserSearchView.parseDto(row).user.name);
    return { band, bandPublicId, auth, actor, role, text, tagName, tag1, tag2, hiddenTag, foreignTag,
        instrument1, instrument2, hiddenInstrument, group, members, query, search, names, snapshot };
}

describe.skipIf(!settingsMysqlTestUrl)("restored membership directory search on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it.each(["bandUserTagAssignments", "bandUserInstruments"])("preserves all seven operators and visible-empty semantics for %s", column => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const targets = column === "bandUserTagAssignments" ? [c.tag1, c.tag2] : [c.instrument1, c.instrument2];
        const cases: Array<[Behavior, string[], string[]]> = [
            [Behavior.alwaysMatch, [], ["Alpha", "Bravo", "Charlie", "Delta", "Shared settings person"]],
            [Behavior.hasAny, [], ["Alpha", "Bravo", "Charlie"]],
            [Behavior.hasNone, [], ["Delta", "Shared settings person"]],
            [Behavior.hasSomeOf, [targets[0]!.publicId], ["Alpha", "Charlie"]],
            [Behavior.hasAllOf, targets.map(target => target.publicId), ["Charlie"]],
            [Behavior.doesntHaveAnyOf, [targets[0]!.publicId], ["Bravo", "Delta", "Shared settings person"]],
            [Behavior.doesntHaveAllOf, targets.map(target => target.publicId), ["Alpha", "Bravo", "Delta", "Shared settings person"]],
        ];
        for (const [behavior, options, expected] of cases) {
            const ret = await c.search({ discreteCriteria: [{ db3Column: column, behavior, options }] });
            expect(ret.results.map(row => bandUserSearchView.parseDto(row).user.name)).toEqual(expected);
            expect(ret.rowCount).toBe(expected.length);
        }
    }));

    it("combines authored name tokens, tags, instruments and roles; preserves null-role facets", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        expect(await c.names({ quickFilter: "Char lie", discreteCriteria: [
            { db3Column: "bandUserTagAssignments", behavior: Behavior.hasSomeOf, options: [c.tag1.publicId] },
            { db3Column: "bandUserInstruments", behavior: Behavior.hasSomeOf, options: [c.instrument2.publicId] },
            { db3Column: "bandRole", behavior: Behavior.hasNone, options: [] },
        ] })).toEqual(["Charlie"]);
        expect(await c.names({ discreteCriteria: [{ db3Column: "bandRole", behavior: Behavior.hasSomeOf, options: [c.role.publicId] }] })).toEqual(["Alpha", "Shared settings person"]);
        const roles = (await c.search()).facets.find(facet => facet.db3Column === "bandRole")!;
        expect(roles.items.find(item => item.id === null)?.rowCount).toBe(3);
        expect(roles.items.find(item => item.id === c.role.publicId)).toMatchObject({ label: "Directory manager", rowCount: 2 });
    }));

    it("resolves ordered preferences, inherited labels, overrides and intentional blanks in facets and result roles", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const read = () => c.search({ browserLanguages: ["de-DE", "fr-FR"] });
        expect((await read()).facets.find(facet => facet.db3Column === "bandUserTagAssignments")!.items.find(item => item.id === c.tag1.publicId)?.label).toBe("Membre");
        expect(bandUserSearchView.parseDto((await read()).results[0]).bandRole?.name).toBe("Gestionnaire");
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), bandId: c.band.id, stringId: c.tagName.id, localeId: fixture.englishId, indexedValue: "" } });
        const facet = (await read()).facets.find(facet => facet.db3Column === "bandUserTagAssignments")!;
        expect(facet.items.find(item => item.id === c.tag1.publicId)?.label).toBe("");
        expect(facet.items.map(item => item.id)).not.toContain(c.hiddenTag.publicId);
        for (const target of [c.hiddenTag, c.foreignTag]) {
            await expect(c.search({ discreteCriteria: [{ db3Column: "bandUserTagAssignments", behavior: Behavior.hasSomeOf, options: [target.publicId] }] })).rejects.toThrow();
        }
        await tx.bandInstrumentFunctionalGroup.update({ where: { id: c.group.id }, data: { isHidden: true } });
        expect((await c.search()).facets.find(facet => facet.db3Column === "bandUserInstruments")!.items.map(item => item.id)).toEqual([null]);
    }));

    it("keeps contact and sign-in probes behind independent field grants and rejects operational sort/facet requests", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture, basicGrants);
        expect(await c.names({ quickFilter: "alpha-contact@test.invalid" })).toEqual([]);
        expect(await c.names({ quickFilter: "hidden-phone-0" })).toEqual([]);
        expect(await c.names({ quickFilter: "alpha-signin@test.invalid" })).toEqual([]);
        const row = bandUserSearchView.parseDto((await c.search()).results[0]);
        expect(row.user).toEqual({ publicId: c.members[0]!.user.publicId, name: "Alpha" });
        expect(row).not.toHaveProperty("createdAt");
        expect((await c.search()).facets.map(facet => facet.db3Column)).not.toContain("bandRole");
        await expect(c.search({ sort: [{ db3Column: "createdAt", direction: "asc" }] })).rejects.toThrow();
        await expect(c.search({ discreteCriteria: [{ db3Column: "bandRole", behavior: Behavior.hasAny, options: [] }] })).rejects.toThrow();
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_user_contact_info } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: permission.id } });
        expect(await c.names({ quickFilter: "alpha-contact@test.invalid hidden-phone-0" })).toEqual(["Alpha"]);
        expect(await c.names({ quickFilter: "alpha-signin@test.invalid" })).toEqual([]);
        const admin = await loadAuthorizationForUser(fixture.admin, tx, c.bandPublicId);
        const result = await GetSearchResultsCore(c.query({ quickFilter: "alpha-signin@test.invalid" }), admin,
            await bindDB3ReadSnapshot(tx, admin, { isolationLevel: "Serializable" }));
        expect(result.results.map(row => bandUserSearchView.parseDto(row).user.name)).toEqual(["Alpha"]);
    }));

    it("excludes inactive memberships, deleted/merged people and other bands consistently across counts, rows and facets", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.bandUser.update({ where: { id: c.members[0]!.id }, data: { isDeleted: true } });
        await tx.user.update({ where: { id: c.members[1]!.userId }, data: { isDeleted: true } });
        await tx.user.update({ where: { id: c.members[2]!.userId }, data: { mergedIntoUserId: fixture.admin.id } });
        expect(await c.names()).toEqual(["Delta", "Shared settings person"]);
        expect((await c.search()).rowCount).toBe(2);
        await expect(c.search({ includeDeleted: true })).rejects.toThrow();
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.recover_users } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: permission.id } });
        expect(await c.names({ includeDeleted: true })).toEqual(["Alpha", "Delta", "Shared settings person"]);
        const other = await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        const ret = await GetSearchResultsCore(c.query({ bandPublicId: parsePublicId<"Band">(other.requireBand().publicId) }), other,
            await bindDB3ReadSnapshot(tx, other, { isolationLevel: "Serializable" }));
        expect(ret.results.map(row => bandUserSearchView.parseDto(row).user.name)).toEqual(["Shared settings person"]);
    }));

    it("preserves escaped person searches and searches only email credentials", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture, [...basicGrants, Permission.view_user_contact_info]);
        const person = c.members[0]!.user;
        await tx.user.update({ where: { id: person.id }, data: {
            name: "O'Brien", email: "percent%address@test.invalid", phone: "dial%42",
        } });
        await tx.user.update({ where: { id: c.members[1]!.userId }, data: {
            email: "percentXaddress@test.invalid", phone: "dialX42",
        } });
        await tx.userSignInMethod.updateMany({ where: { userId: person.id, type: "email" }, data: { identifier: "sign'in@test.invalid" } });
        await tx.userSignInMethod.create({ data: {
            publicId: generatePublicId(), userId: person.id, type: "google", identifier: "provider-only@test.invalid",
        } });

        for (const quickFilter of ["O'Brien", "percent%address", "dial%42"]) {
            expect(await c.names({ quickFilter })).toEqual(["O'Brien"]);
        }
        const admin = await loadAuthorizationForUser(fixture.admin, tx, c.bandPublicId);
        for (const [quickFilter, expected] of [
            ["sign'in@test.invalid", ["O'Brien"]],
            ["provider-only@test.invalid", []],
        ] as const) {
            const result = await GetSearchResultsCore(c.query({ quickFilter }), admin,
                await bindDB3ReadSnapshot(tx, admin, { isolationLevel: "Serializable" }));
            expect(result.results.map(row => bandUserSearchView.parseDto(row).user.name)).toEqual(expected);
        }
    }));

    it("preserves all sorts, stable paging/counts and public transport", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        for (const column of ["user", "createdAt"]) {
            const ascending = (await c.search({ sort: [{ db3Column: column, direction: "asc" }] })).results.map(row => row.publicId);
            const descending = (await c.search({ sort: [{ db3Column: column, direction: "desc" }] })).results.map(row => row.publicId);
            expect(descending).toEqual([...ascending].reverse());
            const pages = await Promise.all([0, 2, 4].map(offset => c.search({ sort: [{ db3Column: column, direction: "asc" }], offset, take: 2 })));
            expect(pages.flatMap(page => page.results.map(row => row.publicId))).toEqual(ascending);
            expect(pages.map(page => page.rowCount)).toEqual([5, 5, 5]);
        }
        const dto = (await c.search()).results;
        expect(JSON.stringify(dto)).not.toMatch(/"(?:id|bandId|globalRoleId|hashedPassword|mergedIntoUserId|signInMethods)":/);
    }));

    it.each(["searchGrant", "readGrant", "membership", "account", "merged", "band"])("rechecks %s revocation before executing directory SQL", reason => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.search();
        if (reason === "searchGrant" || reason === "readGrant") {
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permission: { name: reason === "searchGrant" ? Permission.search_users : Permission.view_users_basic_info } } });
        } else if (reason === "membership") {
            await tx.bandUser.update({ where: { id: c.actor.id }, data: { isDeleted: true } });
        } else if (reason === "band") {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: fixture.user.id }, data: reason === "merged" ? { mergedIntoUserId: fixture.admin.id } : { isDeleted: true } });
        }
        const raw = vi.spyOn(tx, "$queryRaw");
        try {
            await expect(c.search()).rejects.toThrow();
            expect(raw).not.toHaveBeenCalled();
        } finally {
            raw.mockRestore();
        }
    }));

    it("requires explicit selected-band context for platform access and rejects forged view/sort/filter identities", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(GetSearchResultsCore(c.query(), platform, await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" }))).rejects.toThrow();
        for (const patch of [{ bandPublicId: null }, { viewID: "BandUser_Profile" }, { sort: [{ db3Column: "phoneSearch", direction: "asc" as const }] },
            { discreteCriteria: [{ db3Column: "emailSearch", behavior: Behavior.hasAny, options: [] }] }]) {
            await expect(c.search(patch)).rejects.toThrow();
        }
        // @ts-expect-error Unbound transactions are also rejected at the runtime boundary.
        await expect(GetSearchResultsCore(c.query(), c.auth, tx)).rejects.toThrow();
    }));
});
