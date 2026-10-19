// shared; must be able to run server-side.
// that's one reason this  is here and not in the individual page files

import { removeTrailingSlash } from "@/shared/rootroot";
import { Permission } from "shared/permissions";
import { registryFor } from "shared/registryHelpers";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import type { PermissionRequirement } from "src/auth/shared/permissionRequirement";

// Next owns page matching. This registry maps its patterns to application identities and permissions.

type Theming = "platform" | "band";

type RouteCommon = {
    // key is added by registry system.
    readonly nextPattern: string;
    readonly permission: PermissionRequirement;
    readonly theming: Theming;
};

function route<const TPattern extends string>(pattern: TPattern, permission: PermissionRequirement, theming: Theming = "platform") {
    return <const TKey extends string>(key: TKey) => ({
        key,
        nextPattern: pattern,
        permission,
        theming,
    });
}

const kRouteRegistry = registryFor<RouteCommon>()({
    // root-like
    "root": route("/", Permission.public),
    "platformRoot": route("/platform", Permission.public),
    "_error": route("/_error", Permission.public),
    "auth_signup": route("/auth/signup", Permission.public),
    "auth_login": route("/auth/login", Permission.public),
    "auth_forgot-password": route("/auth/forgot-password", Permission.public),
    "_404": route("/404", Permission.public),
    "auth_admin-bootstrap": route("/auth/admin-bootstrap", Permission.public),
    "auth_logout": route("/auth/logout", Permission.public),
    "auth_resetpassword": route("/auth/reset-password", Permission.public),
    "auth_stopImpersonating": route("/auth/stopImpersonating", Permission.public),

    // band-scoped
    "customLink": route("/backstage/[...customLinkSlug]", Permission.public, "band"),
    "practiceTools": route("/backstage/practice-tools", Permission.practice_tools_use, "band"),

    "bandRoot": route("/backstage", Permission.public, "band"),
    "bandEvents": route("/backstage/events", BandPermission.view_events_nonpublic, "band"),
    "bandEvent": route("/backstage/event/[...id_slug_tab]", BandPermission.view_events_nonpublic, "band"),
    "bandSongs": route("/backstage/songs", BandPermission.view_songs, "band"),
    "bandSong": route("/backstage/song/[...id_slug_tab]", BandPermission.view_songs, "band"),
    "bandFiles": route("/backstage/files", BandPermission.access_file_landing_page, "band"),
    "bandFile": route("/backstage/file/[...id_slug_tab]", BandPermission.access_file_landing_page, "band"),
    "bandWikiPages": route("/backstage/wikiPages", BandPermission.search_wiki_pages, "band"),
    "bandWiki": route("/backstage/wiki/[...slug]", BandPermission.view_wiki_pages, "band"),
    "bandWikiPageHistory": route("/backstage/wikiPageHistory", BandPermission.view_wiki_page_revisions, "band"),
    "bandUsers": route("/backstage/users", BandPermission.search_users, "band"),
    "bandUser": route("/backstage/user/[...id_slug_tab]", Permission.login, "band"),
    "bandProfile": route("/backstage/profile", Permission.login, "band"),
    "bandCalendar": route("/backstage/calendar", BandPermission.view_events_nonpublic, "band"),
    "bandSetlistPlanner": route("/backstage/setlistPlanner", BandPermission.setlist_planner_access, "band"),
    "bandStats": route("/backstage/stats", BandPermission.view_events_reports, "band"),

    "bandFeatureReports": route("/backstage/featureReports", BandPermission.view_feature_reports, "band"),
    "bandFrontpagegallery": route("/backstage/frontpagegallery", BandPermission.edit_public_homepage, "band"),
    "bandFrontpageEvents": route("/backstage/frontpageEvents", BandPermission.edit_public_homepage, "band"),
    "bandBrand": route("/backstage/brand", BandPermission.manage_site_branding, "band"),
    "bandMenuLinks": route("/backstage/menuLinks", BandPermission.customize_menu, "band"),
    "bandCustomLinks": route("/backstage/customLinks", BandPermission.view_custom_links, "band"),
    "bandEditEventTags": route("/backstage/editEventTags", BandPermission.admin_events, "band"),
    "bandEditEventTypes": route("/backstage/editEventTypes", Permission.manage_global_catalogs, "band"),
    "bandEditEventStatuses": route("/backstage/editEventStatuses", Permission.manage_global_catalogs, "band"),
    "bandEditEventAttendances": route("/backstage/editEventAttendances", Permission.manage_global_catalogs, "band"),
    "bandEditSongTags": route("/backstage/editSongTags", BandPermission.admin_songs, "band"),
    "bandEditSongCreditTypes": route("/backstage/editSongCreditTypes", Permission.manage_global_catalogs, "band"),
    "bandEditFileTags": route("/backstage/editFileTags", BandPermission.admin_files, "band"),
    "bandEditWikiPageTags": route("/backstage/editWikiPageTags", BandPermission.admin_wiki_pages, "band"),
    "bandEditUserTags": route("/backstage/editUserTags", BandPermission.manage_user_taxonomy, "band"),
    "bandInstruments": route("/backstage/instruments", BandPermission.admin_instruments, "band"),
    "bandInstrumentFunctionalGroups": route("/backstage/instrumentFunctionalGroups", BandPermission.admin_instruments, "band"),
    "bandInstrument": route("/backstage/instrument/[slug]", Permission.login, "band"),
    "bandEventImport": route("/backstage/eventImport", Permission.sysadmin, "band"),
    "bandEditSongCredits": route("/backstage/editSongCredits", BandPermission.manage_songs, "band"),
    "bandUserInstruments": route("/backstage/userInstruments", BandPermission.manage_users, "band"),
    "bandUserTags": route("/backstage/userTags", BandPermission.manage_users, "band"),
    "bandUserRoles": route("/backstage/userRoles", BandPermission.assign_user_roles, "band"),
    "bandRecoverMembers": route("/backstage/recoverMembers", BandPermission.recover_users, "band"),
    "bandEditFiles": route("/backstage/editFiles", BandPermission.admin_files, "band"),
    "bandEditFrontpageGalleryItems": route("/backstage/editFrontpageGalleryItems", Permission.sysadmin, "band"),
    "bandCalendarPreview": route("/backstage/calendarPreview", Permission.sysadmin, "band"),
    "bandSettings": route("/backstage/settings", Permission.login, "band"),
    "bandRoles": route("/backstage/roles", Permission.sysadmin, "band"),
    "bandPermissions": route("/backstage/permissions", Permission.sysadmin, "band"),
    "bandRolePermissions": route("/backstage/rolePermissions", Permission.sysadmin, "band"),
    "bandAdminUsers": route("/backstage/adminUsers", Permission.manage_global_users, "band"),

    // global / platform / dev
    "adminLogs": route("/backstage/adminLogs", Permission.sysadmin),

    "platformWiki": route("/platform/wiki/[...slug]", Permission.login),
    "platformWikiPageHistory": route("/platform/wikiPageHistory", Permission.login),
    "platformUser": route("/platform/user/[...id_slug_tab]", Permission.manage_global_users),
    "platformProfile": route("/platform/profile", Permission.login),
    "platformFeatureReports": route("/platform/featureReports", Permission.login),
    "platformMenuLinks": route("/platform/menuLinks", Permission.login),
    "platformCustomLinks": route("/platform/customLinks", Permission.login),
    "platformEditEventTags": route("/platform/editEventTags", Permission.manage_global_catalogs),
    "platformEditFileTags": route("/platform/editFileTags", Permission.manage_global_catalogs),
    "platformEditWikiPageTags": route("/platform/editWikiPageTags", Permission.login),
    "platformSettings": route("/platform/settings", Permission.login),

    "platformRoles": route("/platform/roles", Permission.sysadmin),
    "platformPermissions": route("/platform/permissions", Permission.sysadmin),
    "platformRolePermissions": route("/platform/rolePermissions", Permission.sysadmin),
    "platformAdminUsers": route("/platform/adminUsers", Permission.manage_global_users),

    "serverHealth": route("/dev/serverHealth", Permission.sysadmin),
    "devGallery": route("/dev/gallery", Permission.sysadmin),
    "devColorEditor2": route("/dev/colorEditor2", Permission.sysadmin),
    "devTest_test": route("/dev/test", Permission.sysadmin),
    "devtestQuickSearchTest": route("/dev/quickSearchTest", Permission.sysadmin),
    "devtestCMSelectTest": route("/dev/CMSelectTest", Permission.sysadmin),
    "devtestAttendance": route("/dev/attendance", Permission.sysadmin),
    "devtestDate": route("/dev/date", Permission.sysadmin),
    "devtestDialogs": route("/dev/dialogs", Permission.sysadmin),
});

