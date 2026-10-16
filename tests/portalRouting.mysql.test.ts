import { PrismaClient } from "@prisma/client";
import { parsePortalPath } from "src/route/portalRouting";
import { NotFoundError } from "blitz";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { withAuthorizationBandScope } from "src/auth/server/requestAuthorizationScope";
import { resolvePortalPath, resolvePortalRequestContext } from "src/route/server/portalRequest";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture } from "./support/settingsMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("portal routing with native memberships and locales", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    beforeEach(() => {
        vi.stubEnv("CMDB_BASE_URL", "https://portal.test");
        vi.stubEnv("CMDB_HOSTING_MODE", "Platform");
    });
    afterEach(() => { vi.unstubAllEnvs(); });

    it("selects two portals independently and rejects cross-band payloads before authorization", () => withSettingsMysqlFixture(database!, async (tx, fixture) => {
        const bands = fixture.bands.map(band => parsePublicId<"Band">(band.publicId));
        for (const [index, band] of bands.entries()) {
            const path = parsePortalPath(`/fr-BE/b/${band}/backstage/profile`, { kind: "multiBand" });
            const portal = await resolvePortalRequestContext({ headers: {} }, path);
            expect(portal.requestPath.bandPublicId).toBe(band);
            await withAuthorizationBandScope(band, async () => {
                expect((await loadAuthorizationForUser(fixture.user, tx, band)).band?.publicId).toBe(band);
                await expect(loadAuthorizationForUser(fixture.user, tx, bands[1 - index])).rejects.toBeInstanceOf(NotFoundError);
                const account = await loadAuthorizationForUser(fixture.user, tx, null);
                expect(account.band).toBeNull();
                expect(() => account.requireBand()).toThrow();
            });
        }
    }));

    it("rejects a single-band deployment backed by multiple database bands", () => withSettingsMysqlFixture(database!, async (tx, fixture) => {
        const first = parsePublicId<"Band">(fixture.bands[0]!.publicId);
        const second = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        vi.stubEnv("CMDB_HOSTING_MODE", "GenericSingleTenant");
        await expect(resolvePortalPath(parsePortalPath("/nl-BE/b/backstage/profile", { kind: "singleBand", tenant: "generic" }), { kind: "singleBand", tenant: "generic" }, tx)).rejects.toThrow("exactly one Band");
        await withAuthorizationBandScope(first, async () => {
            await expect(loadAuthorizationForUser(fixture.user, tx, second)).rejects.toBeInstanceOf(NotFoundError);
        });
    }));

    it("does not turn a validated path into a stale membership grant", () => withSettingsMysqlFixture(database!, async (tx, fixture) => {
        const band = parsePublicId<"Band">(fixture.bands[0]!.publicId);
        await withAuthorizationBandScope(band, async () => {
            const before = await loadAuthorizationForUser(fixture.user, tx, band);
            expect(before.hasPermission(Permission.view_events_nonpublic)).toBe(true);
            await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } }, data: { isDeleted: true } });
            const after = await loadAuthorizationForUser(fixture.user, tx, band);
            expect(after.hasPermission(Permission.view_events_nonpublic)).toBe(false);
            expect(() => after.requireMembership()).toThrow();
        });
    }));
});
