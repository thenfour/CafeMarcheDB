

export enum Permission {
    login = "login", // basic permission to access the site at all.

    // for user-created objects like events / files, they have the ability to specify a permission that dictates who can
    // see the object. visibility permissions should be marked as such in the permissions table.
    // it's actually important that these are named "visibility_*" because of how the db is seeded
    visibility_editors = "visibility_editors",
    visibility_members = "visibility_members",
    visibility_logged_in_users = "visibility_logged_in_users",
    visibility_public = "visibility_public",

    admin_auth = "admin_auth", // roles, permissions
    impersonate_user = "impersonate_user",
    view_roles = "view_roles",
    view_permissions = "view_permissions",
    view_songs = "view_songs",
    admin_songs = "admin_songs",
    view_general_info = "view_general_info", // instruments, instrument tags,
    edit_song_credit_types = "edit_song_credit_types",

    view_events = "view_events",
    admin_events = "admin_events",
    edit_events = "edit_events",

    view_settings = "view_settings", // basically everyone should have this
    admin_settings = "admin_settings",

    admin_users = "admin_users",
    view_all_user_data = "view_all_user_data",

    admin_general = "admin_general",
    view_instruments = "view_instruments",

    change_own_password = "change_own_password",
    change_own_userInfo = "change_own_userInfo",

    associate_instrument_tags = "associate_instrument_tags",
    associate_song_tags = "associate_song_tags",
    edit_song_credits = "edit_song_credits",
};

