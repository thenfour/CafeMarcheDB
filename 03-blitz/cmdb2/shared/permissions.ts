

export enum Permission {
    login = "login", // basic permission to access the site at all.

    admin_auth = "admin_auth", // roles, permissions
    view_roles = "view_roles",
    view_permissions = "view_permissions",
    view_songs = "view_songs",
    admin_songs = "admin_songs",
    view_general_info = "view_general_info", // instruments, instrument tags,

    view_events = "view_events",
    admin_events = "admin_events",

    view_settings = "view_settings",
    admin_settings = "admin_settings",

    admin_users = "admin_users",
    view_all_user_data = "view_all_user_data",

    admin_general = "admin_general",

    change_own_password = "change_own_password",
};

