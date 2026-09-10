# Band Admin Authorization Hardening

- Last updated: 2026-09-10
- Overall status: Implementation
- Audit type: Static code-path audit plus read-only inspection of the configured local database
- Implementation status: BA-T001, BA-A001, and BA-A002 complete; BA-A003 next

## Goal

Introduce a **Band Admin** role above Moderator and below Sysadmin. A Band Admin must be able to run the band's site, including ordinary user administration and domain configuration, without gaining access to server administration, security-policy administration, protected accounts, secrets, or developer tooling.

This document is the working source of truth for the hardening and rollout. Keep it updated as decisions are made and work is completed.

## Completion definition

The goal is complete only when all of the following are true:

- [ ] Generic database query and mutation paths enforce table, row, field, association, filter, and delete authorization on the server.
- [ ] No non-sysadmin path can set `User.isSysAdmin`, grant a protected permission, assign a protected role, or take over a protected account.
- [ ] Band Admin can perform the agreed domain, site-configuration, and ordinary user-management operations.
- [ ] Band Admin cannot access server diagnostics, raw environment/configuration, security topology, unrestricted impersonation, raw sensitive logs, or developer/debug surfaces.
- [ ] Permission grants and revocations take effect reliably for existing sessions.
- [ ] Existing installations receive Band Admin through an idempotent migration without overwriting customized grants.
- [ ] Fresh database initialization and existing-database migration produce equivalent built-in roles and grants.
- [ ] Menu visibility, page access, and server authorization agree.
- [ ] Positive and adversarial authorization tests cover every role tier.
- [ ] The configured deployment has been reviewed against the single-tenant assumption.
- [ ] The unused workflow feature has been completely removed from UI, server code, permissions, initialization, and database schema.
- [ ] Final rollout verification has been recorded in the progress log.

## Status conventions

- `[ ]` — not started
- `[x]` — complete and verified
- Use `Status: In progress` beneath an item while it is actively being worked.
- A task is not complete until its acceptance criteria have evidence recorded.
- Security behavior must be verified at the server boundary; hiding UI is not sufficient.

## Current architecture and audit snapshot

Snapshot date: 2026-09-10

- A user has one nullable role. Roles receive permissions through `RolePermission`; there is no inheritance or authorization rank.
- `Role.sortOrder` is display metadata, not a security boundary.
- `Role.significance` currently has only `General`; there is no stable built-in-role key or protected-role marker.
- `User.isSysAdmin` independently bypasses all permission checks. The `sysadmin` permission is a second superuser mechanism.
- The configured local database has six roles and 51 permissions, with no Band Admin role.
- The local Admin role has 49 permissions. It lacks `never_grant` and `practice_tools_use`; its user still receives universal access through `isSysAdmin`.
- At audit time the repository had no `*.test.*` or `*.spec.*` files. BA-T001 introduced the initial authorization suite.
- The data model is single-tenant per database: users, roles, and content have no band/site ownership key. Multi-tenancy is a planned feature.
- The workflow feature is not used by any tenant and will be removed as a prerequisite instead of being hardened for Band Admin.

Primary references:

