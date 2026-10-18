# Authorization role simplification

Replace implicit permission grants and mixed scope rules with direct database
role-permission mappings. Keep band context explicit and make global authority
over band operations explicit.

## Target contract

- Permissions and roles each have two scopes: `global` and `band`. Remove the
  `public` and `account` permission scopes; rename `platform` scope to `global`.
- A role can grant only permissions matching its scope. Public access is
  configured through role grants, without a separate permission classification.
- Every visitor operates under exactly one global role. Selecting a band adds
  exactly one band role. Effective permissions are the union of those roles'
  explicit database grants.
- There are two database-designated Public roles: Global Public and Band Public.
  Anonymous visitors use Global Public, plus Band Public when a band is selected.
  Public roles occupy the corresponding role slots; their grants are never
  automatically added alongside an assigned role.
- `manage_events` belongs to band roles. A small set of explicit `global_`
  permissions may authorize defined administration, moderation or maintenance
  operations across bands. Feature policies recognize those capabilities
  explicitly; they do not expand into ordinary band permissions.
- Authentication, active membership and resource ownership remain separate
  checks. A permission cannot create an identity or membership. Global authority
  over band operations still requires an explicit target band.
- Account permissions and Sysadmin authority come from configured grants.
  Default roles, when needed, are assigned during account or membership creation.

## Decisions before implementation

Define role selection for authenticated accounts without an assigned global role,
users without an active membership, and active memberships without a role.
Specify when the corresponding Public role applies and when missing or invalid
configuration must fail. Public-role selection must never create membership.

Define the small set of global capabilities over band operations and exactly
which operations each permits. Avoid duplicating every band permission.

## Linear implementation plan

1. **Inventory and settle policy.** Trace role selection, automatic grants,
   Sysadmin assumptions, role defaults and scope checks. Resolve the decisions
   above and record the intended access changes.
2. **Define permission scopes and capabilities.** Classify every existing
   permission as global or band and specify the operation matrix for the new
   global capabilities. Keep authorization policies with their feature owners.
3. **Prepare the data migration.** Establish both Public designations, assign
   explicit account and membership roles, and replace mixed-scope grants and
   implicit account/Sysadmin authority with explicit configuration. Compare
   effective access before and after, accounting for every intended change.
4. **Simplify authorization resolution.** Resolve one role per applicable scope,
   enforce matching grant scopes on writes and reads, and remove automatic
   permission additions and inheritance from extra roles. Keep band grants out
   of shared sessions.
5. **Update consumers and administration.** Apply the policy to feature checks,
   routes, UI, role matrices/designations, signup/bootstrap, delegation and
   continuity checks. Remove obsolete scope logic and fallback paths.
6. **Verify behavior.** Cover anonymous and authenticated access, missing roles,
   nonmembers, inactive memberships, two bands, global administrative operations,
   visibility, revocation and invalid scope mappings. Run focused tests with
   `yarn test <test paths> --reporter=dot`, then the complete suite, typecheck,
   build and relevant browser checks.
7. **Rehearse and document the upgrade.** Validate fresh setup and migration on
   disposable existing data. Update the
   [authorization contract](05-authorization-foundation.md) and
   [restoration plan](04-implementation-plan.md) to describe the implemented
   behavior and verification results.
