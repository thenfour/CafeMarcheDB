import { removeTrailingSlash } from "@/shared/utils";
import { Routes } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import type { BandPublicId } from "shared/publicId";
import { freezeRegistry } from "../setting/shared/registryHelpers";
import { z } from "zod";

// registry of PAGE routes.
// note that middleware will be invoked on all of these, plus RPC / dynamic.

// middleware sees routes RAW, with query params, NO hash value, before Next.js transforms them into page routes.
// MyApp.getInitialProps is only called for pages; it sees transformed next routes, like /backstage/event/[...id_slug_tab]
//
// example of visiting:
// http://localhost:10455/b/LRnHh3DGxoKiKKI7/backstage/event/Zqx_kLufC_3QMdyJ/rehearsal/setlists?param=123#xyzzzz

// [middleware] /b/LRnHh3DGxoKiKKI7/backstage/event/Zqx_kLufC_3QMdyJ/rehearsal/setlists
// [middleware] Rewriting to : http://localhost:10455/backstage/event/Zqx_kLufC_3QMdyJ/rehearsal/setlists?param=123&bandPublicId=LRnHh3DGxoKiKKI7
// [MyApp.getInitialProps] /b/LRnHh3DGxoKiKKI7/backstage/event/Zqx_kLufC_3QMdyJ/rehearsal/setlists {bandPublicId: 'LRnHh3DGxoKiKKI7', routeLocale: undefined, browserLanguages: Array(1), requestPath: '/b/LRnHh3DGxoKiKKI7/backstage/event/Zqx_kLufC_3QMdyJ/rehearsal/setlists', pathname: '/backstage/event/[...id_slug_tab]'}
// [middleware] /_next/static/chunks/webpack.js
// ...
// [middleware] /favicon.png
// [middleware] /api/rpc/getCurrentUser
// ...
// [middleware] /api/rpc/db3queries
// ...

// http://localhost:10455/b/LRnHh3DGxoKiKKI7/backstage/event/Zqx_kLufC_3QMdyJ/rehearsal/setlists?routeLocale=fr
// transforms to
// http://localhost:10455/fr/b/LRnHh3DGxoKiKKI7/backstage/event/Zqx_kLufC_3QMdyJ/rehearsal/setlists?routeLocale=fr
// and internally rewrites to
// http://localhost:10455/backstage/event/Zqx_kLufC_3QMdyJ/rehearsal/setlists?routeLocale=fr&bandPublicId=LRnHh3DGxoKiKKI7

// IOW, middleware doesn't know the next transformed route (e.g. /backstage/event/[...id_slug_tab])
// but we still have enough info to map incoming path -> backstage route, we just have to do it a bit manually.

// could be interesting to rewrite to canonical path in the browser nav bar; so far it's not done.
// http://localhost:10455/b/Ngy4gftLFYeRs-zq/backstage
// http://localhost:10455/backstage?bandPublicId=Ngy4gftLFYeRs-zq
// http://localhost:10455/backstage?bandPublicId=Ngy4gftLFYeRs-zq&routeLocale=nl

// so route definitions need to specify enough info to understand how to extract params & map requests
// in middleware.

// registry entries need to be able to
// - say "yes that's me" to a  raw incoming request path.
// - be able to generate a canonical url, given context


// /b/LRnHh3DGxoKiKKI7/backstage/event/Zqx_kLufC_3QMdyJ/rehearsal/setlists

// platform
// band = expects band id
type RouteScope = "platform" | "band";

interface BackstageRouteDefinition {
    key: string; // we could use pattern as the key right?
    pattern: string; // the next route pattern e.g., /backstage/event/[...id_slug_tab]
    caption: string; // todo: localize and describe what this is used for. page title? menu item caption?
    permission: Permission;

    // breadcrumb scope
    scope: RouteScope;
    // platform scope - platform vs. band (which requires band id)

    // An authenticated selection page may be reachable before a band is selected.
    // TODO: we should instead introduce separate routes for platform-level operations, then this goes away.
    unscopedPermission?: Permission;
}

// const rz = freezeRegistry({
//     "/": (key) => ({ defaultValue: 0, schema: z.number() }),
// });

