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
    ["wiki/[...slug]", Permission.view_wiki_pages, Permission.login],
    ["wikiPageHistory", Permission.view_wiki_page_revisions, Permission.login],
    ["featureReports", Permission.view_feature_reports, Permission.login],
    ["menuLinks", Permission.customize_menu, Permission.login],
    ["customLinks", Permission.view_custom_links, Permission.login],
    ["editEventTags", Permission.admin_events, Permission.manage_global_catalogs],
    ["editFileTags", Permission.admin_files, Permission.manage_global_catalogs],
    ["editWikiPageTags", Permission.admin_wiki_pages, Permission.login],
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
    it.each([undefined, band])("uses each route's declared permission with band selection %s", async selectedBand => {
        const requirePermission = vi.fn();
        loadAuth.mockResolvedValue({ requirePermission });
        await authorizePageRequest(`/backstage/${suffix}`, session, selectedBand);
        expect(loadAuth).toHaveBeenLastCalledWith(session, selectedBand);
        expect(requirePermission).toHaveBeenLastCalledWith(bandPermission);
        await authorizePageRequest(`/backstage/platform-${suffix}`, session, selectedBand);
        expect(loadAuth).toHaveBeenLastCalledWith(session, selectedBand);
        expect(requirePermission).toHaveBeenLastCalledWith(platformPermission);
    });

    it("propagates authorization rejection for both entrypoints", async () => {
        loadAuth.mockResolvedValue({ requirePermission: () => {
            throw new Error("Denied");
        } });
        await expect(authorizePageRequest(`/backstage/${suffix}`, session, band)).rejects.toThrow("Denied");
        await expect(authorizePageRequest(`/backstage/platform-${suffix}`, session)).rejects.toThrow("Denied");
    });
});
