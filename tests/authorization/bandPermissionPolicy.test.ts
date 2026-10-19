import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { type BandScopedPermission, gPermissionRegistry, Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { CMClientAuthorization } from "src/auth/shared/cmAuthorization";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { scopedAuthorizationSatisfiesRequirement } from "src/auth/shared/permissionRequirement";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { testBandAuthorization, testServerAuthorization } from "tests/support/serverAuthorization";

vi.mock("db", async () => {
    // The hoisted mock loads Prisma and the in-memory database after mock setup.
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { xSong } from "src/core/db3/shared/schema/song";
import { authorizationTestDb, matchesWhere } from "./support/inMemoryPrisma";
import { xEvent } from "src/core/db3/shared/schema/event";
import { permissionVisibilityView } from "src/core/db3/shared/entities/user/permissionViews";
import { isSelectableBandVisibilityPermission } from "src/core/db3/shared/entities/user/visibilityPermissionPolicy";
import { resolvePublicForeignIds } from "src/core/db3/server/db3PublicIds";

const bandPublicId = parsePublicId<"Band">("FixtureBand00001");
const globalGrants = new ServerPermissionSet([{ id: 900, name: Permission.global_band_admin }]);

describe("explicit global band authority", () => {
    it("derives every band policy while retaining each exact permission tuple", () => {
        expectTypeOf<keyof typeof BandPermission>().toEqualTypeOf<BandScopedPermission>();
        expectTypeOf(BandPermission.manage_events.anyOf).toEqualTypeOf<readonly ["manage_events", "global_band_admin"]>();
        expectTypeOf(BandPermission.view_files.anyOf).toEqualTypeOf<readonly ["view_files", "global_band_admin"]>();
        expectTypeOf(BandPermission.manage_events.requiresBand).toEqualTypeOf<true>();

        const definitions = gPermissionRegistry.filter(definition => definition.scope === "band");
        expect(Object.keys(BandPermission)).toEqual(definitions.map(definition => definition.key));
        for (const definition of definitions) {
            expect(BandPermission[definition.key]).toEqual({
                anyOf: [definition.key, Permission.global_band_admin],
                requiresBand: true,
            });
        }
    });

    it("accepts feature alternatives in a selected band without expanding exact grants", () => {
        const server = testBandAuthorization({ id: 1 }, globalGrants);
        const client = new CMClientAuthorization(null, new PermissionSet(globalGrants.names), null, bandPublicId);
        for (const authorization of [server, client]) {
            expect(authorization.hasPermission(BandPermission.manage_events)).toBe(true);
            expect(authorization.hasPermission(BandPermission.view_files)).toBe(true);
            expect(authorization.hasPermission(Permission.manage_events)).toBe(false);
            expect(authorization.hasPermission(Permission.view_files)).toBe(false);
            expect(authorization.hasPermission(Permission.sysadmin)).toBe(false);
        }
        expect(server.effectivePermissions.names).toEqual([Permission.global_band_admin]);
    });

    it("requires a band on server, client and presentation checks", () => {
        const server = testServerAuthorization({ id: 1 }, globalGrants);
        const client = new CMClientAuthorization(null, new PermissionSet(globalGrants.names));
        expect(server.hasPermission(Permission.global_band_admin)).toBe(true);
        expect(server.hasPermission(BandPermission.manage_events)).toBe(false);
        expect(client.hasPermission(BandPermission.manage_events)).toBe(false);
        const context = { effectivePermissionNames: globalGrants.names, bandPublicId: null };
        expect(scopedAuthorizationSatisfiesRequirement(context, BandPermission.manage_events)).toBe(false);
        expect(scopedAuthorizationSatisfiesRequirement({ ...context, bandPublicId }, BandPermission.manage_events)).toBe(true);
    });

    it("preserves ordinary granular grants and denies unrelated operations", () => {
        const client = new CMClientAuthorization(null, new PermissionSet([Permission.manage_events]), null, bandPublicId);
        expect(client.hasPermission(BandPermission.manage_events)).toBe(true);
        expect(client.hasPermission(BandPermission.manage_files)).toBe(false);
    });

    it("applies configured visibility consistently while preserving private ownership and band isolation", () => {
        const auth = testBandAuthorization({ id: 1 }, globalGrants);
        const row = {
            id: 10, publicId: "PolicySong000001", name: "Song", bandId: 1,
            isDeleted: false, visiblePermissionId: 700, createdByUserId: 2,
        };
        const where = xSong.CalculateWhereClause({ auth, filterModel: { tableParams: {} } });
        expect(matchesWhere(row, where)).toBe(true);
        expect(xSong.authorizeRowForView({ auth, model: row })).toBe(true);
        expect(xSong.SqlGetVisFilterExpression({ auth, tableAlias: "S" })).toContain("S.visiblePermissionId IS NOT NULL");
        const privateRow = { ...row, visiblePermissionId: null };
        expect(matchesWhere(privateRow, where)).toBe(false);
        expect(xSong.authorizeRowForView({ auth, model: privateRow })).toBe(false);
        expect(matchesWhere({ ...privateRow, createdByUserId: 1 }, where)).toBe(true);
        expect(xSong.authorizeRowForView({ auth, model: { ...privateRow, createdByUserId: 1 } })).toBe(true);
        expect(matchesWhere({ ...row, bandId: 2 }, where)).toBe(false);
        expect(xSong.authorizeRowForView({ auth, model: { ...row, bandId: 2 } })).toBe(false);
        const ordinary = testBandAuthorization({ id: 1 }, new ServerPermissionSet([{ id: 100, name: Permission.view_songs }]));
        const ordinaryWhere = xSong.CalculateWhereClause({ auth: ordinary, filterModel: { tableParams: {} } });
        expect(matchesWhere(row, ordinaryWhere)).toBe(false);
        expect(xSong.authorizeRowForView({ auth: ordinary, model: row })).toBe(false);
    });

    it("offers active known visibility choices and resolves writes without manufacturing visibility grants", async () => {
        const auth = testBandAuthorization({ id: 1 }, new ServerPermissionSet([
            ...globalGrants.entries, { id: 901, name: Permission.public },
        ]));
        const definitions = [
            { id: 1, name: Permission.visibility_members, isDeleted: false },
            { id: 2, name: Permission.visibility_editors, isDeleted: false },
            { id: 3, name: Permission.visibility_public, isDeleted: false },
            { id: 4, name: Permission.visibility_logged_in_users, isDeleted: true },
            { id: 5, name: Permission.manage_events, isDeleted: false },
            { id: 6, name: "unknown_visibility", isDeleted: false },
        ].map(definition => ({ ...definition, isVisibility: true,
            publicId: parsePublicId<"Permission">(`ChoicePerm${String(definition.id).padStart(6, "0")}`) }));
        authorizationTestDb.reset({ permission: definitions });
        const where = permissionVisibilityView.getWhereClause({ auth, filter: {} });
        const choices = definitions.filter(definition => matchesWhere(definition, where));
        expect(choices.map(choice => choice.name)).toEqual([
            Permission.visibility_members, Permission.visibility_editors, Permission.visibility_public,
        ]);
        for (const definition of definitions) {
            expect(isSelectableBandVisibilityPermission(definition, auth)).toBe(definition.id <= 3);
            if (definition.id <= 3) {
                expect(await resolvePublicForeignIds(xEvent, { visiblePermissionId: definition.publicId }, auth, authorizationTestDb))
                    .toEqual({ visiblePermissionId: definition.id });
            } else {
                await expect(resolvePublicForeignIds(xEvent, { visiblePermissionId: definition.publicId }, auth, authorizationTestDb)).rejects.toThrow();
            }
        }
        await expect(resolvePublicForeignIds(xEvent, { visiblePermissionId: "MissingPerm00001" }, auth, authorizationTestDb)).rejects.toThrow();
        expect(await resolvePublicForeignIds(xEvent, { visiblePermissionId: null }, auth, authorizationTestDb))
            .toEqual({ visiblePermissionId: null });
        expect(auth.hasPermission(Permission.visibility_members)).toBe(false);
        expect(auth.hasPermission(Permission.visibility_editors)).toBe(false);
        const ordinary = testBandAuthorization({ id: 1 }, new ServerPermissionSet([
            { id: 1, name: Permission.visibility_members }, { id: 901, name: Permission.public },
        ]));
        expect(definitions.filter(definition => matchesWhere(definition,
            permissionVisibilityView.getWhereClause({ auth: ordinary, filter: {} }))).map(definition => definition.name))
            .toEqual([Permission.visibility_members]);
        await expect(resolvePublicForeignIds(xSong, { visiblePermissionId: definitions[1]!.publicId }, ordinary, authorizationTestDb)).rejects.toThrow();
    });
});
