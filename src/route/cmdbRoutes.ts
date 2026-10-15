import { removeTrailingSlash } from "@/shared/rootroot";
import { Permission } from "shared/permissions";
import { registryFor } from "./routeHelpers";


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
//type RouteScope = "platform" | "band";

// interface BackstageRouteDefinition {
//     key: string; // we could use pattern as the key right?
//     pattern: string; // the next route pattern e.g., /backstage/event/[...id_slug_tab]
//     caption: string; // todo: localize and describe what this is used for. page title? menu item caption?
//     permission: Permission;

//     // todo: breadcrumb scope ? if necessary.
//     scope: RouteScope;
//     // platform scope - platform vs. band (which requires band id)

//     // An authenticated selection page may be reachable before a band is selected.
//     // lsmb TODO: we should instead introduce separate routes for platform-level operations, then this goes away.
//     unscopedPermission?: Permission;
// }

type RouteCommon = {
    readonly nextPattern: string;
    readonly permission: Permission;
};

function route(options: { readonly permission: Permission }) {
    return <const TPattern extends string>(nextPattern: TPattern) => ({
        key: nextPattern,
        nextPattern,
        permission: options.permission,
    });
}

const kRouteRegistry = registryFor<RouteCommon>()({
    "/": route({ permission: Permission.public }),
    "/_error": route({ permission: Permission.public }),
    "/auth/signup": route({ permission: Permission.public }),
    "/auth/login": route({ permission: Permission.public }),
    "/auth/forgot-password": route({ permission: Permission.public }),
    "/404": route({ permission: Permission.public }),
    "/auth/admin-bootstrap": route({ permission: Permission.public }),
    "/auth/logout": route({ permission: Permission.public }),
    "/auth/reset-password": route({ permission: Permission.public }),
    "/auth/stopImpersonating": route({ permission: Permission.public }),
    "/[...customLinkSlug]": route({ permission: Permission.public }),
    "/backstage": route({ permission: Permission.public }),
    "/backstage/events": route({ permission: Permission.view_events_nonpublic }),
    "/backstage/event/[...id_slug_tab]": route({ permission: Permission.view_events_nonpublic }),
    "/backstage/songs": route({ permission: Permission.view_songs }),
    "/backstage/song/[...id_slug_tab]": route({ permission: Permission.view_songs }),
    "/backstage/files": route({ permission: Permission.access_file_landing_page }),
    "/backstage/file/[...id_slug_tab]": route({ permission: Permission.access_file_landing_page }),
    "/backstage/wikiPages": route({ permission: Permission.search_wiki_pages }),
    "/backstage/wiki/[...slug]": route({ permission: Permission.view_wiki_pages }),
    "/backstage/wikiPageHistory": route({ permission: Permission.view_wiki_page_revisions }),
    "/backstage/users": route({ permission: Permission.search_users }),
    "/backstage/user/[...id_slug_tab]": route({ permission: Permission.login }),
    "/backstage/profile": route({ permission: Permission.login }),
    "/backstage/calendar": route({ permission: Permission.view_events_nonpublic }),
    "/backstage/setlistPlanner": route({ permission: Permission.setlist_planner_access }),
    "/backstage/stats": route({ permission: Permission.view_events_reports }),
    "/backstage/featureReports": route({ permission: Permission.view_feature_reports }),
    "/backstage/practice-tools": route({ permission: Permission.practice_tools_use }),
    "/backstage/frontpagegallery": route({ permission: Permission.edit_public_homepage }),
    "/backstage/frontpageEvents": route({ permission: Permission.edit_public_homepage }),
    "/backstage/brand": route({ permission: Permission.manage_site_branding }),
    "/backstage/menuLinks": route({ permission: Permission.customize_menu }),
    "/backstage/customLinks": route({ permission: Permission.view_custom_links }),
    "/backstage/editEventTags": route({ permission: Permission.admin_events }),
    "/backstage/editEventTypes": route({ permission: Permission.manage_global_catalogs }),
    "/backstage/editEventStatuses": route({ permission: Permission.manage_global_catalogs }),
    "/backstage/editEventAttendances": route({ permission: Permission.manage_global_catalogs }),
    "/backstage/editSongTags": route({ permission: Permission.admin_songs }),
    "/backstage/editSongCreditTypes": route({ permission: Permission.manage_global_catalogs }),
    "/backstage/editFileTags": route({ permission: Permission.admin_files }),
    "/backstage/editWikiPageTags": route({ permission: Permission.admin_wiki_pages }),
    "/backstage/editUserTags": route({ permission: Permission.manage_user_taxonomy }),
    "/backstage/instruments": route({ permission: Permission.admin_instruments }),
    "/backstage/instrumentFunctionalGroups": route({ permission: Permission.admin_instruments }),
    "/backstage/instrument/[slug]": route({ permission: Permission.login }),
    "/backstage/eventImport": route({ permission: Permission.sysadmin }),
    "/backstage/editEvents": route({ permission: Permission.admin_events }),
    "/backstage/editEventSegments": route({ permission: Permission.admin_events }),
    "/backstage/editSongs": route({ permission: Permission.sysadmin }),
    "/backstage/editSongCredits": route({ permission: Permission.manage_songs }),
    "/backstage/userInstruments": route({ permission: Permission.manage_users }),
    "/backstage/userTags": route({ permission: Permission.manage_users }),
    "/backstage/userRoles": route({ permission: Permission.assign_user_roles }),
    "/backstage/recoverMembers": route({ permission: Permission.recover_users }),
    "/backstage/editFiles": route({ permission: Permission.admin_files }),
    "/backstage/editFrontpageGalleryItems": route({ permission: Permission.sysadmin }),
    "/backstage/calendarPreview": route({ permission: Permission.sysadmin }),
    "/backstage/settings": route({ permission: Permission.login }),
    "/backstage/roles": route({ permission: Permission.sysadmin }),
    "/backstage/permissions": route({ permission: Permission.sysadmin }),
    "/backstage/rolePermissions": route({ permission: Permission.sysadmin }),
    "/backstage/adminUsers": route({ permission: Permission.manage_global_users }),
    "/backstage/serverHealth": route({ permission: Permission.sysadmin }),
    "/backstage/adminLogs": route({ permission: Permission.sysadmin }),
    "/test/test": route({ permission: Permission.public }),
    "/backstage/gallery": route({ permission: Permission.sysadmin }),
    "/backstage/colorEditor2": route({ permission: Permission.sysadmin }),
    "/backstage/test": route({ permission: Permission.sysadmin }),
    "/backstage/test/test": route({ permission: Permission.sysadmin }),
    "/backstage/test/quickSearchTest": route({ permission: Permission.sysadmin }),
    "/backstage/test/CMSelectTest": route({ permission: Permission.sysadmin }),
    "/backstage/test/attendance": route({ permission: Permission.sysadmin }),
    "/backstage/test/date": route({ permission: Permission.sysadmin }),
    "/backstage/test/dialogs": route({ permission: Permission.sysadmin }),
    "/backstage/platform-wiki/[...slug]": route({ permission: Permission.login }),
    "/backstage/platform-wikiPageHistory": route({ permission: Permission.login }),
    "/backstage/platform-user/[...id_slug_tab]": route({ permission: Permission.manage_global_users }),
    "/backstage/platform-profile": route({ permission: Permission.login }),
    "/backstage/platform-featureReports": route({ permission: Permission.login }),
    "/backstage/platform-menuLinks": route({ permission: Permission.login }),
    "/backstage/platform-customLinks": route({ permission: Permission.login }),
    "/backstage/platform-editEventTags": route({ permission: Permission.manage_global_catalogs }),
    "/backstage/platform-editFileTags": route({ permission: Permission.manage_global_catalogs }),
    "/backstage/platform-editWikiPageTags": route({ permission: Permission.login }),
    "/backstage/platform-settings": route({ permission: Permission.login }),
    "/backstage/platform-roles": route({ permission: Permission.sysadmin }),
    "/backstage/platform-permissions": route({ permission: Permission.sysadmin }),
    "/backstage/platform-rolePermissions": route({ permission: Permission.sysadmin }),
    "/backstage/platform-adminUsers": route({ permission: Permission.manage_global_users }),
});

