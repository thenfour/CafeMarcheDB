

export enum Permission {

    always_grant = "always_grant", // opposite of never_grant. even though public, visibility_public, and always_grant seem to offer the same thing, they have theoretically different functions.
    public = "public", // in cases where the user has no User record, therefore no Role, and no other permissions. should not be assigned to any user roles for this reason.

    // basic permission to access the logged-in version of the site.
    // having a user identity grants you this.
    // require this for features which have no restriction on use, like viewing your profile, resetting your own password, or viewing the backstage front page.
    login = "login",

    // ability to view site things like users and basic stuff. this allows one level of trust after anonymously creating an account.
    // this shall be used for visibility of things like tags / instruments
    basic_trust = "basic_trust",

    // require this for site behvaiors:  managing roles and permissions,
    // do NOT use this for lower-level functions like managing tags, statuses, types, attributes; these should have their own permission like admin_events
    sysadmin = "sysadmin",
    never_grant = "never_grant", // no roles should have this permission; it's the opposite of public.

    // ***********************************************

    // for changing site content at the site level (site chrome, style, etc)
    // basically sysadmin but non-functional sitewide changes
    content_admin = "content_admin",

    // specific permission for this feature.
    impersonate_user = "impersonate_user",

    // for user-created objects like events / files, they have the ability to specify a permission that dictates who can
    // see the object. visibility permissions should be marked as such in the permissions table.
    // it's actually important that these are named "visibility_*" because of how the db is seeded
    visibility_editors = "visibility_editors",
    visibility_members = "visibility_members",
    visibility_logged_in_users = "visibility_logged_in_users",
    visibility_public = "visibility_public",// this is the only permission which is special-case in that EVERYONE will be authorized for it, no exceptions. so there are special cases for it like if you have no user object or no session.

    // ability to edit the homepage content
    edit_public_homepage = "edit_public_homepage",

    // ******************** event permissions.
    admin_events = "admin_events",// require this for managing event attributes like type, status, tags

    manage_events = "manage_events",// require this for editing events: descriptions, creating / editing / deleting events
    view_events = "view_events", // careful: events get public visibility but not everything in events is public.
    view_events_nonpublic = "view_events_nonpublic", // for things like description or attendance which is not public despite the event being public vis
    respond_to_events = "respond_to_events",
    change_others_event_responses = "change_others_event_responses",

    // ******************** song permissions.
    admin_songs = "admin_songs",
    manage_songs = "manage_songs",
    view_songs = "view_songs",

    // ******************** file permissions.
    admin_files = "admin_files",
    manage_files = "manage_files", // should be granted widely
    upload_files = "upload_files",
    view_files = "view_files",

    // ******************** instrument permissions.
    admin_instruments = "admin_instruments",
    manage_instruments = "manage_instruments",

    // ******************** user permissions.
    admin_users = "admin_users", // creating / deleting / editing users in general.
    manage_users = "manage_users",
    search_users = "search_users",

    // ******************** custom links
    // VISITING custom links is always permitted.
    view_custom_links = "view_custom_links",
    manage_custom_links = "manage_custom_links",

    // ******************** wiki
    view_wiki_pages = "view_wiki_pages",
    edit_wiki_pages = "edit_wiki_pages",

    // ******************** workflow
    view_workflow_instances = "view_workflow_instances", // you can view the workflows tab
    edit_workflow_instances = "edit_workflow_instances", // you can control things like assignees & due dates
    view_workflow_defs = "view_workflow_defs", // can you view workflow definitions / graphs?
    edit_workflow_defs = "edit_workflow_defs", // can you create or edit workflow definitions / graphs?
    admin_workflow_defs = "admin_workflow_defs", // technical admin operations

    // ******************** menu customization
    customize_menu = "customize_menu",

    // ******************** menu customization
    setlist_planner_access = "setlist_planner_access",
};

export const gPermissionOrdered: (keyof typeof Permission)[] = [
    Permission.always_grant,
    Permission.public,
    Permission.login,
    Permission.basic_trust,
    Permission.sysadmin,
    Permission.never_grant,
    Permission.content_admin,
    Permission.impersonate_user,
    Permission.visibility_editors,
    Permission.visibility_members,
    Permission.visibility_logged_in_users,
    Permission.visibility_public,
    Permission.edit_public_homepage,
    Permission.admin_events,
    Permission.manage_events,
    Permission.view_events,
    Permission.view_events_nonpublic,
    Permission.respond_to_events,
    Permission.change_others_event_responses,
    Permission.admin_songs,
    Permission.manage_songs,
    Permission.view_songs,
    Permission.admin_files,
    Permission.manage_files,
    Permission.view_files,
    Permission.upload_files,
    Permission.admin_instruments,
    Permission.manage_instruments,
    Permission.admin_users,
    Permission.manage_users,
    Permission.search_users,
    Permission.view_custom_links,
    Permission.manage_custom_links,
    Permission.view_wiki_pages,
    Permission.edit_wiki_pages,
    Permission.customize_menu,

    Permission.view_workflow_instances,
    Permission.edit_workflow_instances,
    Permission.view_workflow_defs,
    Permission.edit_workflow_defs,
    Permission.admin_workflow_defs,

    Permission.setlist_planner_access,
];

// these are granted automatically to public.
export const gPublicPermissions: Permission[] = [
    Permission.always_grant,
    Permission.view_files, // in order for homepage to show photos
    Permission.view_events,// events are visible to public because of homepage
    Permission.public,
    Permission.visibility_public,
];