export type CmdbRouteKey = keyof typeof kRouteRegistry;
export type CmdbRouteDefinition = (typeof kRouteRegistry)[CmdbRouteKey];
export type CmdbRoutePattern = (typeof kRouteRegistry)[CmdbRouteKey]["nextPattern"];
const kRoutePatterns = Object.values(kRouteRegistry).map(entry => entry.nextPattern);

function routeByKey<T extends CmdbRouteKey>(key: T) {
    return kRouteRegistry[key];
}

function isRouteKey(key: unknown): key is CmdbRouteKey {
    return typeof key === "string" && Object.prototype.hasOwnProperty.call(kRouteRegistry, key);
}

const routesByPattern = new Map<string, CmdbRouteDefinition>(Object.values(kRouteRegistry).map(entry => [entry.nextPattern, entry]));

// must return the actual type of the entry; they can be different shapes.
// Needed for reverse lookup: "which route am I currently on?"
// pattern is a next route like /backstage/event/[...id_slug_tab]
// because it's sanitized at runtime, there's no way to infer the actual type of the route;
// therefore the return is just the common base.
function requireRouteByPattern(pattern: string): CmdbRouteDefinition {
    const sanitizedRoute = removeTrailingSlash(pattern) || "/";
    const entry = routesByPattern.get(sanitizedRoute);
    if (!entry) {
        throw new Error(`Invalid route pattern: ${pattern}`);
    }
    return entry;
}

export const CmdbRouteRegistry = {
    // registry: kRouteRegistry,
    allPatterns: kRoutePatterns,
    isRouteKey,
    requireRouteByPattern,
    routeByKey,
};
