import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import type { SessionContext } from "@blitzjs/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { authorizePageRequest } from "src/auth/server/pageRequestAuthorization";

const loadAuth = vi.hoisted(() => vi.fn());
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: loadAuth }));

// The guard passes this session to the mocked loader without reading its fields.
const session = {} as SessionContext;
const band = parsePublicId<"Band">("RoutePolicyBand1");

const splitRoutes = [
    ["wiki/[...slug]", BandPermission.view_wiki_pages, Permission.login],
    ["wikiPageHistory", BandPermission.view_wiki_page_revisions, Permission.login],
    ["featureReports", BandPermission.view_feature_reports, Permission.login],
    ["menuLinks", BandPermission.customize_menu, Permission.login],
    ["customLinks", BandPermission.view_custom_links, Permission.login],
    ["editEventTags", BandPermission.admin_events, Permission.manage_global_catalogs],
    ["editFileTags", BandPermission.admin_files, Permission.manage_global_catalogs],
    ["editWikiPageTags", BandPermission.admin_wiki_pages, Permission.login],
    ["settings", Permission.login, Permission.login],
    ["roles", Permission.sysadmin, Permission.sysadmin],
    ["permissions", Permission.sysadmin, Permission.sysadmin],
    ["rolePermissions", Permission.sysadmin, Permission.sysadmin],
    ["adminUsers", Permission.manage_global_users, Permission.manage_global_users],
    ["profile", Permission.login, Permission.login],
    ["user/[...id_slug_tab]", Permission.login, Permission.manage_global_users],
] as const;

beforeEach(() => loadAuth.mockReset());

describe.each(splitRoutes)("independent route permission for %s", (suffix, bandPermission, platformPermission) => {
    it("uses the band permission with a band and the platform permission without one", async () => {
        const requirePermission = vi.fn();
        loadAuth.mockResolvedValue({ requirePermission });
        await authorizePageRequest(`/backstage/${suffix}`, session, band);
        expect(loadAuth).toHaveBeenLastCalledWith(session, band);
        expect(requirePermission).toHaveBeenLastCalledWith(bandPermission);
        await authorizePageRequest(`/platform/${suffix}`, session);
        expect(loadAuth).toHaveBeenLastCalledWith(session, undefined);
        expect(requirePermission).toHaveBeenLastCalledWith(platformPermission);
    });
    it("rejects missing band scope and band-scoped platform requests before loading authorization", async () => {
        await expect(authorizePageRequest(`/backstage/${suffix}`, session)).rejects.toMatchObject({ statusCode: 404 });
        await expect(authorizePageRequest(`/platform/${suffix}`, session, band)).rejects.toMatchObject({ statusCode: 404 });
        expect(loadAuth).not.toHaveBeenCalled();
    });

    it("propagates authorization rejection for both entrypoints", async () => {
        loadAuth.mockResolvedValue({ requirePermission: () => {
            throw new Error("Denied");
        } });
        await expect(authorizePageRequest(`/backstage/${suffix}`, session, band)).rejects.toThrow("Denied");
        await expect(authorizePageRequest(`/platform/${suffix}`, session)).rejects.toThrow("Denied");
    });
});
