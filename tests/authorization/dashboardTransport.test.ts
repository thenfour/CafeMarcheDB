import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

vi.mock("db", async () => {
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return {
        ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
        default: new Proxy(authorizationTestDb, {
            // Event relevance does not affect the dashboard's DTO/hydration boundary.
            get: (database, key) => key === "$queryRaw" ? async () => [] : Reflect.get(database, key),
        }),
    };
});

import getDashboardData from "src/auth/queries/getDashboardData";
import getAllRoles from "src/auth/queries/getAllRoles";
import * as db3 from "src/core/db3/db3";
import { gGeneralPaletteList } from "src/core/components/color/palette";
import { Permission } from "shared/permissions";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";

const user = createAuthorizationTestUser("sysadmin", { id: 42 });
const role = {
    ...user.role!, description: "Administrators", sortOrder: 1, color: "blue", significance: null,
    isRoleForNewUsers: false, isPublicRole: false, isSysAdminRole: true,
};
const permission = {
    ...role.permissions.find(entry => entry.permission.name === Permission.visibility_public)!.permission,
    description: "Public", sortOrder: 1, isVisibility: true, significance: null, color: "green", iconName: null,
};
const group = {
    id: 10, publicId: db3.xInstrumentFunctionalGroup.parseIdentity("DashboardGroup01"),
    name: "Brass", description: "", sortOrder: 1, color: "orange",
};
const tag = {
    id: 11, publicId: db3.xInstrumentTag.parseIdentity("DashboardTag0001"),
    text: "Horn", description: "", sortOrder: 1, color: "blue", significance: null,
};
const instrument = {
    id: 12, publicId: db3.xInstrument.parseIdentity("DashboardInstr01"),
    name: "Trumpet", description: "", sortOrder: 1, autoAssignFileLeafRegex: null,
    functionalGroupId: group.id, functionalGroup: group,
    instrumentTags: [{
        id: 13, publicId: db3.xInstrumentTagAssociation.parseIdentity("DashboardAssoc01"),
        tagId: tag.id, tag,
    }],
};
const menuLink = {
    id: 14, sortOrder: 1, realm: "General", applicationPage: null, groupName: "Resources",
    caption: "Scores", iconName: null, linkType: "ExternalURL", externalURI: "https://example.test/scores",
    wikiSlug: null, groupCssClass: "", itemCssClass: "", createdAt: new Date("2026-09-26T12:00:00Z"),
    createdByUserId: user.id, createdByUser: user,
    visiblePermissionId: permission.id, visiblePermission: permission,
};

beforeEach(() => authorizationTestDb.reset({
    user: [user], role: [role], permission: [permission],
    instrumentFunctionalGroup: [group], instrumentTag: [tag], instrument: [instrument],
    menuLink: [menuLink],
}));
afterEach(() => { vi.restoreAllMocks(); });

describe("dashboard transport boundary", () => {
    it("returns DTOs from resolvers and hydrates normalized references once at the consumer", async () => {
        const groupHydrate = vi.spyOn(db3.instrumentFunctionalGroupDashboardView, "hydrate");
        const instrumentHydrate = vi.spyOn(db3.instrumentDashboardView, "hydrate");
        const ctx = createAuthorizationTestContext(user);
        const dto = await invokeResolver(getDashboardData, {}, ctx);
        expectTypeOf(dto).toEqualTypeOf<db3.DashboardDataDto>();
        expect(groupHydrate).not.toHaveBeenCalled();
        expect(instrumentHydrate).not.toHaveBeenCalled();
        expect(dto.instrumentFunctionalGroup[0]!.color).toBe("orange");
        expect(dto.instrumentTag[0]!.color).toBe("blue");
        expect(dto.role[0]!.color).toBe("blue");
        expect(dto.permission[0]!.color).toBe("green");
        expect(dto.instrument[0]).toMatchObject({
            functionalGroupId: group.publicId,
            instrumentTags: [{ publicId: instrument.instrumentTags[0]!.publicId, tagId: tag.publicId }],
        });
        expect(dto.instrument[0]).not.toHaveProperty("id");
        expect(dto.instrument[0]).not.toHaveProperty("functionalGroup");
        expect(dto.instrument[0]!.instrumentTags[0]).not.toHaveProperty("tag");
        expect(dto.dynMenuLinks[0]).not.toHaveProperty("visiblePermission");
        expect(dto).not.toHaveProperty("referenceStore");
        expect(db3.instrumentDashboardView.parseDto(dto.instrument[0])).toEqual(dto.instrument[0]);

        const roles = await invokeResolver(getAllRoles, {}, ctx);
        expect(roles[0]!.color).toBe("blue");

        const client = db3.hydrateDashboardData(dto);
        expect(groupHydrate).toHaveBeenCalledOnce();
        expect(instrumentHydrate).toHaveBeenCalledOnce();
        expect(client.instrumentFunctionalGroup[0]!.color).toEqual(gGeneralPaletteList.findEntry("orange"));
        expect(client.instrument[0]!.functionalGroup).toBe(client.instrumentFunctionalGroup[0]);
        expect(client.instrument[0]!.instrumentTags[0]!.tag).toBe(client.instrumentTag[0]);
        expect(client.dynMenuLinks[0]!.visiblePermission).toBe(client.permission[0]);
        expect(client.referenceStore.get(db3.xInstrument, instrument.publicId)).toBe(client.instrument[0]);
        // Hydration must not mutate the cached RPC payload.
        expect(dto.instrumentFunctionalGroup[0]!.color).toBe("orange");
        expect(dto.instrument[0]).not.toHaveProperty("functionalGroup");
    });

    it("rebuilds references for each snapshot and still rejects missing required references", async () => {
        const dto = await invokeResolver(getDashboardData, {}, createAuthorizationTestContext(user));
        const first = db3.hydrateDashboardData(dto);
        const refreshed = db3.hydrateDashboardData({
            ...dto, instrument: [], instrumentFunctionalGroup: [], instrumentTag: [],
        });
        expect(refreshed.referenceStore).not.toBe(first.referenceStore);
        expect(refreshed.referenceStore.get(db3.xInstrument, instrument.publicId)).toBeUndefined();
        expect(refreshed.referenceStore.get(db3.xInstrumentTag, tag.publicId)).toBeUndefined();
        expect(() => db3.hydrateDashboardData({ ...dto, instrumentFunctionalGroup: [] }))
            .toThrow(/not available/);
    });

    it("keeps authorization omissions out of complete client option lists", async () => {
        const dto = await invokeResolver(getDashboardData, {}, createAuthorizationTestContext(user));
        const client = db3.hydrateDashboardData({
            ...dto,
            role: [{ publicId: role.publicId }],
            eventAttendance: [{ publicId: db3.xEventAttendance.parseIdentity("DashboardAttend1") }],
            wikiPageTag: [{ publicId: db3.xWikiPageTag.parseIdentity("DashboardWiki001") }],
        });
        expect(client.role).toEqual([]);
        expect(client.eventAttendance).toEqual([]);
        expect(client.wikiPageTag).toEqual([]);
        expect(client.referenceStore.get(db3.xEventAttendance, db3.xEventAttendance.parseIdentity("DashboardAttend1")))
            .toBeUndefined();
    });
});
