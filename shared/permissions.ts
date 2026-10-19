import { registryFor } from "./registryHelpers";

export const PermissionScopes = ["global", "band"] as const

export type PermissionScope = (typeof PermissionScopes)[number]

export type PermissionPresentation = Readonly<{
  color: string
  iconName: string
  significance: string
}>

export type PermissionDefinition = Readonly<{
  key: string

  // Roles grant only permissions of their own scope. Band grants apply
  // within the explicitly selected band.
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

const permissionDefaults = {
  isProtected: false,
  isDelegable: true,
  isVisibility: false,
  isContinuitySensitive: false,
  presentation: undefined,
} as const;

// Preserve supplied literals and include defaults for omitted or undefined values.
type ResolvedPermissionOptions<TOptions extends PermissionOptions> = {
  readonly [K in keyof typeof permissionDefaults]: K extends keyof TOptions
  ? Exclude<TOptions[K], undefined>
  | (undefined extends TOptions[K] ? (typeof permissionDefaults)[K] : never)
  : (typeof permissionDefaults)[K];
};

function definePermission<
  const TScope extends PermissionScope,
  const TDescription extends string,
  const TSortOrder extends number,
  const TOptions extends PermissionOptions = {},
>(
  scope: TScope,
  description: TDescription,
  sortOrder: TSortOrder,
  options?: TOptions,
): <const TKey extends string>(key: TKey) => Readonly<{
  key: TKey;
  scope: TScope;
  description: TDescription;
  sortOrder: TSortOrder;
} & ResolvedPermissionOptions<TOptions>>;
function definePermission(
  scope: PermissionScope,
  description: string,
  sortOrder: number,
  options: PermissionOptions = {}
) {
  return <const TKey extends string>(key: TKey) => ({
    key,
    scope,
    description,
    sortOrder,
    isProtected: options.isProtected ?? permissionDefaults.isProtected,
    isDelegable: options.isDelegable ?? permissionDefaults.isDelegable,
    isVisibility: options.isVisibility ?? permissionDefaults.isVisibility,
    isContinuitySensitive: options.isContinuitySensitive ?? permissionDefaults.isContinuitySensitive,
    presentation: options.presentation,
  } as const satisfies PermissionDefinition);
}

const protectedPermission = { isProtected: true, isDelegable: false } as const

const visibilityPresentation = <
  const TColor extends string,
  const TIconName extends string,
  const TSignificance extends string,
>(
  color: TColor,
  iconName: TIconName,
  significance: TSignificance
) => ({
  isVisibility: true,
  presentation: { color, iconName, significance },
} as const satisfies PermissionOptions)

// This registry is the authority for every permission known to application code.
// Runtime constants, ordering, and security classifications below
// are generated from it so a permission cannot be added to only one view.
const permissionRegistry = registryFor<Omit<PermissionDefinition, "key">>()({
  always_grant: definePermission(
    "global",
    "Baseline authorization grant configured explicitly on roles.",
    0
  ),
  public: definePermission(
    "global",
    "Functionality available without a user account.",
    10
  ),
  login: definePermission(
    "global",
    "Access to account features as configured by role grants.",
    20
  ),
  member_access: definePermission(
    "band",
    "Access to member-only functionality for the active band.",
    25
  ),

  manage_band_settings: definePermission(
    "band",
    "Manage configuration for the active band.",
    100
  ),
  manage_band_localization: definePermission(
    "band",
    "Manage localized content and overrides for the active band.",
    103
  ),
  manage_site_branding: definePermission(
    "band",
    "Manage the site title, imagery, theme, et al.",
    105
  ),
  edit_public_homepage: definePermission(
    "band",
    "Edit public homepage content and gallery presentation.",
    110
  ),

  visibility_public: definePermission(
    "band",
    "Public visibility: everyone can see the object.",
    200,
    {
      ...visibilityPresentation("green", "Public", "Visibility_Public"),
    }
  ),
  visibility_logged_in_users: definePermission(
    "band",
    "Visibility restricted to authenticated users.",
    210,
    visibilityPresentation("blue", "Person", "Visibility_LoggedInUsers")
  ),
  visibility_members: definePermission(
    "band",
    "Visibility restricted to trusted site members.",
    220,
    visibilityPresentation("gold", "Security", "Visibility_Members")
  ),
  visibility_editors: definePermission(
    "band",
    "Visibility restricted to site editors.",
    230,
    visibilityPresentation("orange", "Lock", "Visibility_Editors")
  ),

  admin_events: definePermission(
    "band",
    "Manage event tags and configuration for the active band.",
    300
  ),
  manage_events: definePermission(
    "band",
    "Create, edit, and remove events.",
    310),
  recover_events: definePermission(
    "band",
    "View otherwise-visible deleted events and event configuration, and restore them.",
    315
  ),
  view_events: definePermission(
    "band",
    "View public event information.",
    320
  ),
  view_events_nonpublic: definePermission(
    "band",
    "View non-public event details such as attendance and internal descriptions.",
    330
  ),
  view_events_reports: definePermission("band", "View event reports.", 340),
  respond_to_events: definePermission(
    "band",
    "Respond to event attendance requests.",
    350
  ),
  change_others_event_responses: definePermission(
    "band",
    "Change another user's event response.",
    360
  ),

  admin_songs: definePermission(
    "band",
    "Manage song tags and configuration for the active band.",
    400
  ),
  manage_songs: definePermission("band", "Create, edit, and remove songs.", 410),
  recover_songs: definePermission(
    "band",
    "View otherwise-visible deleted songs and restore them.",
    415
  ),
  view_songs: definePermission("band", "View songs.", 420),
  pin_song_recordings: definePermission("band", "Pin recordings to songs.", 430),

  admin_files: definePermission(
    "band",
    "Manage file names, tags, and other file configuration.",
    500
  ),
  manage_files: definePermission("band", "Edit and remove files.", 510),
  recover_files: definePermission(
    "band",
    "View otherwise-visible deleted files and restore them.",
    515
  ),
  upload_files: definePermission("band", "Upload files.", 520),
  view_files: definePermission(
    "band",
    "View public files and homepage media.",
    530
  ),
  access_file_landing_page: definePermission(
    "band",
    "Access the file landing page.",
    540
  ),

  admin_instruments: definePermission(
    "band",
    "Manage band instruments and functional groups.",
    600
  ),
  manage_user_taxonomy: definePermission(
    "band",
    "Manage band member tag definitions and presentation.",
    700
  ),
  deactivate_users: definePermission(
    "band",
    "Deactivate memberships in the active band.",
    705,
    {
      isContinuitySensitive: true,
    }
  ),
  recover_users: definePermission(
    "band",
    "View and reactivate memberships within the active band.",
    706
  ),
  merge_users: definePermission(
    "global",
    "Merge eligible user accounts and view aggregate merge data across the organization.",
    707,
    protectedPermission
  ),
  assign_user_roles: definePermission(
    "band",
    "Assign preconfigured band roles within the actor's delegable permission envelope.",
    710,
    {
      isContinuitySensitive: true,
    }
  ),
  manage_users: definePermission(
    "band",
    "Manage membership data and assign existing band tags and instruments.",
    720
  ),
  search_users: definePermission("band", "Search the user directory.", 730),
  view_users_basic_info: definePermission(
    "band",
    "View the user landing page and basic member information.",
    740
  ),
  view_user_contact_info: definePermission(
    "band",
    "View other users' contact information such as email addresses and phone numbers.",
    750
  ),

  view_custom_links: definePermission("band", "View custom links.", 800),
  manage_custom_links: definePermission(
    "band",
    "Create, edit, and remove custom links.",
    810
  ),

  view_wiki_pages: definePermission("band", "View wiki pages.", 900),
  edit_wiki_pages: definePermission("band", "Create and edit wiki pages.", 910),
  admin_wiki_pages: definePermission(
    "band",
    "Perform wiki administration such as unlocking pages and managing revisions.",
    920
  ),
  search_wiki_pages: definePermission("band", "Search wiki pages.", 930),
  view_wiki_page_revisions: definePermission(
    "band",
    "View wiki page revision history.",
    940
  ),

  customize_menu: definePermission("band", "Customize site navigation menus.", 1100),
  setlist_planner_access: definePermission(
    "band",
    "Access the setlist planner.",
    1200
  ),
  view_feature_reports: definePermission("band", "View feature-usage reports.", 1300),
  practice_tools_use: definePermission(
    "global",
    "Use public practice tools.",
    1400
  ),
  global_band_admin: definePermission(
    "global",
    "Administer band features across the platform using an explicit target band.",
    8700,
    protectedPermission
  ),
  manage_bands: definePermission(
    "global",
    "Administer bands across the platform.",
    8800,
    protectedPermission
  ),
  manage_global_catalogs: definePermission(
    "global",
    "Manage shared catalogs and behavior definitions across all bands.",
    8810,
    protectedPermission
  ),
  manage_global_settings: definePermission(
    "global",
    "Manage platform configuration.",
    8820,
    protectedPermission
  ),
  manage_global_localization: definePermission(
    "global",
    "Manage global locales and localized string defaults.",
    8830,
    protectedPermission
  ),
  manage_global_users: definePermission(
    "global",
    "Administer shared accounts and global role assignments.",
    8840,
    { ...protectedPermission, isContinuitySensitive: true }
  ),
  impersonate_user: definePermission(
    "global",
    "Impersonate another user for technical support and debugging.",
    9000,
    protectedPermission
  ),

  // The designated Sysadmin role carries this protected platform capability.
  // Authority comes from the assigned role, never from User.isSysAdmin.
  // this permission is used broadly to identify features accessible only to system administrators.
  sysadmin: definePermission(
    "global",
    "Administer protected platform features; band administration requires global_band_admin.",
    9010,
    protectedPermission
  ),
  never_grant: definePermission(
    "global",
    "Authorization sentinel that must never be granted to a role.",
    9020,
    protectedPermission
  ),
})

type RegisteredPermissionDefinition = (typeof permissionRegistry)[keyof typeof permissionRegistry];

export type Permission = keyof typeof permissionRegistry;

// filter permissions by scope
export type PermissionInScope<TScope extends PermissionScope> = Extract<
  RegisteredPermissionDefinition, { scope: TScope }
>["key"];

export type BandScopedPermission = PermissionInScope<"band">;
export type GlobalScopedPermission = PermissionInScope<"global">;

type PermissionConstant = Readonly<{ [K in Permission]: K }>

const permissionDefinitions: readonly RegisteredPermissionDefinition[] = Object.values(permissionRegistry);

// Preserve Permission.foo call sites while deriving every value from the registry.
// Object.fromEntries loses literal mapped keys; the registry supplies every pair.
// eslint-disable-next-line @typescript-eslint/no-redeclare -- intentional value/type API
export const Permission = Object.freeze(
  Object.fromEntries(permissionDefinitions.map((definition) => [definition.key, definition.key]))
) as PermissionConstant;

export const gPermissionRegistry = permissionDefinitions;

export const gPermissionOrdered: Permission[] = permissionDefinitions.map(
  (definition) => definition.key
)

export const gProtectedPermissions: ReadonlySet<Permission> = new Set(
  permissionDefinitions
    .filter((definition) => definition.isProtected)
    .map((definition) => definition.key)
)

export const gContinuitySensitivePermissions: ReadonlySet<Permission> = new Set(
  permissionDefinitions
    .filter((definition) => definition.isContinuitySensitive)
    .map((definition) => definition.key)
)

export const isPermission = (value: string): value is Permission =>
  Object.prototype.hasOwnProperty.call(permissionRegistry, value)

// asPermission accepts a string, asserts that it's a valid permission, narrows the type to Permission if true.
export const asPermission = (value: string): Permission => {
  if (!isPermission(value)) {
    throw new Error(`Invalid permission: ${value}`);
  }
  return value;
}

export const getPermissionDefinition = <const TPermission extends Permission>(
  permission: TPermission,
): (typeof permissionRegistry)[TPermission] => permissionRegistry[permission];

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
export const includesPermission = (permNames: Permission[], permissionName: Permission): boolean => {
  return permNames.includes(permissionName);
};
