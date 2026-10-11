
export const PermissionScopes = ["public", "account", "band", "platform"] as const

export type PermissionScope = (typeof PermissionScopes)[number]

export type PermissionPresentation = Readonly<{
  color: string
  iconName: string
  significance: string
}>

export type PermissionDefinition = Readonly<{
  key: string

  // Band grants apply only in the resolved band. Platform grants come from
  // global roles; authenticated account grants never create membership.
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
    "manage_band_settings",
    "band",
    "Manage configuration for the active band.",
    100
  ),
  definePermission(
    "manage_band_localization",
    "band",
    "Manage localized content and overrides for the active band.",
    103
  ),
  definePermission(
    "manage_site_branding",
    //"site-content",
    "band",
    "Manage the site title, imagery, theme, et al.",
    105
  ),
  definePermission(
    "edit_public_homepage",
    //"site-content",
    "band",
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
    "band",
    "Visibility restricted to trusted site members.",
    220,
    visibilityPresentation("gold", "Security", "Visibility_Members")
  ),
  definePermission(
    "visibility_editors",
    //"visibility",
    "band",
    "Visibility restricted to site editors.",
    230,
    visibilityPresentation("orange", "Lock", "Visibility_Editors")
  ),

  definePermission(
    "admin_events",
    //"events",
    "band",
    "Manage event tags and configuration for the active band.",
    300
  ),
  definePermission("manage_events",
    //"events", 
    "band", "Create, edit, and remove events.", 310),
  definePermission(
    "recover_events",
    //"events",
    "band",
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
    "band",
    "View non-public event details such as attendance and internal descriptions.",
    330
  ),
  definePermission("view_events_reports", //"events",
    "band", "View event reports.", 340),
  definePermission(
    "respond_to_events",
    //"events",
    "band",
    "Respond to event attendance requests.",
    350
  ),
  definePermission(
    "change_others_event_responses",
    //"events",
    "band",
    "Change another user's event response.",
    360
  ),

  definePermission(
    "admin_songs",
    //"songs",
    "band",
    "Manage song tags and configuration for the active band.",
    400
  ),
  definePermission("manage_songs", //"songs",
    "band", "Create, edit, and remove songs.", 410),
  definePermission(
    "recover_songs",
    //"songs",
    "band",
    "View otherwise-visible deleted songs and restore them.",
    415
  ),
  definePermission("view_songs", //"songs",
    "band", "View songs.", 420),
  definePermission("pin_song_recordings", //"songs",
    "band", "Pin recordings to songs.", 430),

  definePermission(
    "admin_files",
    //"files",
    "band",
    "Manage file names, tags, and other file configuration.",
    500
  ),
  definePermission("manage_files", //"files",
    "band", "Edit and remove files.", 510),
  definePermission(
    "recover_files",
    //"files",
    "band",
    "View otherwise-visible deleted files and restore them.",
    515
  ),
  definePermission("upload_files", //"files",
    "band", "Upload files.", 520),
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
    "band",
    "Access the file landing page.",
    540
  ),

  definePermission(
    "admin_instruments",
    //"instruments",
    "band",
    "Manage band instruments and functional groups.",
    600
  ),
  definePermission(
    "manage_user_taxonomy",
    //"users",
    "band",
    "Manage band member tag definitions and presentation.",
    700
  ),
  definePermission(
    "deactivate_users",
    //"users",
    "band",
    "Deactivate memberships in the active band.",
    705,
    {
      isContinuitySensitive: true,
    }
  ),
  definePermission(
    "recover_users",
    "band",
    "View and reactivate memberships within the active band.",
    706
  ),
  definePermission(
    "merge_users",
    "platform",
    "Merge eligible user accounts and view aggregate merge data across the organization.",
    707,
    protectedPermission
  ),
  definePermission(
    "assign_user_roles",
    //"users",
    "band",
    "Assign preconfigured band roles within the actor's delegable permission envelope.",
    710,
    {
      isContinuitySensitive: true,
    }
  ),
  definePermission(
    "manage_users",
    //"users",
    "band",
    "Manage membership data and assign existing band tags and instruments.",
    720
  ),
  definePermission("search_users", //"users",
    "band", "Search the user directory.", 730),
  definePermission(
    "view_users_basic_info",
    //"users",
    "band",
    "View the user landing page and basic member information.",
    740
  ),
  definePermission(
    "view_user_contact_info",
    "band",
    "View other users' contact information such as email addresses and phone numbers.",
    750
  ),

  definePermission("view_custom_links",// "custom-links",
    "band", "View custom links.", 800),
  definePermission(
    "manage_custom_links",
    //"custom-links",
    "band",
    "Create, edit, and remove custom links.",
    810
  ),

  definePermission("view_wiki_pages",// "wiki",
    "band", "View wiki pages.", 900),
  definePermission("edit_wiki_pages",// "wiki",
    "band", "Create and edit wiki pages.", 910),
  definePermission(
    "admin_wiki_pages",
    //"wiki",
    "band",
    "Perform wiki administration such as unlocking pages and managing revisions.",
    920
  ),
  definePermission("search_wiki_pages",// "wiki",
    "band", "Search wiki pages.", 930),
  definePermission(
    "view_wiki_page_revisions",
    //"wiki",
    "band",
    "View wiki page revision history.",
    940
  ),

  definePermission("customize_menu", //"menu", 
    "band", "Customize site navigation menus.", 1100),
  definePermission(
    "setlist_planner_access",
    //"setlists",
    "band",
    "Access the setlist planner.",
    1200
  ),
  definePermission("view_feature_reports", //"reports",
    "band", "View feature-usage reports.", 1300),
  definePermission(
    "practice_tools_use",
    //"practice-tools",
    "public",
    "Use public practice tools.",
    1400
  ),
  definePermission(
    "manage_bands",
    "platform",
    "Administer bands across the platform.",
    8800,
    protectedPermission
  ),
  definePermission(
    "manage_global_catalogs",
    "platform",
    "Manage shared catalogs and behavior definitions across all bands.",
    8810,
    protectedPermission
  ),
  definePermission(
    "manage_global_settings",
    "platform",
    "Manage platform configuration.",
    8820,
    protectedPermission
  ),
  definePermission(
    "manage_global_localization",
    "platform",
    "Manage global locales and localized string defaults.",
    8830,
    protectedPermission
  ),
  definePermission(
    "manage_global_users",
    "platform",
    "Administer shared accounts and global role assignments.",
    8840,
    { ...protectedPermission, isContinuitySensitive: true }
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
// Object.fromEntries loses literal mapped keys; the registry supplies every pair.
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

const permissionDefinitionByKey = new Map<string, PermissionDefinition>(
  permissionRegistry.map((definition) => [definition.key, definition])
)

export const isPermission = (value: string): value is Permission =>
  permissionDefinitionByKey.has(value)

// asPermission accepts a string, asserts that it's a valid permission, narrows the type to Permission if true.
export const asPermission = (value: string): Permission => {
  if (!isPermission(value)) {
    throw new Error(`Invalid permission: ${value}`);
  }
  return value;
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
