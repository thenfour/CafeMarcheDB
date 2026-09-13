
export const PermissionScopes = ["public", "account", "site", "platform"] as const

export type PermissionScope = (typeof PermissionScopes)[number]

export type PermissionPresentation = Readonly<{
  color: string
  iconName: string
  significance: string
}>

export type PermissionDefinition = Readonly<{
  key: string

  // todo: explain permission scope
  scope: PermissionScope
  description: string
  sortOrder: number

  // todo: explain permission protection
  isProtected: boolean
  // A delegable permission may safely be carried by a preconfigured role
  // assigned by a non-sysadmin. This does not authorize editing role grants.
  isDelegable: boolean
  isVisibility: boolean
  // Used for capabilities where removing the final non-Sysadmin holder could
  // leave the band unable to perform an important administrative operation.
  isContinuitySensitive: boolean
  presentation?: PermissionPresentation
}>

type PermissionOptions = Partial<
  Pick<
    PermissionDefinition,
    | "isProtected"
    | "isDelegable"
    | "isVisibility"
    | "isContinuitySensitive"
    | "presentation"
  >
>

const definePermission = <TKey extends string>(
  key: TKey,
  //category: PermissionCategory,
  scope: PermissionScope,
  description: string,
  sortOrder: number,
  options: PermissionOptions = {}
) =>
({
  key,
  //category,
  scope,
  description,
  sortOrder,
  isProtected: options.isProtected ?? false,
  isDelegable: options.isDelegable ?? true,
  isVisibility: options.isVisibility ?? false,
  isContinuitySensitive: options.isContinuitySensitive ?? false,
  presentation: options.presentation,
} as const satisfies PermissionDefinition)

const protectedPermission = { isProtected: true, isDelegable: false } as const

const visibilityPresentation = (
  color: string,
  iconName: string,
  significance: string
): PermissionOptions => ({
  isVisibility: true,
  presentation: { color, iconName, significance },
})