export type CmdbRouteKey = keyof typeof kRouteRegistry;
export type CmdbRouteDefinition = (typeof kRouteRegistry)[CmdbRouteKey];

function routeByKey<T extends CmdbRouteKey>(key: T) {
    return kRouteRegistry[key];
}

function isRouteKey(key: string): key is CmdbRouteKey {
    return Object.prototype.hasOwnProperty.call(kRouteRegistry, key);
}

function requireRouteKey(key: string): CmdbRouteKey {
    if (!isRouteKey(key)) {
        throw new Error(`Invalid route key: ${key}`);
    }
    return key;
}

// must return the actual type of the entry; they can be different shapes.
// Needed for reverse lookup: "which route am I currently on?"
// pattern is a next route like /backstage/event/[...id_slug_tab]
// because it's sanitized at runtime, there's no way to infer the actual type of the route;
// therefore the return is just the common base.
function requireRouteByPattern(pattern: string): CmdbRouteDefinition {
    const sanitizedRoute = removeTrailingSlash(pattern) || "/";
    return kRouteRegistry[requireRouteKey(sanitizedRoute)];
}

export const CmdbRoutes = {
    registry: kRouteRegistry,
    routes: Object.keys(kRouteRegistry),
    routeByKey,
    isRouteKey,
    requireRouteKey,
    requireRouteByPattern,
};