- [Role and User models](../db/schema.prisma#L40)
- [Permission definitions](../shared/permissions.ts#L3)
- [Permission checks and session public data](../types.ts#L41)
- [DB3 authorization core](../src/core/db3/shared/db3core.ts#L353)
- [Default role provisioning](../src/setup/instrumentation-setup.ts#L70)

## Recommended target boundary

These are recommended defaults. Product decisions that still require confirmation are listed separately below.

| Area                                    | Band Admin                                                                 | Sysadmin only                                                          |
| --------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Events, songs, files, instruments, wiki | Full domain administration                                                 | Server/debug internals                                                 |
| Workflows                               | Not available; remove the unused feature before rollout                    | Not available after removal                                            |
| Users                                   | Create, edit, deactivate, and reset ordinary users; assign permitted roles | Protected accounts and `isSysAdmin`                                    |
| Roles and permissions                   | Assign predefined non-protected roles                                      | Role CRUD, Permission CRUD, and the permission matrix                  |
| Site configuration                      | Brand, logo, favicon, theme, calendar identity, site copy, and menus       | Hosting mode, raw settings, and bulk configuration                     |
| Reports                                 | Event and feature reports                                                  | Server diagnostics                                                     |
| Audit                                   | Optional redacted band audit                                               | Raw change records and credential-bearing history                      |
| Support                                 | No impersonation initially                                                 | Unrestricted impersonation                                             |
| Technical tooling                       | None                                                                       | Environment, DB/filesystem diagnostics, debug, gallery, and test tools |

### Proposed initial Band Admin bundle

Band Admin should receive all explicit Moderator grants plus the current Admin-only domain grants, after the hardening tasks in this document are complete.

Current Admin-over-Moderator grants:

- `admin_events`
- `admin_files`
- `admin_instruments`
- `admin_songs`
- `admin_users` — include only after it has been narrowed and protected-target checks exist
- `setlist_planner_access`
- `view_feature_reports`
- `view_users_basic_info`
- `impersonate_user` — exclude
- `sysadmin` — exclude

Because roles do not inherit, the final Band Admin grant set must explicitly include every intended Moderator permission as well.

The inherited Moderator set must first have all workflow permissions removed. Band Admin must not receive `view_workflow_instances`, `edit_workflow_instances`, `view_workflow_defs`, `edit_workflow_defs`, or `admin_workflow_defs`; those permissions will be deleted with the feature.

### Proposed permission split

Prefer a small, action-oriented split rather than a permission for every button:

- Keep `manage_users` for ordinary profile, tag, and instrument management.
- Narrow `admin_users` to ordinary account lifecycle operations.
- Add `assign_user_roles` for constrained role assignment.
- Add `reset_user_passwords` for constrained password-reset initiation.
- Add `manage_site_branding`, or retain `content_admin` only after settings are governed by a server-side key allowlist.
- Keep audit-log access sysadmin-only; no Band Admin audit permission is required.
- Keep `impersonate_user`, `sysadmin`, security-topology mutation, and protected-account administration sysadmin-only.
- Make Practice Tools genuinely public by removing its authorization gate or placing `practice_tools_use` in the public permission baseline; do not treat it as a Band Admin grant.

## Product decisions

Record each decision before implementing the affected capability.

- [x] **BA-D001 — Tenant model:** Confirm that one band/site owns each deployment and database.

  - Decision: The site is single-tenant. Multi-tenancy is planned for the future, and current code may contain hints of that future design.
  - Constraint: Do not treat this Band Admin design as sufficient for a future shared-database, multi-tenant deployment. That will require organization-scoped memberships and row-level tenant enforcement.

- [x] **BA-D002 — Peer administration:** Decide whether a Band Admin may appoint, edit, deactivate, or reset another Band Admin.

  - Decision: Band Admin may appoint, edit, or revoke another Band Admin through the constrained role-assignment flow.
  - Constraint: An operation that would leave no active Band Admin must display a prominent warning and require explicit confirmation.
  - Constraint: Band Admin cannot administer a Sysadmin or another protected principal.

- [x] **BA-D003 — Impersonation:** Decide whether Band Admin needs any impersonation ability.

  - Decision: No. Impersonation is a debugging feature reserved for Sysadmin.
  - Constraint: Keep a defense-in-depth protected-target check even on the Sysadmin-only operation.

- [x] **BA-D004 — Custom roles:** Decide whether Band Admin may create custom roles or change grants.

  - Decision: Band Admin cannot create roles, change grants, or view role-permission assignments.
  - Decision: Band Admin may assign predefined non-protected roles, including elevating a user to Band Admin or revoking Band Admin from another user.
  - Constraint: Band Admin cannot assign, revoke, or demote Sysadmin/protected roles.
  - Constraint: Removing the last active Band Admin requires a prominent warning and explicit confirmation.

- [x] **BA-D005 — User removal:** Choose deactivation versus hard deletion for ordinary user administration.

  - Decision: Band Admin may only soft-delete/deactivate users. Hard deletion remains a narrowly controlled Sysadmin maintenance operation.

- [x] **BA-D006 — Password reset delivery:** Decide whether administrators receive a reset URL or merely trigger delivery to the user.

  - Constraint: The site cannot currently send reset email, so an administrator-mediated recovery mechanism is required for password-enabled users.
  - Security assessment: The current URL is a bearer credential valid for 48 hours. Anyone who obtains it can choose the target's password, revoke their existing sessions, and become logged in as that user. Showing it to an administrator therefore grants temporary account-takeover/impersonation power, even when the feature is labelled password reset.
  - Exposure paths include the administrator's clipboard and browser history, chat history used to send the URL, screenshots, console output, application/proxy logs, and accidental forwarding.
  - Decision: Band Admin cannot generate or receive password-reset URLs. Restrict the current mechanism to Sysadmin as a last-resort emergency operation and otherwise leave its behavior unchanged during this effort.
  - Rejected option: Allow Band Admin to generate and manually transfer a reset URL for a non-protected target. This would grant temporary account-takeover/impersonation power.
  - Deferred replacement: A separately scoped hardened recovery flow, preferably using verified email or another user-controlled channel in which the administrator never sees the bearer credential.

- [x] **BA-D007 — Audit visibility:** Decide whether Band Admin receives a redacted audit log.

  - Decision: No. Audit logs remain visible only to Sysadmin.
  - Constraint: Sensitive-field redaction is still required because credential-bearing values should not be stored even in Sysadmin-only logs.

- [x] **BA-D008 — Practice Tools:** Decide which roles should receive `practice_tools_use`.

  - Decision: Practice Tools are public, including for anonymous users.
  - Implementation note: Remove the redundant gate/permission or include it in the public permission baseline and verify that the route itself does not require login.

- [x] **BA-D009 — Workflows:** Decide whether to harden or retain the unused workflow feature.
  - Decision: Remove the workflow feature completely as a prerequisite for Band Admin rollout.
  - Scope: Remove the UI, server/shared implementation, DB3 registrations, five permissions and their grants, settings/setup metadata, Event/User relations, ten Prisma models, and deployed database objects.
  - Constraint: Verify all deployment data and backups before applying the destructive schema migration.

## Workstream summary

| Workstream                          | Status      | Exit condition                                                                                            |
| ----------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| P0: Remove workflow feature         | Not started | Workflow UI, services, permissions, data model, and database objects no longer exist                      |
| P0: Generic DB3 authorization       | Not started | Crafted query/mutation attempts cannot cross table, row, field, association, filter, or delete boundaries |
| P0: Protected accounts and signup   | Not started | No untrusted path can obtain or delegate sysadmin authority                                               |
| P0: Secrets and object-level gaps   | Not started | Tokens/hashes are excluded or redacted and known direct endpoint gaps are closed                          |
| P1: Permission and role model       | Not started | Delegation policy and protected role/permission metadata are authoritative                                |
| P1: Sessions and revocation         | Not started | Grants and revocations are reflected reliably and promptly                                                |
| P1: Provisioning and migration      | Not started | Existing and fresh databases converge without destroying customization                                    |
| P1: Site configuration split        | Not started | Band-owned settings are allowlisted; platform settings remain protected                                   |
| P1: UI/page/server alignment        | Not started | Shared capability metadata drives navigation and page access                                              |
| P1: Test suite                      | In progress | Persona and adversarial matrices pass                                                                     |
| P2: Optional delegated capabilities | Not started | Approved audit, peer-admin, or limited support functions are safely available                             |
| Rollout                             | Not started | Production verification and rollback evidence are recorded                                                |

## Prerequisite — Remove the unused workflow feature

Decision: No tenant uses workflows. Complete removal is a prerequisite for Band Admin rollout; do not spend effort hardening or exposing this feature.

The initial inventory found 44 non-migration files referencing workflow concepts, five workflow permissions, event foreign keys, user relations, and ten dedicated Prisma models. Removal must cover the complete vertical slice rather than only hiding its page.

### BA-WF001 — Verify and preserve deployment state before destructive migration

- [ ] Query every target deployment for counts in all workflow tables and for Events linked by `workflowDefId` or `workflowInstanceId`.
- [ ] Confirm the product assertion that no tenant uses the feature.
- [ ] Take or verify a recoverable database backup before dropping workflow data/schema.
- [ ] Record the verified counts and backup reference in this document.
- [ ] Define the migration rollback boundary before applying destructive DDL.

Acceptance criteria:

- [ ] Every target deployment has zero meaningful workflow data, or any exceptional data has an explicitly approved disposition.
- [ ] A tested recovery path exists before destructive migration.

### BA-WF002 — Remove workflow UI and styling

- [ ] Remove the `/backstage/workflows` page and navigation entry.
- [ ] Remove workflow editors, event workflow panels, user workflow components, and DB3 workflow bindings.
- [ ] Remove workflow sections/tabs from event and user surfaces.
- [ ] Remove workflow references from admin logs, event import/edit grids, gallery/demo surfaces, and other page composition.
- [ ] Remove `public/style/workflow.css` and its `_app.tsx` import.

Primary inventory:

- [Workflow page](../src/pages/backstage/workflows.tsx)
- [Workflow components](../src/core/components/workflow)
- [Workflow stylesheet](../public/style/workflow.css)
- [Global stylesheet import](../src/pages/_app.tsx#L36)

### BA-WF003 — Remove workflow server and shared code

- [ ] Remove workflow query and mutation resolvers.
- [ ] Remove workflow evaluation/server services.
- [ ] Remove the shared workflow engine.
- [ ] Remove workflow DB3 table registrations, table schemas, selection arguments, payload types, and API types.
- [ ] Remove workflow branches from event insert/update paths and user mass analysis.
- [ ] Remove workflow-specific generic mutation support.

Primary inventory:

- [Workflow RPC mutations](../src/core/db3/mutations)
- [Workflow query](../src/core/db3/queries/getWorkflowDefAndInstanceForEvent.ts)
- [Workflow server services](../src/core/db3/server/eventWorkflow.ts)
- [Workflow DB3 schema](../src/core/db3/shared/schema/workflow.ts)
- [Shared workflow engine](../shared/workflowEngine.ts)

### BA-WF004 — Remove workflow permissions, settings, and provisioning

- [ ] Remove `view_workflow_instances`.
- [ ] Remove `edit_workflow_instances`.
- [ ] Remove `view_workflow_defs`.
- [ ] Remove `edit_workflow_defs`.
- [ ] Remove `admin_workflow_defs`.
- [ ] Remove all workflow grants from startup provisioning and Prisma seeds.
- [ ] Remove `Workflow_SelectAssigneesDialogDescription` and `Event.workflowDef.SelectStyle` setup/setting metadata.
- [ ] Migrate/delete the corresponding Permission and RolePermission records safely.

References:

- [Workflow permissions](../shared/permissions.ts#L87)
- [Startup grants and settings](../src/setup/instrumentation-setup.ts#L157)
- [Seed grants](../db/seeds.ts#L651)
- [Workflow setting key](../shared/settingKeys.ts#L92)

### BA-WF005 — Remove workflow database schema

- [ ] Remove `Event.workflowInstanceId` and `Event.workflowDefId`, their relations, and indexes.
- [ ] Remove workflow relations from `User`.
- [ ] Remove all ten workflow models:
  - `WorkflowDef`
  - `WorkflowDefGroup`
  - `WorkflowDefNode`
  - `WorkflowDefNodeDefaultAssignee`
  - `WorkflowDefNodeDependency`
  - `WorkflowInstance`
  - `WorkflowInstanceLogItem`
  - `WorkflowInstanceNode`
  - `WorkflowInstanceNodeLastAssignee`
  - `WorkflowInstanceNodeAssignee`
- [ ] Create a migration that drops foreign keys, columns, indexes, and tables in dependency-safe order.
- [ ] Regenerate the Prisma client and remove resulting dead imports/types.
- [ ] Review `db/truncatedb.sql` and other database maintenance scripts.

References:

- [Event workflow relations](../db/schema.prisma#L578)
- [Workflow models](../db/schema.prisma#L1193)

### BA-WF006 — Verify complete removal

- [ ] Repository search finds no functional workflow references, apart from historical migrations or an intentional migration note.
- [ ] Typecheck and production build pass.
- [ ] Database migration succeeds on empty and production-shaped database copies.
- [ ] Migration rollback/recovery procedure is exercised.
- [ ] Event create, edit, import, details, and user analytics operate without workflow fields.
- [ ] Built-in permission registries and role matrices contain no workflow permissions.

Prerequisite completion evidence:

- Deployment data audit:
- Implementation:
- Migration verification:
- Build/typecheck:
- Commit/PR:

## Phase 0 — Establish security test infrastructure

### BA-T001 — Authorization test harness

Status: Complete

- [x] Add a test runner configuration that fails on real failures and does not treat absence of tests as success for authorization work.
- [x] Add fixtures/builders for Public, Limited, Normal, Editor, Moderator, Band Admin, and Sysadmin actors.
- [x] Add fixtures for ordinary, peer Band Admin, protected-role, and `isSysAdmin` targets.
- [x] Make it easy to invoke resolvers with forged payloads rather than testing only through UI components.

Acceptance criteria:

- [x] Tests can exercise generic DB3 queries and mutations with an authenticated session and caller-controlled payload.
- [x] Tests can assert both the returned result and persisted database state.
- [x] Tests isolate data and are repeatable.

Evidence:

- Implementation: `vitest.config.ts`; `tests/setup.ts`; `tests/authorization/authorizationTestHarness.test.ts`; reusable support under `tests/authorization/support`; non-empty `test` command and focused `test:auth` command in `package.json`.
- Verification: `yarn test:auth` (14 passed); `yarn test` (14 passed); explicit empty-suite probe exited 1; `yarn tsc --noEmit`; focused ESLint on the Vitest configuration and `tests` tree.
- Commit/PR: see gh issue #668

## Phase 1 — Repair generic DB3 authorization

This is a release blocker. The permission model is not trustworthy until these paths are fixed.

### BA-A001 — Runtime-validate generic DB3 requests

- [x] Validate table IDs, mutation kinds, query operators, parameters, filters, ordering, and field names.
- [x] Reject unknown values rather than passing them to Prisma.
- [x] Derive trusted server intention from the endpoint and actor; do not trust caller-provided `clientIntention` or admin intention.

Evidence:

- Implementation: strict query, paginated-query, filter, order, and mutation schemas in `src/core/db3/server/db3RequestValidation.ts`; registered runtime parameter contracts on parameterized DB3 tables; request-only transport types with `clientIntention` removed from clients; database-actor-derived intention in query and mutation cores; internal intention/current-user context removed from query responses.
- Verification: `yarn test:auth` and `yarn test` (22 passed, including malformed request and server-derived intention cases); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR: see gh issue #668

References:

- [Generic mutation resolver](../src/core/db3/mutations/db3mutations.ts#L8)
- [Generic query resolver](../src/core/db3/queries/db3queries.ts#L6)
- [Query core](../src/core/db3/server/db3QueryCore.ts#L12)

### BA-A002 — Enforce query authorization before database access

- [x] Enforce table authorization before querying.
- [x] Authorize filter and order fields before constructing Prisma clauses.
- [x] Enforce row visibility before returning results.
- [x] Remove unconditional primary-key authorization as a way to qualify a protected row.
- [x] Prevent anonymous or low-privilege inference through protected-field filters and result counts.
- [x] Prevent callers from requesting admin/deleted-row query behavior.

Acceptance criteria:

- [x] Unauthorized tables cannot be queried.
- [x] Protected fields cannot be used as a filter/inference oracle.
- [x] Hidden rows do not leak IDs or counts.
- [x] Soft-deleted rows are not caller-selectable without the appropriate server-derived capability.

Evidence:

- Implementation: table, explicit-filter, order, primary-key, and parameter authorization preflight before target Prisma access in `src/core/db3/server/db3QueryCore.ts`; field-authorized quick/custom predicate construction, table/ownership query scopes, soft-delete enforcement, visibility defense-in-depth, and row-first sanitization in `src/core/db3/shared/db3core.ts`; field authorization metadata on every parameterized DB3 query contract; fresh database-actor public data for query/count/sanitization; public table authorization aligned for the intentionally anonymous frontpage gallery feed.
- Verification: `yarn test:auth` and `yarn test` (33 passed, including pre-database table/field rejection, protected parameter/filter/order cases, hidden-row IDs/counts, primary-key regression, and soft-delete/admin capability cases); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR: see gh issue #668

### BA-A003 — Persist only authorized mutation fields

- [ ] Authorize the proposed new values as well as the existing row context.
- [ ] Reject the whole mutation when a forbidden or unknown field is supplied, or persist only the explicitly sanitized model according to a documented policy.
- [ ] Never write the original unsanitized `localFields` after authorization.
- [ ] Apply equivalent rules to insert and update.

References:

- [Insert path](../src/core/db3/server/db3mutationCore.ts#L406)
- [Update path](../src/core/db3/server/db3mutationCore.ts#L497)
- [Authorization/sanitization core](../src/core/db3/shared/db3core.ts#L607)

Acceptance criteria:

- [ ] A mixed `{ id, allowedField, forbiddenField }` update cannot persist the forbidden field.
- [ ] A crafted `{ id, isSysAdmin: true }` user update is rejected for every non-sysadmin actor.
- [ ] A crafted insert cannot supply protected fields.

### BA-A004 — Authorize associations

- [ ] Enforce authorization on association-only mutations.
- [ ] Authorize both removal and insertion of association records.
- [ ] Apply protected-permission policy to `RolePermission` changes.

References:

- [Association mutation implementation](../src/core/db3/server/db3mutationCore.ts#L254)
- [Association authorization TODO](../src/core/db3/server/db3mutationCore.ts#L551)

Acceptance criteria:

- [ ] A non-sysadmin cannot add `sysadmin` or another protected permission to any role.
- [ ] A non-sysadmin cannot alter associations on a protected role.
- [ ] Association-only mutations cannot bypass row/field authorization.

### BA-A005 — Authorize deletes

- [ ] Enforce table, row, target, and operation authorization before soft or hard delete.
- [ ] Restrict hard delete to an explicit allowlist or dedicated operations.
- [ ] Protect built-in roles and permissions from deletion.
- [ ] Review cascading effects before allowing Role or Permission deletion.

Reference: [hard-delete path](../src/core/db3/server/db3mutationCore.ts#L317)

Acceptance criteria:

- [ ] Login alone cannot delete registered DB3 records.
- [ ] Protected roles, permissions, and users cannot be deleted by Band Admin.
- [ ] Delete tests cover cascade and `SetNull` behavior.

Phase completion evidence:

- Implementation:
- Verification:
- Commit/PR:

## Phase 2 — Protect identities, role delegation, and signup

### BA-U001 — Central protected-principal policy

- [ ] Add one server-side policy equivalent to `canManageUser(actor, target, action, desiredRole)`.
- [ ] Treat a user as protected when `isSysAdmin` is true or their role contains a protected/system permission.
- [ ] Apply the policy to edit, deactivate/delete, reset, impersonate, and role-assignment operations.
- [ ] Ensure the UI consumes server-provided decisions but is not the enforcement boundary.

Acceptance criteria:

- [ ] Band Admin can manage an ordinary user according to the agreed policy.
- [ ] Band Admin cannot modify, delete, reset, impersonate, or demote a Sysadmin.
- [ ] Band Admin cannot promote themselves or another user beyond the permitted ceiling.
- [ ] Moderator behavior does not gain new authority.

### BA-U002 — Split ordinary user administration from system administration

- [ ] Move `User.isSysAdmin` to an unambiguous sysadmin-only mutation path.
- [ ] Remove unrestricted role editing from the generic user editor.
- [ ] Keep Permission, Role, RolePermission, default/public role flags, and protected metadata sysadmin-only.
- [ ] Add a constrained role-assignment endpoint.
- [ ] Return only server-authorized assignable roles.
- [ ] Split ordinary profile editing, role assignment, reset, deletion/deactivation, and impersonation in both server and UI.

References:

- [User/role/permission authorization maps](../src/core/db3/shared/schema/user.ts#L35)
- [User admin panel](../src/core/components/user/UserAdminPanel.tsx#L28)
- [Legacy raw user grid](../src/pages/backstage/adminUsers.tsx#L13)

### BA-U003 — Harden password reset

- [ ] Make password-reset URL generation explicitly Sysadmin-only; `manage_users`, `admin_users`, and Band Admin must not authorize it.
- [ ] Remove the reset action from every non-Sysadmin user-management surface.
- [ ] Add a server-boundary test proving Band Admin cannot invoke the mutation or receive a reset URL for any target.
- [ ] Preserve the existing mechanism as a last-resort Sysadmin operation until a separately scoped hardened recovery flow is designed.
- [ ] Keep credential-bearing values out of activity logs even though the emergency operation is Sysadmin-only.

Reference: [forgotPassword mutation](../src/auth/mutations/forgotPassword.ts#L10)

### BA-U004 — Constrain impersonation

- [ ] Keep current `impersonate_user` sysadmin-only for the initial rollout.
- [ ] Prevent impersonation of protected principals through defense-in-depth target checks.
- [ ] Preserve and audit the original actor identity through the impersonated session.
- [ ] If limited impersonation is approved later, implement a separate capability rather than weakening the existing one.

Reference: [impersonation mutation](../src/auth/mutations/impersonateUser.ts#L12)

### BA-U005 — Harden public signup and built-in role invariants

- [ ] Remove `roleId` from public signup input.
- [ ] Construct permitted user-create data explicitly rather than spreading caller input.
- [ ] Replace ordinary-signup `ADMIN_EMAIL` promotion with a dedicated deployment/bootstrap path.
- [ ] Enforce exactly one default-new-user role and one public role.
- [ ] Make default/public role flags sysadmin-only.
- [ ] Protect built-in roles from deletion.

References:

- [Signup schema](../src/auth/schemas.ts#L31)
- [Signup mutation](../src/auth/mutations/signup.ts#L13)
- [Public-role lookup](../src/core/db3/shared/db3core.ts#L879)

Phase completion evidence:

- Implementation:
- Verification:
- Commit/PR:

## Phase 3 — Remove sensitive-data and object-level authorization gaps

### BA-S001 — Credentials and audit redaction

- [ ] Remove `User.accessToken` from ordinary user selections and generic tables.
- [ ] Never write password hashes, access tokens, reset tokens, or comparable credentials into activity logs.
- [ ] Add central structured redaction before serializing before/after records.
- [ ] Assess whether previously exposed tokens require rotation or historical log cleanup.
- [ ] Keep raw audit logs sysadmin-only until redaction is complete.

References:

- [User selection arguments](../src/core/db3/shared/schema/prismArgs.ts#L393)
- [Activity logging](../shared/activityLog.ts#L46)
- [Password-change logging path](../src/auth/mutations/changePassword.ts#L31)

### BA-S002 — File visibility and image operations

- [ ] Enforce file visibility on direct download rather than using `skipVisibilityCheck` without an equivalent guard.
- [ ] Enforce visibility and mutation authority before image forking.
- [ ] Restore explicit authorization for gallery image updates.

References:

- [File download route](../src/pages/api/files/download/[...leafName_slug].ts#L13)
- [Image fork core](../src/core/db3/server/db3mutationCore.ts#L1018)
- [Gallery image mutation](../src/core/db3/mutations/updateGalleryItemImage.ts#L10)

### BA-S003 — Direct mutation gaps

- [ ] Authorize generic sort-order updates by table, affected rows, and operation.
- [ ] Authorize event song-list deletion with the appropriate event/song-list capability.
- [ ] Enforce self-versus-other attendance rules and wire `change_others_event_responses` server-side.
- [ ] Review every login-only or public mutation for object-level authorization.

References:

- [Generic sort-order mutation](../src/core/db3/mutations/updateGenericSortOrder.ts#L17)
- [Event song-list deletion](../src/core/db3/mutations/deleteEventSongList.ts#L11)
- [Attendance mutation](../src/core/db3/mutations/updateUserEventAttendanceMutation.ts#L9)

### BA-S004 — Wiki authorization maps

- [ ] Replace logged-in write permissions on wiki/tag administration with the intended wiki capabilities.

References:

- [Wiki DB3 schema](../src/core/db3/shared/schema/wiki.ts#L13)
- [Wiki tag schema](../src/core/db3/shared/schema/wikiPageTag.ts#L19)

### BA-S005 — Metadata, telemetry, and test routes

- [ ] Add appropriate authorization/visibility handling to server-rendered entity metadata loaders.
- [ ] Authenticate telemetry identity rather than trusting a supplied user ID.
- [ ] Remove production test routes or gate them with an explicit sysadmin/developer capability.
- [ ] Ensure production pages never rely only on menu hiding.

Phase completion evidence:

- Implementation:
- Verification:
- Commit/PR:

## Phase 4 — Define the durable role and permission model

### BA-M001 — Canonical permission registry

- [ ] Replace the split enum/order/default-grant knowledge with one authoritative registry or generated views of it.
- [ ] Record for each permission: stable key, category, scope, description, sort order, whether it is protected, and whether it is delegable.
- [ ] Make omissions from the display/provisioning order impossible or test-detectable.
- [ ] Confirm the intended owner of every remaining permission after the five workflow permissions are removed.

Current drift: `gPermissionOrdered` omits nine enum permissions:

- `view_events_reports`
- `pin_song_recordings`
- `access_file_landing_page`
- `view_users_basic_info`
- `admin_wiki_pages`
- `search_wiki_pages`
- `view_wiki_page_revisions`
- `view_feature_reports`
- `practice_tools_use`

References:

- [Permission enum and order](../shared/permissions.ts#L3)
- [Legacy Prisma seed](../db/seeds.ts#L597)
- [Startup permission synchronization](../src/setup/instrumentation-setup.ts#L7)

### BA-M002 — Stable built-in role metadata

- [ ] Give built-in roles stable identities independent of display names.
- [ ] Add an explicit security/delegation level or equivalent server-owned policy.
- [ ] Mark system/protected roles explicitly.
- [ ] Do not use `sortOrder` as an authorization rank.
- [ ] Evaluate a per-user authorization/session version for immediate revocation.

Possible built-in order:

| Stable role   | Display order | Classification           |
| ------------- | ------------: | ------------------------ |
| Public        |             0 | Public                   |
| Limited Users |            10 | Authenticated, untrusted |
| Normal Users  |            40 | Member                   |
| Editors       |            60 | Content operations       |
| Moderators    |            80 | Elevated operations      |
| Band Admin    |            90 | Full band administration |
| Admin         |           100 | Platform/sysadmin        |

### BA-M003 — Delegation rules

- [ ] Define protected/system permissions.
- [ ] Define which roles Band Admin may assign.
- [ ] Define same-tier administration behavior from BA-D002.
- [ ] Prevent assignment of a role containing authority above the actor's delegation ceiling.
- [ ] Keep raw Role, Permission, and RolePermission administration sysadmin-only initially.
- [ ] Permit assignment to and revocation of Band Admin while warning and requiring confirmation if the change would leave no active Band Admin.

Phase completion evidence:

- Implementation:
- Verification:
- Commit/PR:

## Phase 5 — Fix session authorization and revocation

### BA-R001 — Correct permission refresh

- [ ] Compare the complete desired authorization state, not only array length.
- [ ] Include the automatic public-permission union.
- [ ] Clear permissions when the role is removed.
- [ ] Refresh `isSysAdmin` independently.
- [ ] Handle deleted/deactivated users.

Reference: [session permission refresh](../src/auth/queries/getDashboardData.ts#L16)

### BA-R002 — Reliable revocation

- [ ] Invalidate or version sessions after user-role, RolePermission, `isSysAdmin`, and user-active-state changes.
- [ ] Require current authorization state for sensitive mutations rather than relying indefinitely on cached session grants.
- [ ] Define the maximum acceptable propagation time for ordinary grant changes.

Acceptance criteria:

- [ ] Equal-count permission changes take effect.
- [ ] Removing a role removes its permissions.
- [ ] Removing sysadmin authority removes the bypass.
- [ ] Deactivating/deleting a user invalidates active sessions.
- [ ] Role-permission revocation affects every user of that role.

Phase completion evidence:

- Implementation:
- Verification:
- Commit/PR:

## Phase 6 — Provision and migrate Band Admin

### BA-P001 — Consolidate provisioning authorities

- [ ] Define one canonical built-in role/grant manifest or mechanically generate both initialization paths.
- [ ] Eliminate drift between `db/seeds.ts` and startup provisioning.
- [ ] Ensure every enum permission receives intentional metadata and grants.

References:

- [Startup default roles](../src/setup/instrumentation-setup.ts#L70)
- [Startup default matrix](../src/setup/instrumentation-setup.ts#L139)
- [Prisma seed roles](../db/seeds.ts#L538)

### BA-P002 — Existing-database migration

- [ ] Export and review the actual role matrix for every target deployment before migration.
- [ ] Insert newly required Permission rows before looking them up.
- [ ] Insert Band Admin using a stable key.
- [ ] Insert its exact RolePermission rows idempotently.
- [ ] Preserve customized roles and grants.
- [ ] Do not assign existing users automatically unless explicitly approved.
- [ ] Provide a rollback for the new role/grants without deleting user data.

### BA-P003 — Fresh-database parity

- [ ] Update fresh initialization.
- [ ] Verify empty-database startup and Prisma seed produce the same built-in roles, permissions, metadata, and grants.
- [ ] Verify repeat execution is idempotent.

Acceptance criteria:

- [ ] Existing deployments receive Band Admin even when Role and RolePermission tables are nonempty.
- [ ] Existing customized grants remain unchanged.
- [ ] Fresh and migrated databases match the canonical manifest.
- [ ] Band Admin never receives `sysadmin`, `impersonate_user`, `never_grant`, or another protected permission.
- [ ] No built-in role or permission matrix contains a removed workflow permission.

Phase completion evidence:

- Implementation:
- Verification:
- Commit/PR:

## Phase 7 — Split band-owned and platform-owned settings

### BA-C001 — Typed setting authorization

- [ ] Classify each setting as public, band-content, band-configuration, or platform/system.
- [ ] Authorize updates using a server-side key registry/allowlist.
- [ ] Prevent arbitrary names or IDs from bypassing the classification.
- [ ] Keep raw settings and bulk import/export sysadmin-only.
- [ ] Review public arbitrary-key reads before future settings can contain secrets.

References:

- [Setting keys](../shared/settingKeys.ts#L4)
- [Setting update by name](../src/auth/mutations/updateSetting.ts#L11)
- [Setting update by ID](../src/auth/mutations/updateSettingById.ts#L10)
- [Raw settings page](../src/pages/backstage/settings.tsx#L17)

### BA-C002 — Split Brand page

- [ ] Give Band Admin access to site title, logo, favicon, theme, and calendar identity.
- [ ] Move `Dashboard_HostingMode` to a sysadmin-only surface.
- [ ] Make cache invalidation an internal side effect of an authorized brand change, not a separate sysadmin-only step.

References:

- [Brand fields and page gate](../src/pages/backstage/brand.tsx#L86)
- [Brand cache mutation](../src/auth/mutations/clearBrandCache.ts#L10)

### BA-C003 — Separate content editing from debug controls

- [ ] Allow authorized site-copy editing without enabling sysadmin debug mode.
- [ ] Keep raw objects, filter specifications, IDs, server versions, and technical diagnostics sysadmin-only.

References:

- [Setting Markdown editor](../src/core/components/SettingMarkdown.tsx#L77)
- [Admin-control derivation](../src/core/components/dashboardContext/DashboardContext.tsx#L124)
- [Admin/debug components](../src/core/components/CMCoreComponents2.tsx#L489)

Phase completion evidence:

- Implementation:
- Verification:
- Commit/PR:

## Phase 8 — Align UI, page, and server capabilities

### BA-N001 — Shared backstage route-capability registry

- [ ] Centralize path, caption, navigation capability, page capability, and surface classification.
- [ ] Have menus and page layouts consume the same metadata where practical.
- [ ] Add a drift test for every registered backstage route.
- [ ] Treat all client/page checks as UX only; keep server checks authoritative.

Reference: [current static menu permissions](../src/core/components/dashboard/StaticMenuItems.tsx#L68)

### BA-N002 — Correct known Band Admin navigation mismatches

- [ ] Event tags, types, statuses, attendance options, and custom fields use `admin_events` rather than menu-only `sysadmin`.
- [ ] Song tags and credit types use `admin_songs`.
- [ ] File tags use `admin_files`.
- [ ] Wiki tags use `admin_wiki_pages`.
- [ ] Instrument tags, instruments, and functional groups use `admin_instruments`.
- [ ] Raw operational event/song/file grids use their existing domain permissions.
- [ ] Front-page gallery management uses `edit_public_homepage`.
- [ ] User Search navigation agrees with its `search_users` page capability.
- [ ] Menu Links and Custom Links use consistent capabilities.
- [ ] Practice Tools and all required data are accessible to anonymous users; remove the redundant gate or add the permission to the public baseline.

### BA-N003 — Close missing and incorrect page gates

- [ ] Keep Roles and Permission Matrix sysadmin-only in both navigation and pages.
- [ ] Add an explicit sysadmin gate to the Permission maintenance page.
- [ ] Add an explicit approved capability to Color Editor.
- [ ] Keep the legacy raw Admin Users grid sysadmin-only.
- [ ] Remove or sysadmin-gate production component/test pages.
- [ ] Split user activity tabs by their actual capability instead of wrapping the panel in `sysadmin`.

References:

- [Roles page](../src/pages/backstage/roles.tsx#L33)
- [Permission matrix page](../src/pages/backstage/rolePermissions.tsx#L72)
- [Permission maintenance page](../src/pages/backstage/permissions.tsx#L49)
- [Color Editor](../src/pages/backstage/colorEditor2.tsx#L284)

### BA-N004 — Preserve platform-only surfaces

- [ ] Server Health remains sysadmin-only.
- [ ] Stop returning the complete `process.env` to browser clients; expose only explicitly safe diagnostic fields.
- [ ] Raw settings and bulk configuration remain sysadmin-only.
- [ ] Raw security topology remains sysadmin-only.
- [ ] Developer inspectors, test tools, and component galleries remain sysadmin-only or are removed from production.

Reference: [Server Health query](../src/core/db3/queries/getServerHealth.ts#L43)

Phase completion evidence:

- Implementation:
- Verification:
- Commit/PR:

## Phase 9 — Authorization acceptance matrix

### Generic adversarial cases

- [ ] Anonymous DB3 query cannot enumerate protected tables or use protected fields as predicates.
- [ ] Logged-in caller cannot select admin intention or deleted rows.
- [ ] Mixed allowed/forbidden update rejects or strips forbidden fields according to the documented mutation policy.
- [ ] Association-only updates enforce authorization.
- [ ] Hard and soft deletes enforce authorization.
- [ ] Unknown fields, table IDs, operations, and filter operators are rejected.

### Role/persona cases

- [ ] Public, Limited, Normal, Editor, and Moderator behavior remains unchanged except for intentional security fixes.
- [ ] Band Admin can administer events, songs, files, instruments, wiki, homepage, branding, and approved reports.
- [ ] No user can access a workflow UI or invoke a workflow RPC because the feature has been removed.
- [ ] Band Admin can create/edit/deactivate/reset ordinary users according to policy.
- [ ] Band Admin can promote another user to Band Admin and revoke Band Admin from another user.
- [ ] Removing the last active Band Admin produces the required warning and explicit confirmation.
- [ ] Band Admin can assign only server-approved roles.
- [ ] Band Admin cannot set `isSysAdmin`.
- [ ] Band Admin cannot assign Admin or another role containing protected permissions.
- [ ] Band Admin cannot edit Permission, Role, or RolePermission topology.
- [ ] Band Admin cannot target a protected user through edit, reset, deletion, or impersonation.
- [ ] Band Admin can only soft-delete/deactivate users; hard deletion remains unavailable.
- [ ] Band Admin cannot view raw audit logs.
- [ ] Band Admin cannot access Server Health, raw Settings, Hosting Mode, raw audit logs, or debug/test surfaces.
- [ ] Anonymous users can access Practice Tools.
- [ ] Sysadmin retains full intended access.

### Session and provisioning cases

- [ ] Equal-count role changes refresh correctly.
- [ ] Removing a role clears cached grants.
- [ ] Changing `isSysAdmin` refreshes or invalidates the session.
- [ ] Role-permission revocation affects active sessions.
- [ ] Deleted/deactivated users lose access.
- [ ] Public signup rejects or ignores `roleId`.
- [ ] Migration is idempotent and preserves customized grants.
- [ ] Fresh startup and Prisma seed produce the same matrix.

### UI consistency cases

- [ ] Every backstage route has explicit capability metadata.
- [ ] Navigation visibility and page access agree.
- [ ] Direct URL navigation cannot reveal an unauthorized page.
- [ ] Server calls remain protected when UI checks are bypassed.
- [ ] Band Admin user-role selectors show only assignable roles.

Phase completion evidence:

- Test suite:
- Manual verification:
- Security review:
- Commit/PR:

## Rollout checklist

- [ ] All product decisions above are resolved.
- [ ] The workflow-removal prerequisite is complete and its destructive migration has been verified.
- [ ] P0 findings are fixed and adversarial tests pass before the role is assigned to anyone.
- [ ] Current production role and permission matrices are exported and archived.
- [ ] Migration has been tested against a production-shaped database copy.
- [ ] A rollback plan has been exercised.
- [ ] Band Admin is initially assigned to a test account.
- [ ] Positive band-operation smoke test passes.
- [ ] Negative protected/system-operation smoke test passes.
- [ ] Session grant and revocation tests pass in the deployed environment.
- [ ] Logs contain no credentials or reset/access tokens.
- [ ] Production diagnostics expose no raw environment secrets.
- [ ] Final access matrix and operator documentation are published.

## Progress log

Add one row for each completed or materially changed work item.

| Date       | Work item | Change                                                                                                                                                            | Verification                                                                                    | Commit/PR |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------- |
| 2026-09-10 | Audit     | Initial hardening and Band Admin rollout plan documented                                                                                                          | Static audit; configured local DB inspected read-only                                           | —         |
| 2026-09-10 | Decisions | Recorded tenant, peer administration, impersonation, custom role, soft-delete, password-reset, audit, and Practice Tools decisions                                | All product decisions resolved                                                                  | —         |
| 2026-09-10 | BA-T001   | Added the isolated authorization test harness, seven persona builders, forged DB3 request builders, process-local persistence, and enforced non-empty Vitest runs | `yarn test:auth`; `yarn test`; `yarn tsc --noEmit`; focused ESLint                              | —         |
| 2026-09-10 | Scope     | Made complete removal of the unused workflow feature a Band Admin rollout prerequisite                                                                            | Removal inventory covers UI, server, permissions, settings, schema, migration, and verification | —         |

## Deferred ideas

These are not required for the initial Band Admin rollout unless a product decision brings them into scope:

- Custom role authoring by Band Admin with a server-owned grantable-permission subset.
- Target-limited impersonation for non-protected users.
- A redacted, band-facing audit log, if the current Sysadmin-only decision is revisited.
- Multi-band tenancy within one database.
- Consolidating the two superuser mechanisms (`User.isSysAdmin` and `Permission.sysadmin`) into one model.

## Audit limitations

The initial audit traced source code and inspected the configured local database without modifying it. It did not actively exploit a deployed service or perform browser/runtime penetration testing. The high-risk paths above should be confirmed with regression tests as they are repaired, and the final implementation should receive a focused authorization review before production rollout.