// This registry is the authority for every permission known to application code.
// Runtime constants, ordering, and security classifications below
// are generated from it so a permission cannot be added to only one view.
const permissionRegistry = [
  definePermission(
    "always_grant",
    //"access",
    "public",
    "Authorization sentinel granted to every visitor.",
    0
  ),
  definePermission(
    "public",
    //"access",
    "public",
    "Functionality available without a user account.",
    10
  ),
  definePermission(
    "login",
    //"access",
    "account",
    "Functionality available to any authenticated user.",
    20
  ),
  definePermission(
    "basic_trust",
    //"access",
    "account",
    "Ordinary member data available after an account has been trusted.",
    30
  ),

  definePermission(
    "manage_site_branding",
    //"site-content",
    "site",
    "Manage the site title, imagery, theme, et al.",
    105
  ),
  definePermission(
    "edit_public_homepage",
    //"site-content",
    "site",
    "Edit public homepage content and gallery presentation.",
    110
  ),

  definePermission(
    "visibility_public",
    //"visibility",
    "public",
    "Public visibility: everyone can see the object.",
    200,
    {
      ...visibilityPresentation("green", "Public", "Visibility_Public"),
    }
  ),
  definePermission(
    "visibility_logged_in_users",
    //"visibility",
    "account",
    "Visibility restricted to authenticated users.",
    210,
    visibilityPresentation("blue", "Person", "Visibility_LoggedInUsers")
  ),
  definePermission(
    "visibility_members",
    //"visibility",
    "site",
    "Visibility restricted to trusted site members.",
    220,
    visibilityPresentation("gold", "Security", "Visibility_Members")
  ),
  definePermission(
    "visibility_editors",
    //"visibility",
    "site",
    "Visibility restricted to site editors.",
    230,
    visibilityPresentation("orange", "Lock", "Visibility_Editors")
  ),

  definePermission(
    "admin_events",
    //"events",
    "site",
    "Manage event types, statuses, tags, and other event configuration.",
    300
  ),
  definePermission("manage_events",
    //"events", 
    "site", "Create, edit, and remove events.", 310),
  definePermission(
    "recover_events",
    //"events",
    "site",
    "View otherwise-visible deleted events and event configuration, and restore them.",
    315
  ),
  definePermission(
    "view_events",
    //"events",
    "public",
    "View public event information.",
    320
  ),
  definePermission(
    "view_events_nonpublic",
    //"events",
    "site",
    "View non-public event details such as attendance and internal descriptions.",
    330
  ),
  definePermission("view_events_reports", //"events",
    "site", "View event reports.", 340),
  definePermission(
    "respond_to_events",
    //"events",
    "site",
    "Respond to event attendance requests.",
    350
  ),
  definePermission(
    "change_others_event_responses",
    //"events",
    "site",
    "Change another user's event response.",
    360
  ),

  definePermission(
    "admin_songs",
    //"songs",
    "site",
    "Manage song tags, credit types, and other song configuration.",
    400
  ),
  definePermission("manage_songs", //"songs",
    "site", "Create, edit, and remove songs.", 410),
  definePermission(
    "recover_songs",
    //"songs",
    "site",
    "View otherwise-visible deleted songs and restore them.",
    415
  ),
  definePermission("view_songs", //"songs",
    "site", "View songs.", 420),
  definePermission("pin_song_recordings", //"songs",
    "site", "Pin recordings to songs.", 430),

  definePermission(
    "admin_files",
    //"files",
    "site",
    "Manage file names, tags, and other file configuration.",
    500
  ),
  definePermission("manage_files", //"files",
    "site", "Edit and remove files.", 510),
  definePermission(
    "recover_files",
    //"files",
    "site",
    "View otherwise-visible deleted files and restore them.",
    515
  ),
  definePermission("upload_files", //"files",
    "site", "Upload files.", 520),
  definePermission(
    "view_files",
    //"files",
    "public",
    "View public files and homepage media.",
    530
  ),
  definePermission(
    "access_file_landing_page",
    //"files",
    "site",
    "Access the file landing page.",
    540
  ),

  definePermission(
    "admin_instruments",
    //"instruments",
    "site",
    "Manage instrument definitions and functional groups.",
    600
  ),
  definePermission(
    "manage_user_taxonomy",
    //"users",
    "site",
    "Manage user tag definitions and user presentation metadata.",
    700
  ),
  definePermission(
    "deactivate_users",
    //"users",
    "site",
    "Deactivate ordinary user accounts and revoke their sessions.",
    705,
    {
      isContinuitySensitive: true,
    }
  ),
  definePermission(
    "recover_users",
    "site",
    "View deactivated user accounts and reactivate accounts within the actor's delegation authority.",
    706
  ),
  definePermission(
    "assign_user_roles",
    //"users",
    "site",
    "Assign preconfigured roles within the actor's delegable permission envelope.",
    710,
    {
      isContinuitySensitive: true,
    }
  ),
  definePermission(
    "manage_users",
    //"users",
    "site",
    "Manage ordinary user profile data and assign existing tags and instruments.",
    720
  ),
  definePermission("search_users", //"users",
    "site", "Search the user directory.", 730),
  definePermission(
    "view_users_basic_info",
    //"users",
    "site",
    "View the user landing page and basic member information.",
    740
  ),

  definePermission("view_custom_links",// "custom-links",
    "site", "View custom links.", 800),
  definePermission(
    "manage_custom_links",
    //"custom-links",
    "site",
    "Create, edit, and remove custom links.",
    810
  ),

  definePermission("view_wiki_pages",// "wiki",
    "site", "View wiki pages.", 900),
  definePermission("edit_wiki_pages",// "wiki",
    "site", "Create and edit wiki pages.", 910),
  definePermission(
    "admin_wiki_pages",
    //"wiki",
    "site",
    "Perform wiki administration such as unlocking pages and managing revisions.",
    920
  ),
  definePermission("search_wiki_pages",// "wiki",
    "site", "Search wiki pages.", 930),
  definePermission(
    "view_wiki_page_revisions",
    //"wiki",
    "site",
    "View wiki page revision history.",
    940
  ),

  // Workflows remain registered only until the separately approved removal slice.
  definePermission(
    "view_workflow_instances",
    //"workflows",
    "site",
    "View workflow instances and the workflow tab.",
    1000
  ),
  definePermission(
    "edit_workflow_instances",
    //"workflows",
    "site",
    "Manage workflow instance assignees and due dates.",
    1010
  ),
  definePermission(
    "view_workflow_defs",
    //"workflows",
    "site",
    "View workflow definitions and graphs.",
    1020
  ),
  definePermission(
    "edit_workflow_defs",
    //"workflows",
    "site",
    "Create and edit workflow definitions and graphs.",
    1030
  ),
  definePermission(
    "admin_workflow_defs",
    //"workflows",
    "site",
    "Perform technical workflow administration.",
    1040
  ),

  definePermission("customize_menu", //"menu", 
    "site", "Customize site navigation menus.", 1100),
  definePermission(
    "setlist_planner_access",
    //"setlists",
    "site",
    "Access the setlist planner.",
    1200
  ),
  definePermission("view_feature_reports", //"reports",
    "site", "View feature-usage reports.", 1300),
  definePermission(
    "practice_tools_use",
    //"practice-tools",
    "public",
    "Use public practice tools.",
    1400
  ),
  definePermission(
    "impersonate_user",
    //"system",
    "platform",
    "Impersonate another user for technical support and debugging.",
    9000,
    protectedPermission
  ),

  // The designated Sysadmin role carries this protected platform capability.
  // User.isSysAdmin assumes that role; it is not an authorization bypass.
  // this permission is used broadly to identify features accessible only to system administrators.
  definePermission(
    "sysadmin",
    //"system",
    "platform",
    "Bypass ordinary permission checks and administer the platform.",
    9010,
    protectedPermission
  ),
  definePermission(
    "never_grant",
    //"system",
    "platform",
    "Authorization sentinel that must never be granted to a role.",
    9020,
    protectedPermission
  ),
] as const satisfies readonly PermissionDefinition[]

