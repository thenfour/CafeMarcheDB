import { Permission } from "shared/permissions";

export interface BackstageRouteDefinition {
    key: string;
    pattern: string;
    caption: string;
    permission: Permission;
}

const routes = [
    { key: "root", pattern: "/", caption: "Home", permission: Permission.public },
    { key: "error", pattern: "/_error", caption: "Error", permission: Permission.public },
    { key: "signup", pattern: "/auth/signup", caption: "signup", permission: Permission.public },
    { key: "login", pattern: "/auth/login", caption: "login", permission: Permission.public },
    { key: "forgotPassword", pattern: "/auth/forgot-password", caption: "Forgot Password", permission: Permission.public },
    // maybe others need to be added since i removed the "/backstage/" restriction on this table.

    // /[...customLinkSlug] 
    { key: "customLink", pattern: "/[...customLinkSlug]", caption: "Custom Link", permission: Permission.public },

    // the backstage entrypoint is public because it contains login forms, public resources, practice tools.
    { key: "home", pattern: "/backstage", caption: "Home", permission: Permission.public },

    { key: "events", pattern: "/backstage/events", caption: "Events", permission: Permission.view_events_nonpublic },
    { key: "event", pattern: "/backstage/event/[...id_slug_tab]", caption: "Event", permission: Permission.view_events_nonpublic },
    { key: "songs", pattern: "/backstage/songs", caption: "Songs", permission: Permission.view_songs },
    { key: "song", pattern: "/backstage/song/[...id_slug_tab]", caption: "Song", permission: Permission.view_songs },
    { key: "files", pattern: "/backstage/files", caption: "File search", permission: Permission.access_file_landing_page },
    { key: "file", pattern: "/backstage/file/[...id_slug_tab]", caption: "File", permission: Permission.access_file_landing_page },
    { key: "wikiPages", pattern: "/backstage/wikiPages", caption: "Wiki search", permission: Permission.search_wiki_pages },
    { key: "wiki", pattern: "/backstage/wiki/[...slug]", caption: "Wiki", permission: Permission.view_wiki_pages },
    { key: "wikiPageHistory", pattern: "/backstage/wikiPageHistory", caption: "Wiki revision history", permission: Permission.view_wiki_page_revisions },
    { key: "users", pattern: "/backstage/users", caption: "User search", permission: Permission.search_users },
    { key: "user", pattern: "/backstage/user/[...id_slug_tab]", caption: "User", permission: Permission.view_users_basic_info },
    { key: "profile", pattern: "/backstage/profile", caption: "Your Profile", permission: Permission.basic_trust },
    { key: "calendar", pattern: "/backstage/calendar", caption: "Calendar subscription", permission: Permission.view_events_nonpublic },
    { key: "setlistPlanner", pattern: "/backstage/setlistPlanner", caption: "Setlist Planner", permission: Permission.setlist_planner_access },
    { key: "stats", pattern: "/backstage/stats", caption: "Event Stats", permission: Permission.view_events_reports },
    { key: "featureReports", pattern: "/backstage/featureReports", caption: "Feature Usage", permission: Permission.view_feature_reports },
    { key: "practiceTools", pattern: "/backstage/practice-tools", caption: "Practice Tools", permission: Permission.practice_tools_use },

    { key: "frontpagegallery", pattern: "/backstage/frontpagegallery", caption: "Photo Gallery", permission: Permission.edit_public_homepage },
    { key: "frontpageEvents", pattern: "/backstage/frontpageEvents", caption: "Agenda", permission: Permission.edit_public_homepage },
    { key: "brand", pattern: "/backstage/brand", caption: "Brand", permission: Permission.manage_site_branding },
    { key: "menuLinks", pattern: "/backstage/menuLinks", caption: "Menu Links", permission: Permission.customize_menu },
    { key: "customLinks", pattern: "/backstage/customLinks", caption: "Custom URLs", permission: Permission.view_custom_links },
    { key: "editEventTags", pattern: "/backstage/editEventTags", caption: "Event Tags", permission: Permission.admin_events },
    { key: "editEventTypes", pattern: "/backstage/editEventTypes", caption: "Event Types", permission: Permission.admin_events },
    { key: "editEventStatuses", pattern: "/backstage/editEventStatuses", caption: "Event Statuses", permission: Permission.admin_events },
    { key: "editEventAttendances", pattern: "/backstage/editEventAttendances", caption: "Event Attendance Options", permission: Permission.admin_events },
    { key: "editSongTags", pattern: "/backstage/editSongTags", caption: "Song Tags", permission: Permission.admin_songs },
    { key: "editSongCreditTypes", pattern: "/backstage/editSongCreditTypes", caption: "Song Credit Types", permission: Permission.admin_songs },
    { key: "editFileTags", pattern: "/backstage/editFileTags", caption: "File Tags", permission: Permission.admin_files },
    { key: "editWikiPageTags", pattern: "/backstage/editWikiPageTags", caption: "Wiki Page Tags", permission: Permission.admin_wiki_pages },
    { key: "editUserTags", pattern: "/backstage/editUserTags", caption: "User Tags", permission: Permission.sysadmin },
    { key: "instrumentTags", pattern: "/backstage/instrumentTags", caption: "Instrument Tags", permission: Permission.admin_instruments },
    { key: "instruments", pattern: "/backstage/instruments", caption: "Instruments", permission: Permission.admin_instruments },
    { key: "instrumentFunctionalGroups", pattern: "/backstage/instrumentFunctionalGroups", caption: "Functional Groups", permission: Permission.admin_instruments },
    { key: "instrument", pattern: "/backstage/instrument/[slug]", caption: "Instrument", permission: Permission.basic_trust },
    { key: "eventImport", pattern: "/backstage/eventImport", caption: "Import events", permission: Permission.sysadmin },
    { key: "editEvents", pattern: "/backstage/editEvents", caption: "Events", permission: Permission.admin_events },
    { key: "editEventSegments", pattern: "/backstage/editEventSegments", caption: "Event Segments", permission: Permission.admin_events },
    { key: "editSongs", pattern: "/backstage/editSongs", caption: "Songs", permission: Permission.admin_songs },
    { key: "editSongCredits", pattern: "/backstage/editSongCredits", caption: "Song Credits", permission: Permission.admin_songs },
    { key: "userInstruments", pattern: "/backstage/userInstruments", caption: "User Instruments", permission: Permission.admin_instruments },
    { key: "editFiles", pattern: "/backstage/editFiles", caption: "Files", permission: Permission.admin_files },
    { key: "editFrontpageGalleryItems", pattern: "/backstage/editFrontpageGalleryItems", caption: "Front page gallery", permission: Permission.edit_public_homepage },

    { key: "settings", pattern: "/backstage/settings", caption: "Settings", permission: Permission.sysadmin },
    { key: "roles", pattern: "/backstage/roles", caption: "Roles", permission: Permission.sysadmin },
    { key: "permissions", pattern: "/backstage/permissions", caption: "Permissions", permission: Permission.sysadmin },
    { key: "rolePermissions", pattern: "/backstage/rolePermissions", caption: "Permission matrix", permission: Permission.sysadmin },
    { key: "adminUsers", pattern: "/backstage/adminUsers", caption: "Users grid", permission: Permission.sysadmin },
    { key: "serverHealth", pattern: "/backstage/serverHealth", caption: "Server health", permission: Permission.sysadmin },
    { key: "calendarPreview", pattern: "/backstage/calendarPreview", caption: "iCal Preview", permission: Permission.sysadmin },
    { key: "gallery", pattern: "/backstage/gallery", caption: "Component Gallery", permission: Permission.sysadmin },
    { key: "colorEditor", pattern: "/backstage/colorEditor2", caption: "Color Editor", permission: Permission.sysadmin },
    { key: "adminLogs", pattern: "/backstage/adminLogs", caption: "Admin Logs", permission: Permission.sysadmin },
    { key: "test", pattern: "/backstage/test", caption: "Tests", permission: Permission.sysadmin },
    { key: "testIndex", pattern: "/backstage/test/test", caption: "Tests", permission: Permission.sysadmin },
    { key: "quickSearchTest", pattern: "/backstage/test/quickSearchTest", caption: "Quick Search Test", permission: Permission.sysadmin },
    { key: "selectTest", pattern: "/backstage/test/CMSelectTest", caption: "Select Test", permission: Permission.sysadmin },

    { key: "workflows", pattern: "/backstage/workflows", caption: "Workflows", permission: Permission.never_grant },
    { key: "editEventCustomFields", pattern: "/backstage/editEventCustomFields", caption: "Event Custom Fields", permission: Permission.never_grant },
] as const satisfies readonly BackstageRouteDefinition[];

export type BackstageRouteKey = (typeof routes)[number]["key"];
export const backstageRouteRegistry: readonly BackstageRouteDefinition[] = routes;

const routeByKey = new Map<string, BackstageRouteDefinition>(routes.map(route => [route.key, route]));
const routeByPattern = new Map<string, BackstageRouteDefinition>(routes.map(route => [route.pattern, route]));

export function getBackstageRoute(key: BackstageRouteKey): BackstageRouteDefinition {
    const route = routeByKey.get(key);
    if (!route) throw new Error(`Unknown backstage route: ${key}`);
    return route;
}

// Needed for reverse lookup: "which route am I currently on?"
export function findBackstageRouteByPattern(pattern: string): BackstageRouteDefinition | undefined {
    // 
    return routeByPattern.get(pattern.replace(/\/$/, "") || "/");
}