const routes = [
    { key: "root", pattern: "/", caption: "Home", permission: Permission.public, scope: "platform" },
    { key: "error", pattern: "/_error", caption: "Error", permission: Permission.public, scope: "platform" },

    { key: "signup", pattern: "/auth/signup", caption: "signup", permission: Permission.public, scope: "platform" },
    { key: "login", pattern: "/auth/login", caption: "login", permission: Permission.public, scope: "platform" },
    { key: "forgotPassword", pattern: "/auth/forgot-password", caption: "Forgot Password", permission: Permission.public, scope: "platform" },

    { key: "/404", pattern: "/404", caption: "/404", permission: Permission.public, scope: "platform" },
    { key: "/auth/admin-bootstrap", pattern: "/auth/admin-bootstrap", caption: "/auth/admin-bootstrap", permission: Permission.public, scope: "platform" },
    { key: "/auth/logout", pattern: "/auth/logout", caption: "/auth/logout", permission: Permission.public, scope: "platform" },
    { key: "/auth/reset-password", pattern: "/auth/reset-password", caption: "/auth/reset-password", permission: Permission.public, scope: "platform" },
    { key: "/auth/stopImpersonating", pattern: "/auth/stopImpersonating", caption: "/auth/stopImpersonating", permission: Permission.public, scope: "platform" },
    { key: "/test/test", pattern: "/test/test", caption: "/test/test", permission: Permission.public, scope: "platform" },

    { key: "customLink", pattern: "/[...customLinkSlug]", caption: "Custom Link", permission: Permission.public, scope: "band" },

    // the backstage entrypoint is public because it contains login forms, public resources, practice tools.
    { key: "home", pattern: "/backstage", caption: "Home", permission: Permission.public, scope: "band" },

    { key: "events", pattern: "/backstage/events", caption: "Events", permission: Permission.view_events_nonpublic, scope: "band" },
    { key: "event", pattern: "/backstage/event/[...id_slug_tab]", caption: "Event", permission: Permission.view_events_nonpublic, scope: "band" },
    { key: "songs", pattern: "/backstage/songs", caption: "Songs", permission: Permission.view_songs, scope: "band" },
    { key: "song", pattern: "/backstage/song/[...id_slug_tab]", caption: "Song", permission: Permission.view_songs, scope: "band" },
    { key: "files", pattern: "/backstage/files", caption: "File search", permission: Permission.access_file_landing_page, scope: "band" },
    { key: "file", pattern: "/backstage/file/[...id_slug_tab]", caption: "File", permission: Permission.access_file_landing_page, scope: "band" },
    { key: "wikiPages", pattern: "/backstage/wikiPages", caption: "Wiki search", permission: Permission.search_wiki_pages, scope: "band" },
    { key: "wiki", pattern: "/backstage/wiki/[...slug]", caption: "Wiki", permission: Permission.view_wiki_pages, unscopedPermission: Permission.login, scope: "band" },
    { key: "wikiPageHistory", pattern: "/backstage/wikiPageHistory", caption: "Wiki revision history", permission: Permission.view_wiki_page_revisions, unscopedPermission: Permission.login, scope: "band" },
    { key: "users", pattern: "/backstage/users", caption: "User search", permission: Permission.search_users, scope: "band" },
    { key: "user", pattern: "/backstage/user/[...id_slug_tab]", caption: "Member", permission: Permission.login, scope: "band" },// login admits roleless members to their own profile.
    { key: "profile", pattern: "/backstage/profile", caption: "Your Profile", permission: Permission.login, scope: "band" },
    { key: "calendar", pattern: "/backstage/calendar", caption: "Calendar subscription", permission: Permission.view_events_nonpublic, scope: "band" },
    { key: "setlistPlanner", pattern: "/backstage/setlistPlanner", caption: "Setlist Planner", permission: Permission.setlist_planner_access, scope: "band" },
    { key: "stats", pattern: "/backstage/stats", caption: "Event Stats", permission: Permission.view_events_reports, scope: "band" },
    { key: "featureReports", pattern: "/backstage/featureReports", caption: "Feature Usage", permission: Permission.view_feature_reports, unscopedPermission: Permission.login, scope: "band" },
    { key: "practiceTools", pattern: "/backstage/practice-tools", caption: "Practice Tools", permission: Permission.practice_tools_use, scope: "band" },

    { key: "frontpagegallery", pattern: "/backstage/frontpagegallery", caption: "Photo Gallery", permission: Permission.edit_public_homepage, scope: "band" },
    { key: "frontpageEvents", pattern: "/backstage/frontpageEvents", caption: "Agenda", permission: Permission.edit_public_homepage, scope: "band" },
    { key: "brand", pattern: "/backstage/brand", caption: "Brand", permission: Permission.manage_site_branding, scope: "band" },
    { key: "menuLinks", pattern: "/backstage/menuLinks", caption: "Menu Links", permission: Permission.customize_menu, unscopedPermission: Permission.login, scope: "band" },
    { key: "customLinks", pattern: "/backstage/customLinks", caption: "Custom URLs", permission: Permission.view_custom_links, unscopedPermission: Permission.login, scope: "band" },
    { key: "editEventTags", pattern: "/backstage/editEventTags", caption: "Event Tags", permission: Permission.admin_events, unscopedPermission: Permission.manage_global_catalogs, scope: "band" },
    { key: "editEventTypes", pattern: "/backstage/editEventTypes", caption: "Event Types", permission: Permission.manage_global_catalogs, scope: "band" },
    { key: "editEventStatuses", pattern: "/backstage/editEventStatuses", caption: "Event Statuses", permission: Permission.manage_global_catalogs, scope: "band" },
    { key: "editEventAttendances", pattern: "/backstage/editEventAttendances", caption: "Event Attendance Options", permission: Permission.manage_global_catalogs, scope: "band" },
    { key: "editSongTags", pattern: "/backstage/editSongTags", caption: "Song Tags", permission: Permission.admin_songs, scope: "band" },
    { key: "editSongCreditTypes", pattern: "/backstage/editSongCreditTypes", caption: "Song Credit Types", permission: Permission.manage_global_catalogs, scope: "band" },
    { key: "editFileTags", pattern: "/backstage/editFileTags", caption: "File Tags", permission: Permission.admin_files, unscopedPermission: Permission.manage_global_catalogs, scope: "band" },
    { key: "editWikiPageTags", pattern: "/backstage/editWikiPageTags", caption: "Wiki Page Tags", permission: Permission.admin_wiki_pages, unscopedPermission: Permission.login, scope: "band" },
    { key: "editUserTags", pattern: "/backstage/editUserTags", caption: "Member Tag Catalog", permission: Permission.manage_user_taxonomy, scope: "band" },
    { key: "instruments", pattern: "/backstage/instruments", caption: "Instruments", permission: Permission.admin_instruments, scope: "band" },
    { key: "instrumentFunctionalGroups", pattern: "/backstage/instrumentFunctionalGroups", caption: "Functional Groups", permission: Permission.admin_instruments, scope: "band" },
    { key: "instrument", pattern: "/backstage/instrument/[slug]", caption: "Instrument", permission: Permission.login, scope: "band" },
    { key: "eventImport", pattern: "/backstage/eventImport", caption: "Import events", permission: Permission.sysadmin, scope: "band" },
    { key: "editEvents", pattern: "/backstage/editEvents", caption: "Events", permission: Permission.admin_events, scope: "band" },
    { key: "editEventSegments", pattern: "/backstage/editEventSegments", caption: "Event Segments", permission: Permission.admin_events, scope: "band" },
    { key: "editSongs", pattern: "/backstage/editSongs", caption: "Songs", permission: Permission.sysadmin, scope: "band" },
    { key: "editSongCredits", pattern: "/backstage/editSongCredits", caption: "Song Credits", permission: Permission.manage_songs, scope: "band" },
    { key: "userInstruments", pattern: "/backstage/userInstruments", caption: "Member Instruments", permission: Permission.manage_users, scope: "band" },
    { key: "userTags", pattern: "/backstage/userTags", caption: "Member Tags", permission: Permission.manage_users, scope: "band" },
    { key: "userRoles", pattern: "/backstage/userRoles", caption: "Member Roles", permission: Permission.assign_user_roles, scope: "band" },
    { key: "recoverMembers", pattern: "/backstage/recoverMembers", caption: "Recover Members", permission: Permission.recover_users, scope: "band" }, // or is this platform? depends what recovery means. membership or user.
    { key: "editFiles", pattern: "/backstage/editFiles", caption: "Files", permission: Permission.admin_files, scope: "band" },
    { key: "editFrontpageGalleryItems", pattern: "/backstage/editFrontpageGalleryItems", caption: "Front page gallery", permission: Permission.sysadmin, scope: "band" },

    { key: "calendarPreview", pattern: "/backstage/calendarPreview", caption: "iCal Preview", permission: Permission.sysadmin, scope: "band" },

    // The hive snapshot owns per-key access; every active account can edit its own preferences.
    { key: "settings", pattern: "/backstage/settings", caption: "Settings", permission: Permission.login, scope: "band" }, // currently mixed scope. todo: separate band & platform.
    { key: "roles", pattern: "/backstage/roles", caption: "Roles", permission: Permission.sysadmin, scope: "band" }, // currently mixed scope. todo: separate band & platform.
    { key: "permissions", pattern: "/backstage/permissions", caption: "Permissions", permission: Permission.sysadmin, scope: "band" }, // currently mixed scope. todo: separate band & platform.
    { key: "rolePermissions", pattern: "/backstage/rolePermissions", caption: "Permission matrix", permission: Permission.sysadmin, scope: "band" }, // currently mixed scope. todo: separate band & platform.
    { key: "adminUsers", pattern: "/backstage/adminUsers", caption: "Platform accounts", permission: Permission.manage_global_users, scope: "band" }, // currently mixed scope. todo: separate band & platform.
    { key: "serverHealth", pattern: "/backstage/serverHealth", caption: "Server health", permission: Permission.sysadmin, scope: "platform" },
    { key: "gallery", pattern: "/backstage/gallery", caption: "Component Gallery", permission: Permission.sysadmin, scope: "band" }, // even though it's a dev tool, it uses band-scoped data.
    { key: "colorEditor", pattern: "/backstage/colorEditor2", caption: "Color Editor", permission: Permission.sysadmin, scope: "platform" },
    { key: "adminLogs", pattern: "/backstage/adminLogs", caption: "Admin Logs", permission: Permission.sysadmin, scope: "platform" }, // this must be for sysadmin because it reveals database IDs.
    { key: "test", pattern: "/backstage/test", caption: "Tests", permission: Permission.sysadmin, scope: "platform" },

    { key: "testIndex", pattern: "/backstage/test/test", caption: "Tests", permission: Permission.sysadmin, scope: "platform" },
    { key: "quickSearchTest", pattern: "/backstage/test/quickSearchTest", caption: "Quick Search Test", permission: Permission.sysadmin, scope: "platform" },
    { key: "selectTest", pattern: "/backstage/test/CMSelectTest", caption: "Select Test", permission: Permission.sysadmin, scope: "platform" },
    { key: "attendanceTest", pattern: "/backstage/test/attendance", caption: "Attendance scenarios", permission: Permission.sysadmin, scope: "platform" },
    { key: "dateTest", pattern: "/backstage/test/date", caption: "Date Test", permission: Permission.sysadmin, scope: "platform" },
    { key: "dialogTest", pattern: "/backstage/test/dialogs", caption: "Dialog UX Test", permission: Permission.sysadmin, scope: "platform" },

    // platform
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
// pattern is a next route like /backstage/event/[...id_slug_tab]
export function findBackstageRouteByPattern(pattern: string): BackstageRouteDefinition | undefined {
    return routeByPattern.get(removeTrailingSlash(pattern) || "/");
}

// todo: this should go away. at the route-level, either we require a band or it's platform-scoped.
export function pageRoutePermission(route: BackstageRouteDefinition, bandPublicId: BandPublicId | null | undefined): Permission {
    return bandPublicId == null ? route.unscopedPermission ?? route.permission : route.permission;
}

export function ValidateRouteRegistry(): void {
    // check that our registry keys cover all Blitz routes
    const blitzRoutePaths: string[] = [
        "/_error", // arg i wish there was a central known place to get ALL POSSIBLE routes that will be checked.
        ...Object.values(Routes).map(route => route({} as any).pathname)
    ];
    const ourRoutePaths: string[] = routes.map(route => route.pattern);
    const errorMessages: string[] = [];
    for (const path of blitzRoutePaths) {
        if (!ourRoutePaths.includes(path)) {
            errorMessages.push(`Missing route in our registry: ${path}`);
        }
    }
    // and check stale routes in our registry that are not in Blitz routes
    for (const path of ourRoutePaths) {
        if (!blitzRoutePaths.includes(path)) {
            errorMessages.push(`Stale route in our registry: ${path}`);
        }
    }
    if (errorMessages.length > 0) {
        throw new Error(`Route registry validation failed:\n${errorMessages.join("\n")}`);
    }
}