export type Permission = (typeof permissionRegistry)[number]["key"]

type PermissionConstants = Readonly<{ [K in Permission]: K }>

// Preserve Permission.foo call sites while deriving every value from the registry.
// eslint-disable-next-line @typescript-eslint/no-redeclare -- intentional value/type API
export const Permission = Object.freeze(
  Object.fromEntries(permissionRegistry.map((definition) => [definition.key, definition.key]))
) as PermissionConstants

export const gPermissionRegistry: readonly PermissionDefinition[] = permissionRegistry

export const gPermissionOrdered: Permission[] = permissionRegistry.map(
  (definition) => definition.key
)

export const gProtectedPermissions: ReadonlySet<Permission> = new Set(
  permissionRegistry
    .filter((definition) => definition.isProtected)
    .map((definition) => definition.key)
)

export const gContinuitySensitivePermissions: ReadonlySet<Permission> = new Set(
  permissionRegistry
    .filter((definition) => definition.isContinuitySensitive)
    .map((definition) => definition.key)
)

const permissionDefinitionByKey = new Map<Permission, PermissionDefinition>(
  permissionRegistry.map((definition) => [definition.key, definition])
)

export const isPermission = (value: string): value is Permission =>
  permissionDefinitionByKey.has(value as Permission)

// asPermission accepts a string, asserts that it's a valid permission, narrows the type to Permission if true.
export const asPermission = (value: string): Permission => {
  if (!isPermission(value)) {
    throw new Error(`Invalid permission: ${value}`);
  }
  return value as Permission;
}

export const getPermissionDefinition = (permission: Permission): PermissionDefinition =>
  permissionDefinitionByKey.get(permission)!

export type PermissionDatabaseMetadata = Readonly<{
  description: string
  sortOrder: number
  isVisibility: boolean
  color?: string
  iconName?: string
  significance?: string
}>

export const getPermissionDatabaseMetadata = (
  definition: PermissionDefinition
): PermissionDatabaseMetadata => ({
  description: definition.description,
  sortOrder: definition.sortOrder,
  isVisibility: definition.isVisibility,
  ...(definition.presentation || {}),
})

// semantic helper is clearer than writing arr.includes(x) everywhere.
export const includesPermission = (permNames: string[], permissionName: Permission): boolean => {
  return permNames.includes(permissionName);
};
