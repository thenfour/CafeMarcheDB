# Band Admin Authorization Hardening

- Last updated: 2026-09-10
- Overall status: Implementation
- Audit type: Static code-path audit plus read-only inspection of the configured local database
- Implementation status: BA-T001, BA-A001 through BA-A005, BA-U001 through BA-U006, and BA-M001 complete; BA-S001 next

## Goal

Enable the platform to safely support a database-defined **Band Admin** role whose permissions let a band run its site, including ordinary user administration and domain configuration, without granting server administration, security-policy administration, protected-account access, secrets, or developer tooling. Application code authorizes permissions and the exceptional `User.isSysAdmin` flag; it does not identify or rank roles.

This effort establishes the secure authorization platform and composable capabilities. Choosing the production Band Admin grant set, creating that role, and assigning it to users are a later rollout activity. Seeded roles are default recommendations and bootstrap conveniences, not canonical runtime identities or immutable policy.

This document is the working source of truth for the hardening and rollout. Keep it updated as decisions are made and work is completed.

## Completion definition

The goal is complete only when all of the following are true:

- [x] Generic database query and mutation paths enforce table, row, field, association, filter, and delete authorization on the server.
- [x] No non-sysadmin path can set `User.isSysAdmin`, grant a protected permission, assign a protected role, or take over a protected account.
- [ ] A representative database-defined, non-sysadmin role can perform the permitted domain, site-configuration, ordinary-user editing/deactivation, and constrained role-assignment operations.
- [ ] Band Admin cannot access server diagnostics, raw environment/configuration, security topology, unrestricted impersonation, raw sensitive logs, or developer/debug surfaces.
- [ ] Permission grants and revocations take effect reliably for existing sessions.
- [ ] An actual Sysadmin can safely compose an arbitrary non-protected role through the RolePermission matrix without application code depending on its name or seeded identity.
- [ ] Menu visibility, page access, and server authorization agree.
- [ ] Positive and adversarial authorization tests cover every relevant capability and representative persona.
- [ ] The configured deployment has been reviewed against the single-tenant assumption.
- [ ] The unused workflow feature is inaccessible from normal UI and server paths, has no effective grants, and is covered by negative authorization tests.
- [ ] Final platform-hardening verification has been recorded in the progress log.

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
- The workflow feature is not used by any tenant. It will be contained before Band Admin platform readiness and physically removed in a later cleanup.

Primary references:

- [Role and User models](../db/schema.prisma#L40)
- [Permission definitions](../shared/permissions.ts#L3)
- [Permission checks and session public data](../types.ts#L41)
- [DB3 authorization core](../src/core/db3/shared/db3core.ts#L353)
- [Default role provisioning](../src/setup/instrumentation-setup.ts#L70)

## Recommended target boundary

This is the agreed platform boundary. The exact production role composition remains deferred to rollout.

| Area                                    | Band Admin                                                           | Sysadmin only                                                          |
| --------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Events, songs, files, instruments, wiki | Full domain administration                                           | Server/debug internals                                                 |
| Workflows                               | Not available                                                        | Disabled/contained until later physical removal                        |
| Users                                   | Edit and deactivate ordinary users; assign permitted roles           | User creation, login email/provider identity, password-reset URLs, protected accounts, and `isSysAdmin` |
| Roles and permissions                   | Assign predefined non-protected roles                                | Role CRUD, Permission CRUD, and the permission matrix                  |
| Site configuration                      | Brand, logo, favicon, theme, calendar identity, site copy, and menus | Hosting mode, raw settings, and bulk configuration                     |
| Reports                                 | Event and feature reports                                            | Server diagnostics                                                     |
| Audit                                   | No audit-log access initially                                        | Raw change records; credential-bearing values must never be recorded   |
| Support                                 | No impersonation initially                                           | Unrestricted impersonation                                             |
| Technical tooling                       | None                                                                 | Environment, DB/filesystem diagnostics, debug, gallery, and test tools |

### Deferred Band Admin rollout approach

The exact Band Admin grant set is intentionally not a completion requirement for this effort. After the platform is hardened, an actual Sysadmin will manually create the role and configure it through the RolePermission matrix.

Use the then-current Moderator grants as the starting snapshot and add permissions one by one as operational needs are demonstrated. Because roles do not inherit, subsequent Moderator changes will not implicitly change Band Admin. The resulting explicit matrix must be reviewed and tested before assignment.

The following current Admin-over-Moderator grants are audit context, not a predetermined Band Admin manifest:

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

Before Moderator is used as the rollout starting point, its effective grants must contain no usable workflow capability. Band Admin must not receive `view_workflow_instances`, `edit_workflow_instances`, `view_workflow_defs`, `edit_workflow_defs`, or `admin_workflow_defs` while those permissions await later deletion.

### Proposed permission split

Prefer a small, action-oriented split rather than a permission for every button:

- Keep `manage_users` for ordinary profile, tag, and instrument management.
- Narrow `admin_users` to editing and deactivating existing ordinary accounts. Band Admin does not create users; users enter through self-signup.
- Add `assign_user_roles` for constrained role assignment.
- Add `manage_site_branding` for the band-owned subset of the Brand page. Keep hosting mode and platform settings actual-Sysadmin-only.
- Authorize site-copy and other settings through similarly scoped capabilities and a server-side key allowlist; do not use broad `content_admin` as authority for arbitrary settings.
- Keep audit-log access sysadmin-only; no Band Admin audit permission is required.
- Keep `impersonate_user`, `sysadmin`, security-topology mutation, and protected-account administration sysadmin-only.
- Make Practice Tools genuinely public by removing its authorization gate or placing `practice_tools_use` in the public permission baseline; do not treat it as a Band Admin grant.

## Product decisions

Record each decision before implementing the affected capability.

- [x] **BA-D001 — Tenant model:** Confirm that one band/site owns each deployment and database.

  - Decision: The site is single-tenant. Multi-tenancy is planned for the future, and current code may contain hints of that future design.
  - Constraint: Do not treat this Band Admin design as sufficient for a future shared-database, multi-tenant deployment. That will require organization-scoped memberships and row-level tenant enforcement.

- [x] **BA-D002 — Peer administration:** Decide whether delegated administrators may appoint, edit, or deactivate peers.

  - Decision: A non-Sysadmin with the required user-management and role-assignment permissions may appoint, edit, or revoke a peer through the constrained role-assignment flow.
  - Constraint: An operation that would leave no active non-Sysadmin holder of a continuity-sensitive permission must display a prominent warning and require explicit confirmation.
  - Constraint: Band Admin cannot administer a Sysadmin or another protected principal.

- [x] **BA-D003 — Impersonation:** Decide whether Band Admin needs any impersonation ability.

  - Decision: No. Impersonation is a debugging feature reserved for Sysadmin.
  - Constraint: Keep a defense-in-depth protected-target check even on the Sysadmin-only operation.

- [x] **BA-D004 — Custom roles:** Decide whether Band Admin may create custom roles or change grants.

  - Decision: Band Admin cannot create roles, change grants, or view role-permission assignments.
  - Decision: A delegated administrator may assign predefined roles whose permission composition is within their delegation envelope, including a peer-equivalent role.
  - Constraint: A delegated administrator cannot assign a role containing a protected or non-delegable permission, or administer a user whose current role is outside their delegation envelope.
  - Constraint: Removing the last active non-Sysadmin holder of a continuity-sensitive permission requires a prominent warning and explicit confirmation.

- [x] **BA-D005 — User removal:** Choose deactivation versus hard deletion for ordinary user administration.

  - Decision: Band Admin may only soft-delete/deactivate users. Hard deletion remains a narrowly controlled Sysadmin maintenance operation.

- [x] **BA-D006 — Password reset delivery:** Decide whether administrators receive a reset URL or merely trigger delivery to the user.

  - Context: Band Admin does not create users; self-signup is the normal account-entry path. The site cannot currently send reset email, so the existing Sysadmin-mediated mechanism remains available only for exceptional password recovery.
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
  - Decision: Do not expose workflows to Band Admin. Before platform readiness, remove normal navigation and entry points, disable or unregister callable server/DB3 paths, remove effective grants, and add negative tests.
  - Deferred cleanup: Physically remove the UI, server/shared implementation, permissions, settings/setup metadata, Event/User relations, ten Prisma models, and deployed database objects after this effort.
  - Constraint: Verify all deployment data and backups before the later destructive schema migration.

- [x] **BA-D010 — Band Admin provisioning:** Decide whether this effort defines and installs the exact Band Admin grant set.

  - Decision: No. This effort provides the safe role, permission, delegation, and settings platform; exact role composition and production assignment happen afterward.
  - Rollout procedure: An actual Sysadmin manually creates Band Admin and edits its grants through the RolePermission matrix, starting with a snapshot of the then-current Moderator grants and adding permissions one by one as needed.
  - Constraint: Seeded roles are default recommendations, not runtime identities. Application authorization must not recognize a Band Admin role by name, ID, order, significance, or seed origin.

- [x] **BA-D011 — User creation and authentication identity:** Decide whether Band Admin creates accounts or edits login identifiers.

  - Decision: Band Admin does not create users. Users enter through self-signup; Band Admin may edit allowed ordinary profile fields, deactivate ordinary accounts, and assign permitted roles.
  - Decision: Login email is immutable through generic and delegated administration. Only an actual Sysadmin may correct it through a dedicated, audited operation until a verified self-service email-change flow exists.
  - Constraint: `googleId`, `hashedPassword`, calendar-feed credentials, `isSysAdmin`, and server-owned identifiers are not ordinary profile fields and must be immutable through generic user mutation.
  - Constraint: Changing email must invalidate active sessions and must not silently relink or unlink a Google identity. Provider binding changes require a separate explicit recovery operation.
  - Constraint: Google email-based linking must require a provider-verified email; consider an authenticated explicit account-linking flow as a later defense-in-depth improvement.

- [x] **BA-D012 — Uploaded-file accessibility:** Decide whether the direct file route intentionally makes all uploads public.

  - Finding: No documentation was found establishing a universal public-upload policy. Range-request streaming explains the delivery implementation but does not require bypassing authorization. A gallery comment indicates that public parent content may historically have governed access to its referenced image.
  - Decision: Direct file URLs enforce the file's own visibility. Public gallery, branding, and similar workflows must explicitly make their referenced file public, or use a parent-specific endpoint that verifies the public reference.
  - Constraint: `storedLeafName` unguessability is not authorization. If a universal public-by-link policy is later chosen, document it explicitly and reconcile or remove the contradictory per-file visibility model.

- [x] **BA-D013 — Calendar feed authentication:** Decide how personalized unauthenticated iCal subscriptions are secured.

  - Decision: The unguessable subscription URL is a bearer credential because calendar clients do not have an interactive session. It may be shown and copied by its owner; merely hiding it is not the security boundary.
  - Required controls: Scope the token only to the owner's calendar feed, keep it out of generic user payloads and other-user administration, provide owner-controlled rotation/revocation, reject unknown non-public tokens, require an active user, and prevent raw token values from entering application/proxy logs, audit records, filenames, or unrelated responses.
  - Constraint: Deactivation must revoke or disable feed access. Token hashing at rest is a desirable defense-in-depth follow-up if the product accepts show-once/rotate semantics or another safe recovery design.

## Workstream summary

| Workstream                          | Status      | Exit condition                                                                                            |
| ----------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| P0: Contain workflow feature        | Not started | Normal UI/server entry points and effective grants are removed; negative access tests pass                |
| P0: Generic DB3 authorization       | Complete    | Crafted query/mutation attempts cannot cross table, row, field, association, filter, or delete boundaries |
| P0: Protected accounts and signup   | Complete    | No untrusted path can obtain or delegate sysadmin authority                                               |
| P0: Secrets and object-level gaps   | Not started | Tokens/hashes are excluded or redacted and known direct endpoint gaps are closed                          |
| P1: Permission and role model       | In progress | Delegation policy and protected role/permission metadata are authoritative                                |
| P1: Sessions and revocation         | Not started | Grants and revocations are reflected reliably and promptly                                                |
| Deferred: Band Admin rollout        | Deferred    | An actual Sysadmin manually composes, tests, and assigns the production role after hardening               |
| P1: Site configuration split        | Not started | Band-owned settings are allowlisted; platform settings remain protected                                   |
| P1: UI/page/server alignment        | Not started | Shared capability metadata drives navigation and page access                                              |
| P1: Test suite                      | In progress | Persona and adversarial matrices pass                                                                     |
| P2: Optional delegated capabilities | Not started | Any later redacted audit or limited support capability is separately designed and authorized              |
| Deferred: Production rollout        | Deferred    | The manually composed role passes production smoke tests and is assigned                                  |

Priority meaning:

- **P0** findings block production readiness because they expose authority, credentials, protected objects, or an unused callable feature.
- **P1** findings block reliable Band Admin platform support because they govern composition, revocation, settings boundaries, and UI/server agreement.
- **P2** work is optional and should not delay readiness unless a product decision brings that capability into scope.
- **Deferred** work begins after the secure platform is ready and includes exact role composition, assignment, and destructive workflow cleanup.

## Production-readiness requirement — Contain the unused workflow feature

Decision: No tenant uses workflows, and Band Admin must have no access to them. Containment is required for platform readiness; physical deletion and destructive schema migration are deferred.

### BA-WF000 — Contain workflow access

- [ ] Remove workflow navigation and other normal UI entry points.
- [ ] Disable or unregister workflow RPC, resolver, and generic DB3 entry points so UI bypass cannot reach the feature.
- [ ] Remove workflow grants from active/default role matrices and prevent the five workflow permissions from being delegated.
- [ ] Add negative tests proving anonymous and non-Sysadmin callers cannot reach workflow data or mutations.
- [ ] Mark remaining workflow code, permissions, and schema as deprecated pending physical removal.

Acceptance criteria:

- [ ] No normal UI exposes workflow functionality.
- [ ] Crafted server requests cannot invoke workflow operations through retained routes or generic DB3.
- [ ] No active non-Sysadmin role receives an effective workflow grant.

## Deferred cleanup — Physically remove the workflow feature

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

- [x] Authorize the proposed new values as well as the existing row context.
- [x] Reject the whole mutation when a forbidden or unknown field is supplied, or persist only the explicitly sanitized model according to a documented policy.
- [x] Never write the original unsanitized `localFields` after authorization.
- [x] Apply equivalent rules to insert and update.

Policy:

- Generic DB3 insert and update mutations are atomic with respect to local fields: if row authorization fails or any proposed local field is forbidden or unknown, the whole mutation is rejected with HTTP 403 before Prisma create/update and before activity logging. No partial local-field update is permitted.
- On update, the persisted row supplies the ownership and row-authorization context, while field authorization receives the proposed model. Only the resulting authorized model, plus server-owned audit fields, may reach Prisma.
- The update primary key remains validated routing metadata and is not copied into Prisma update data. Association fields are covered by the authorization and execution policy completed in BA-A004.

References:

- [Insert path](../src/core/db3/server/db3mutationCore.ts#L406)
- [Update path](../src/core/db3/server/db3mutationCore.ts#L497)
- [Authorization/sanitization core](../src/core/db3/shared/db3core.ts#L607)

Acceptance criteria:

- [x] A mixed `{ id, allowedField, forbiddenField }` update cannot persist the forbidden field.
- [x] A crafted `{ id, isSysAdmin: true }` user update is rejected for every non-sysadmin actor.
- [x] A crafted insert cannot supply protected fields.

Evidence:

- Implementation: proposed-field sanitization combined with persisted-row ownership/table authorization in `src/core/db3/shared/db3core.ts`; atomic authorization failure and sanitized-only Prisma create/update payloads in `src/core/db3/server/db3mutationCore.ts`; `User.isSysAdmin` mutation authorization restricted to the explicit `isSysAdmin` bypass in both User schemas.
- Verification: `yarn test:auth` and `yarn test` (44 passed, including mixed-field atomicity, every non-sysadmin persona, protected and table-denied inserts, authorized insert/update, and sysadmin control cases); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR: see gh issue #668

### BA-A004 — Authorize associations

- [x] Enforce authorization on association-only mutations.
- [x] Authorize both removal and insertion of association records.
- [x] Apply protected-permission policy to `RolePermission` changes.

Policy:

- Every supplied association field is authorized together with local fields against the parent table, persisted row, ownership context, and field permission before any local Prisma update. `UpdateAssociations` repeats the parent row/field authorization as a defense-in-depth boundary for direct server callers.
- Association additions and removals are awaited, use the same transactional client for reads and writes, and emit their activity records before the parent mutation returns.
- Per BA-D004, the raw `RolePermission` topology is sysadmin-only. Non-sysadmins cannot change it through `Role.permissions`, `Permission.roles`, or direct generic `RolePermission` insert, update, or delete mutations. This deliberately protects every grant, including `sysadmin`, `impersonate_user`, and `never_grant`, rather than relying on a partial name blacklist.

References:

- [Association mutation implementation](../src/core/db3/server/db3mutationCore.ts#L302)
- [Insert/update association preflight](../src/core/db3/server/db3mutationCore.ts#L498)

Acceptance criteria:

- [x] A non-sysadmin cannot add `sysadmin` or another protected permission to any role.
- [x] A non-sysadmin cannot alter associations on a protected role.
- [x] Association-only mutations cannot bypass row/field authorization.

Evidence:

- Implementation: parent row/field preauthorization for insert/update association payloads, defense-in-depth authorization inside `UpdateAssociations`, awaited association execution, consistent transactional delegate use, and a sysadmin-only `RolePermission` topology guard in `src/core/db3/server/db3mutationCore.ts`; server-derived intention supplied by the remaining direct workflow caller; insert authorization no longer derives ownership from an unpersisted partial model.
- Verification: `yarn test:auth` and `yarn test` (53 passed, including protected grants, protected-role removal, direct topology bypass attempts, row-scope rejection before association access, awaited insert/remove behavior, insert-with-association behavior, and sysadmin controls); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR: see gh issue #668

### BA-A005 — Authorize deletes

- [x] Enforce table, row, target, and operation authorization before soft or hard delete.
- [x] Restrict hard delete to an explicit allowlist or dedicated operations.
- [x] Protect built-in roles and permissions from deletion.
- [x] Review cascading effects before allowing Role or Permission deletion.

Policy:

- Every `xTable` declares its generic-delete policy alongside the rest of its schema. The required `TableDesc` field, constructor invariants, and authorization tests enforce complete coverage and agreement with each table's soft-delete schema.
- Tables with an `isDeleted` column are soft-delete-only through generic DB3. Hard-only domain and association tables are individually allowlisted and still require authorization against the persisted target row. The generic data grid requests `softWhenPossible` so the server chooses the permitted operation.
- `Role`, `Permission`, `RolePermission`, `Change`, `Setting`, and the pending-removal workflow tables cannot be deleted through generic DB3. `User` hard deletion is also excluded and requires a separately scoped Sysadmin maintenance operation.
- Deleting a Role would cascade its RolePermission rows and set assigned users' `roleId` to null. Deleting a Permission would cascade its RolePermission rows and set visibility references to null across domain records. Generic deletion remains disabled for both; any future dedicated operation must present and validate those consequences.
- A non-Sysadmin cannot soft-delete a user whose `isSysAdmin` flag is set or whose role contains `sysadmin`, `impersonate_user`, or `never_grant`. BA-U001 consolidated this delete-specific guard with the shared protected-principal policy used by all user-management operations.

References: [delete-policy table contract](../src/core/db3/shared/db3core.ts#L478), [delete implementation](../src/core/db3/server/db3mutationCore.ts#L440)

Acceptance criteria:

- [x] Login alone cannot delete registered DB3 records.
- [x] Protected roles, permissions, and users cannot be deleted by Band Admin.
- [x] Delete tests cover cascade and `SetNull` behavior.

Phase completion evidence:

- Implementation: required delete-policy metadata and schema consistency invariants on `xTable` in `src/core/db3/shared/db3core.ts`, with the policy declared beside every DB3 table schema; soft-only and explicit hard-delete operation enforcement, persisted-row authorization, protected-user target checks, and disabled generic identity/security/audit/workflow deletion in `src/core/db3/server/db3mutationCore.ts`; generic DB3 grids now request `softWhenPossible` in `src/core/db3/components/db3DataGrid.tsx`.
- Verification: `yarn test:auth` and `yarn test` (65 passed, including complete policy coverage, soft/hard operation boundaries, login-only rejection, persisted owner-row scope, protected-user targets, user hard-delete rejection, authorized controls, and preservation of RolePermission cascade plus User/visibility `SetNull` dependents); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR: see gh issue #668

## Phase 2 — Protect identities, role delegation, and signup

### BA-U001 — Central protected-principal policy

- [x] Add one server-side policy equivalent to `canManageUser(actor, target, action, desiredRole)`.
- [x] Treat a user as protected when `isSysAdmin` is true or their role contains a protected/system permission.
- [x] Apply the policy to edit, deactivate/delete, reset, impersonate, and role-assignment operations.
- [x] Ensure the UI consumes server-provided decisions but is not the enforcement boundary.

Policy:

- The central policy is an additional restrictive layer. Existing resolver, table, row, and field authorization remains mandatory and may be stricter; the policy cannot grant a Moderator or another role a capability it did not already have.
- `sysadmin`, `impersonate_user`, and `never_grant` are protected permissions. A user with one of those permissions through their role, or with `isSysAdmin` set, is a protected principal.
- Only the `User.isSysAdmin` flag is treated as the actual Sysadmin bypass. A protected role is not sufficient to perform actual-Sysadmin-only reset or impersonation operations.
- Band Admin may edit or deactivate an existing ordinary user and assign a predefined role that contains no protected permission. User creation is not delegated; self-signup is the ordinary account-entry path.
- Password-reset URL generation and impersonation are actual-Sysadmin-only. Impersonation additionally rejects self-impersonation and every protected target as defense in depth.
- Mutation and UI capability decisions load the actor, target, and selected role with their permission relations from current database state. UI controls consume a server capability query; mutations independently enforce the same policy.

Acceptance criteria:

- [x] Band Admin can manage an ordinary user according to the agreed policy.
- [x] Band Admin cannot modify, delete, reset, impersonate, or demote a Sysadmin.
- [x] Band Admin cannot promote themselves or another user beyond the permitted ceiling.
- [x] Moderator behavior does not gain new authority.

References:

- [Central user-management policy](../src/auth/server/userManagementPolicy.ts)
- [Server-provided UI capability query](../src/auth/queries/getUserManagementCapabilities.ts)
- [Generic user mutation enforcement](../src/core/db3/server/db3mutationCore.ts)
- [User administration controls](../src/core/components/user/UserAdminPanel.tsx)

Evidence:

- Implementation: one action-oriented protected-principal policy for edit, deactivation, role assignment, reset, and impersonation; fresh actor, target, and desired-role reads at server boundaries; role-ceiling enforcement on both insert and update; reset restricted to the actual Sysadmin flag; protected-target and self-target impersonation rejection; and server-computed capabilities controlling the user administration panel without replacing mutation enforcement.
- Verification: `yarn test:auth` and `yarn test` (82 passed, including all protected permissions, ordinary-user positive controls, protected-role and `isSysAdmin` targets, self/other/create promotion ceilings, reset and impersonation boundaries, server capability decisions, and unchanged Moderator authority); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR: see gh issue #668

### BA-U002 — Split ordinary user administration from system administration

- [x] Add `assign_user_roles` as a site-scoped, delegable, continuity-sensitive permission.
- [x] Make `User.role`, `User.isSysAdmin`, and account deactivation immutable through the generic User editor.
- [x] Move `User.isSysAdmin` to an unambiguous actual-Sysadmin-only mutation path.
- [x] Add dedicated role-assignment and deactivation endpoints that re-read actor, target, and role state inside the mutation.
- [x] Authorize role assignment by permission composition: the actor must hold `assign_user_roles`; every permission in both the target's current role and desired role must be delegable and held by the actor; protected principals remain out of scope. Actual Sysadmin bypasses this delegation envelope.
- [x] Compute assignable roles on the server and return only the safe role projection needed by the UI, without exposing the role-permission matrix.
- [x] Before a confirmed role change or deactivation, simulate the resulting active-user state for every affected continuity-sensitive permission. If no active non-Sysadmin holder remains, require an explicit acknowledgement that the server independently verifies.
- [x] Keep Permission, Role, RolePermission, default/public role flags, and permission registry metadata actual-Sysadmin-only.
- [x] Split ordinary profile editing, role assignment, deactivation, password reset, `isSysAdmin`, and impersonation into action-specific controls on the canonical user page.
- [x] Make the legacy raw Admin Users DataGrid actual-Sysadmin-only; keep it as a technical maintenance surface rather than the delegated daily-use UI.

References:

- [User/role/permission authorization maps](../src/core/db3/shared/schema/user.ts#L35)
- [User admin panel](../src/core/components/user/UserAdminPanel.tsx#L28)
- [Legacy raw user grid](../src/pages/backstage/adminUsers.tsx#L13)

Evidence:

- Implementation: added the code-owned `assign_user_roles` capability; replaced generic role, deactivation, and `isSysAdmin` writes with dedicated serializable-transaction mutations; enforced fresh actor/target/role reads, permission-composition delegation, protected-target ceilings, safe assignable-role projections, last-active-non-Sysadmin continuity simulation, explicit acknowledgement, session revocation, and narrow activity records. Raw role topology now carries an actual-Sysadmin table policy and full-topology queries independently verify the persisted `isSysAdmin` flag. The ordinary dashboard no longer distributes `RolePermission`, ordinary User queries no longer include role grants, the canonical user page has action-specific controls, and the legacy raw user grid is Sysadmin-only.
- Verification: `yarn test:auth` and `yarn test` (100 passed, including peer-equivalent role assignment, current/desired permission envelopes, protected/non-delegable/unheld/unknown rejection, continuity acknowledgement, alternate-holder behavior, session revocation, dedicated `isSysAdmin`, generic-path immutability, unprivileged maintenance-grid user creation, safe role projection, and actual-Sysadmin topology access); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR: see gh issue #668

### BA-U003 — Harden password reset

- [x] Make password-reset URL generation explicitly Sysadmin-only; `manage_users`, `admin_users`, and Band Admin must not authorize it.
- [x] Remove the reset action from every non-Sysadmin user-management surface.
- [x] Add a server-boundary test proving Band Admin cannot invoke the mutation or receive a reset URL for any target.
- [x] Preserve the existing mechanism as a last-resort Sysadmin operation until a separately scoped hardened recovery flow is designed.
- [x] Keep credential-bearing values out of activity logs even though the emergency operation is Sysadmin-only.

References: [forgotPassword mutation](../src/auth/mutations/forgotPassword.ts#L10), [reset completion mutation](../src/auth/mutations/resetPassword.ts#L14), [Sysadmin reset control](../src/core/components/user/AdminResetPasswordButton.tsx#L10)

Evidence:

- Implementation: the administrator-mediated reset mutation now requires both the `sysadmin` resolver gate and a fresh persisted `User.isSysAdmin` check before target lookup or token generation, so `manage_users`, `admin_users`, Band Admin, stale sessions, and role-carried `sysadmin` grants cannot reach the bearer credential. The reset control independently hides itself from non-Sysadmins, the raw reset URL is no longer written to the browser console, and password-reset completion records only non-secret event metadata instead of serializing full User rows. The existing manual-link mechanism and 48-hour lifetime remain unchanged pending a separately scoped recovery redesign.
- Verification: `yarn test:auth` and `yarn test` (104 passed, including rejection before lookup/token creation, role-carried `sysadmin` rejection, actual-Sysadmin issuance with hashed token storage, and credential-free reset activity records); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR: see gh issue #668

### BA-U004 — Constrain impersonation

- [x] Keep current `impersonate_user` sysadmin-only for the initial rollout.
- [x] Prevent impersonation of protected principals through defense-in-depth target checks.
- [x] Preserve and audit the original actor identity through the impersonated session.
- [x] If limited impersonation is approved later, implement a separate capability rather than weakening the existing one.

Reference: [impersonation mutation](../src/auth/mutations/impersonateUser.ts#L12)

Evidence:

- Implementation: impersonation now keeps the `impersonate_user` resolver gate and additionally verifies the caller's freshly read `User.isSysAdmin` flag before target lookup. The existing centralized user-management policy rejects self, deleted, actual-Sysadmin, and protected-role targets. Starting a session stores the original actor ID, and both start and stop transitions write credential-free activity records explicitly attributed to that original actor. The impersonation control independently hides itself from non-Sysadmins, and both mutations return only the resulting user ID rather than a selected User row. A future limited-impersonation design remains a separate capability rather than a relaxation of this endpoint.
- Verification: `yarn test:auth` and `yarn test` (114 passed, including role-carried grant rejection before target lookup, every protected permission, actual-Sysadmin/self/deleted targets, session identity transitions, original-actor audit attribution, and credential-free RPC/audit results); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR: see gh issue #668

### BA-U005 — Harden public signup and built-in role invariants

- [x] Remove `roleId` from public signup input.
- [x] Construct permitted user-create data explicitly rather than spreading caller input.
- [x] Replace ordinary-signup `ADMIN_EMAIL` promotion with a dedicated deployment/bootstrap path.
- [x] Enforce exactly one default-new-user role and one public role.
- [x] Make default/public role flags sysadmin-only.
- [x] Protect built-in roles from deletion.

References:

- [Signup schema](../src/auth/schemas.ts#L31)
- [Signup mutation](../src/auth/mutations/signup.ts#L13)
- [Public-role lookup](../src/core/db3/shared/db3core.ts#L879)
- [Built-in role designation contract](../src/auth/roleDesignations.ts)
- [Built-in role reassignment](../src/auth/mutations/setRoleDesignation.ts)
- [Sysadmin role-management page](../src/pages/backstage/roles.tsx)

Phase completion evidence:

- Implementation: ordinary signup accepts only name, normalized email, and password, constructs an explicit non-Sysadmin create payload, and requires exactly one default-new-user role. Google signup supplies its provider ID only through a server-owned helper. The legacy `ADMIN_EMAIL` promotion is removed. An unlinked authenticated recovery page is visible only to the active user matching `CMDB_ADMIN_BOOTSTRAP_EMAIL`; its mutation rechecks the database identity and a minimum-32-character `CMDB_ADMIN_BOOTSTRAP_SECRET`, atomically records a unique SHA-256 token hash, grants `User.isSysAdmin`, invalidates old sessions, refreshes the current session, and writes a credential-free audit record. Public-role consumers require exactly one matching role. Generic Role mutation can create only unassigned roles and cannot update either built-in designation; generic deletion remains disabled. A dedicated actual-Sysadmin mutation serializes reassignment under a Role-table lock, repairs zero or duplicate assignments, verifies that exactly one role remains assigned, and audits every changed flag under one operation. The Sysadmin role page exposes the two semantic assignments without encoding role names or rankings.
- Verification: `yarn test:auth` and `yarn test` (139 passed, including forged signup fields, legacy `ADMIN_EMAIL`, missing/duplicate built-in role lookups, unauthenticated/deleted/stale-email rejection, eligibility non-disclosure, wrong/reused credentials, hashed claim storage, promotion, session invalidation/refresh, generic designation-forgery rejection, zero/duplicate reassignment repair, actual-Sysadmin enforcement, no-op behavior, and grouped credential-free audits); `yarn tsc --noEmit`; focused ESLint; `yarn build`; Prisma schema validation and client generation with a disposable build URL and output because a running Prisma Studio process owns the normal Windows engine DLL.
- Commit/PR: see gh issue #668

### BA-U006 — Protect login identifiers and provider bindings

- [x] Disable non-Sysadmin generic/delegated User creation. Preserve the explicit self-signup flow and, if still needed, an actual-Sysadmin maintenance path.
- [x] Remove `User.email`, `User.googleId`, `User.hashedPassword`, calendar-feed credentials, `User.isSysAdmin`, and server-owned identifiers from generic/delegated mutation fields.
- [x] Keep ordinary email editing unavailable until a verified self-service email-change flow exists.
- [x] If operational email correction is required, provide a dedicated actual-Sysadmin-only mutation with fresh authorization checks, narrow credential-free audit metadata, and session invalidation.
- [x] Keep Google link/unlink separate from email correction and ordinary profile editing.
- [x] Require a provider-verified email before an existing account can be linked by email in the Google callback.
- [x] Add regression tests for crafted delegated User creation, Band Admin email takeover, direct writes to every server-owned authentication field, unverified provider email, and session invalidation after Sysadmin correction.

Acceptance criteria:

- [x] Band Admin cannot change which password or Google identity authenticates any account.
- [x] Band Admin cannot create accounts through generic DB3 or a hidden maintenance surface.
- [x] Actual-Sysadmin email correction is explicit, auditable, and cannot silently transfer or remove the existing Google binding.
- [x] No generic table or ordinary user endpoint can write authentication-owned fields.

References:

- [User DB3 schema](../src/core/db3/shared/schema/user.ts)
- [Google authentication callback](../src/pages/api/auth/[...auth].ts)
- [Actual-Sysadmin email correction](../src/auth/mutations/correctUserEmail.ts)
- [Verified Google profile email](../src/auth/server/googleProfile.ts)

Evidence:

- Implementation: generic User insertion now requires the actual `User.isSysAdmin` bypass while explicit self-signup remains unchanged. Login email is view-only after creation, and `googleId`, `hashedPassword`, `accessToken`, and `uid` are denied by both registered generic User schemas. A dedicated actual-Sysadmin email-correction mutation verifies fresh database authority before target lookup, normalizes the address, preserves Google binding, revokes target sessions, and records only a redacted change marker. The canonical user panel exposes that operation only from server-computed actual-Sysadmin capability data. Google signup/linking now fails closed unless `passport-google-oauth20` supplies a provider-verified, valid email, and email fallback can claim only an active account without an existing Google binding.
- Verification: `yarn test` (161 passed, including delegated creation, all authentication-owned fields for Band Admin and generic Sysadmin paths, actual-Sysadmin email correction, role-carried `sysadmin` rejection before target lookup, deactivated targets, session revocation, audit redaction, and verified/unverified Google profiles); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR:

## Phase 3 — Remove sensitive-data and object-level authorization gaps

### BA-S001 — Calendar-feed credentials and audit redaction

- [ ] Replace the broadly named/general-purpose `User.accessToken` contract with a calendar-feed-specific credential, or strictly constrain the existing field during a staged migration.
- [ ] Remove the token from ordinary user selections, generic tables, dashboard/session payloads, and every other-user administration response.
- [ ] Provide a self-only operation for the owner to create/copy and rotate or revoke their calendar subscription URL.
- [ ] Require token lookup to resolve an active, non-deleted user and disable or revoke feed access when that account is deactivated.
- [ ] Reject unknown non-public tokens rather than treating them as the public feed.
- [ ] Remove raw calendar tokens from request/activity logs, proxy logging where configurable, response filenames, and unnecessary calendar fields; apply appropriate private/no-store response headers.
- [ ] Never write password hashes, access tokens, reset tokens, or comparable credentials into activity logs.
- [ ] Add central structured redaction before serializing before/after records.
- [ ] Assess whether previously exposed tokens require rotation or historical log cleanup.
- [ ] Assess hashing calendar tokens at rest and document the chosen display/recovery semantics.
- [ ] Keep raw audit logs sysadmin-only until redaction is complete.

References:

- [User selection arguments](../src/core/db3/shared/schema/prismArgs.ts#L393)
- [Calendar feed token lookup](../src/core/db3/server/ical.ts#L166)
- [Calendar feed endpoint and telemetry](../src/pages/api/ical/user/[accessToken]/upcoming.ts#L17)
- [Calendar subscription UI](../src/core/components/dashboard/Dashboard2.tsx#L118)
- [Activity logging](../shared/activityLog.ts#L46)
- [Password-change logging path](../src/auth/mutations/changePassword.ts#L31)

### BA-S002 — File visibility and image operations

- [ ] Enforce file visibility on direct download rather than using `skipVisibilityCheck` without an equivalent guard.
- [ ] Preserve streaming and range-request support after the authorization decision; large-file delivery is not a reason to skip visibility checks.
- [ ] Make gallery, branding, and other intentionally public asset workflows set public file visibility explicitly, or authorize through a route that verifies the public parent reference.
- [ ] Inventory existing publicly referenced assets and safely align their visibility or route semantics before enforcing the direct-download check.
- [ ] Do not treat an unguessable `storedLeafName` as a capability or authorization boundary.
- [ ] Enforce visibility and mutation authority before image forking.
- [ ] Restore explicit authorization for gallery image updates.

References:

- [File download route](../src/pages/api/files/download/[...leafName_slug].ts#L13)
- [File visibility policy](../src/core/db3/shared/schema/file.ts#L38)
- [Gallery parent-visibility rationale](../src/pages/backstage/frontpagegallery.tsx#L552)
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

- [x] Replace the split enum/order/default-grant knowledge with one authoritative registry and generated views of it.
- [x] Record for each permission: stable key, category, scope, description, sort order, whether it is protected, whether it is delegable, whether it is granted publicly, and whether it is continuity-sensitive.
- [x] Make omissions from the runtime constants, display/provisioning order, public baseline, and protected-permission policy impossible or test-detectable.
- [x] Classify the intended scope and feature owner of every current permission. Workflow permissions remain explicitly marked as temporary until BA-WF004 removes them from the registry.

Resolved drift: the former `gPermissionOrdered` omitted nine enum permissions:

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

- [Canonical permission registry](../shared/permissions.ts)
- [Legacy Prisma seed](../db/seeds.ts#L597)
- [Startup permission synchronization](../src/setup/instrumentation-setup.ts#L7)

Evidence:

- Implementation: one code-owned registry now generates the `Permission.foo` compatibility constants, complete display/provisioning order, public grant baseline, protected-permission set, continuity-sensitive set, and canonical database metadata. Startup synchronization and fresh seeding consume the same generated metadata, and protected-principal checks consume the generated protected set.
- Verification: registry tests prove unique stable keys and sort orders, complete generated views, metadata invariants, generated database metadata, and the current public/protected/continuity classifications; `yarn test:auth` and `yarn test` (86 passed); `yarn tsc --noEmit`; focused ESLint; `yarn build`.
- Commit/PR: see gh issue #668

### BA-M002 — Database-owned role model

- [ ] Keep roles as arbitrary database-defined permission bundles; do not give application code knowledge of role IDs, names, tiers, or significance.
- [ ] Derive role protection and assignability from its current permission composition rather than stored rank or role-specific policy.
- [ ] Treat `Role.sortOrder` strictly as presentation metadata.
- [ ] Keep `isPublicRole` and `isRoleForNewUsers` as functional database flags administered only by actual Sysadmin.
- [ ] Treat roles installed by seeds or migrations as deployment templates, not runtime identities; deployed instances may customize or replace them.
- [ ] Evaluate a per-user authorization/session version under BA-R002 for immediate revocation; do not attach it to a role rank.

Acceptance criteria:

- [ ] Authorization and delegation behavior is unchanged if roles are renamed or reordered.
- [ ] A tenant may define a safer Band Admin-like role by assigning a smaller permission set without requiring a code change.
- [ ] No runtime authorization branch identifies a built-in role.

### BA-M003 — Delegation rules

- [x] Define protected/system permissions and delegability in the canonical permission registry.
- [ ] Require `assign_user_roles` for delegated role assignment.
- [ ] Allow assignment only when every permission in both the target's current role and desired role is delegable and present in the actor's effective permission set.
- [ ] Derive protected principals and protected roles from `User.isSysAdmin` and current permission composition; do not store or infer a role rank.
- [ ] Keep raw Role, Permission, and RolePermission administration sysadmin-only initially.
- [ ] Simulate the post-operation state and require explicit acknowledgement if it would leave no active non-Sysadmin holder of a continuity-sensitive permission.
- [ ] Recompute all delegation and continuity decisions at the mutation boundary; server-returned role choices and warnings are UX aids only.

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

## Deferred rollout — Compose and assign Band Admin

This phase starts only after the platform-hardening completion definition is satisfied. It does not block completion of the current effort.

### BA-P001 — Manually compose the initial role

- [ ] Export and archive the production role/permission matrix.
- [ ] Have an actual Sysadmin create a database-defined Band Admin role through the normal role-management surface.
- [ ] Copy the then-current Moderator permission set as an explicit starting snapshot; do not create runtime role inheritance.
- [ ] Remove any workflow grant still present in that snapshot.
- [ ] Add newly needed band-operation permissions one by one through the RolePermission matrix.
- [ ] Record the resulting explicit matrix as rollout evidence, not as a code-owned definition of the role.

### BA-P002 — Validate and assign the role

- [ ] Assign the candidate role to a non-Sysadmin test account first.
- [ ] Run positive band-operation and negative protected/platform-operation smoke tests.
- [ ] Verify role grant and revocation behavior in existing sessions.
- [ ] Review the final matrix before assigning the role to production users.
- [ ] Do not assign existing users automatically.

### BA-P003 — Optional future seed/template support

- [ ] Only if later requested, decide whether fresh installations should receive a recommended Band Admin template.
- [ ] Treat every seeded role and grant set as a mutable default recommendation.
- [ ] Never overwrite customized deployed roles or grants during startup or upgrade.
- [ ] Keep application authorization independent of seeded role names, IDs, ordering, and origin.

Rollout acceptance criteria:

- [ ] The manually composed role contains no protected, non-delegable, workflow, or otherwise unintended permission.
- [ ] Existing customized roles and grants remain unchanged.
- [ ] Renaming or reordering the role does not change authorization behavior.
- [ ] Production assignment occurs only after the test account passes the recorded smoke-test matrix.

## Phase 7 — Split band-owned and platform-owned settings

### BA-C001 — Typed setting authorization

- [ ] Classify each setting as public, band-content, band-configuration, or platform/system.
- [ ] Authorize updates using a server-side key registry/allowlist.
- [ ] Map each band-owned setting class to a narrow action-oriented permission such as `manage_site_branding` or `manage_site_content`.
- [ ] Prevent arbitrary names or IDs from bypassing the classification.
- [ ] Keep raw settings and bulk import/export sysadmin-only.
- [ ] Review public arbitrary-key reads before future settings can contain secrets.

References:

- [Setting keys](../shared/settingKeys.ts#L4)
- [Setting update by name](../src/auth/mutations/updateSetting.ts#L11)
- [Setting update by ID](../src/auth/mutations/updateSettingById.ts#L10)
- [Raw settings page](../src/pages/backstage/settings.tsx#L17)

### BA-C002 — Split Brand page

- [ ] Add `manage_site_branding` and use it for the band-owned Brand-page subset: site title, logo, favicon, theme, and calendar identity.
- [ ] Move `Dashboard_HostingMode` to a sysadmin-only surface.
- [ ] Let the Brand page render only the sections authorized by the actor's distinct capabilities instead of retaining one broad page-wide permission.
- [ ] Enforce the setting-key split in server mutations; hiding platform fields in the page is not sufficient.
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

- [x] Anonymous DB3 query cannot enumerate protected tables or use protected fields as predicates.
- [x] Logged-in caller cannot select admin intention or deleted rows.
- [x] Mixed allowed/forbidden update rejects or strips forbidden fields according to the documented mutation policy.
- [x] Association-only updates enforce authorization.
- [x] Hard and soft deletes enforce authorization.
- [x] Unknown fields, table IDs, operations, and filter operators are rejected.

### Role/persona cases

- [ ] Public, Limited, Normal, Editor, and Moderator behavior remains unchanged except for intentional security fixes.
- [ ] A representative database-defined delegated-admin test role can administer each intended domain capability independently, without application code recognizing the role identity.
- [ ] No normal user can access a workflow UI or invoke a workflow RPC while the retained feature awaits physical removal.
- [ ] Band Admin cannot create users; self-signup remains the ordinary account-entry path.
- [ ] Band Admin can edit allowed profile fields and deactivate ordinary users according to policy; password-reset URL generation remains actual-Sysadmin-only.
- [ ] Band Admin cannot edit login email, provider binding, password hash, calendar token, `isSysAdmin`, or server-owned identity fields.
- [ ] A non-Sysadmin holding `assign_user_roles` can assign and revoke a peer-equivalent role when both roles are within the actor's permission envelope.
- [ ] Removing the last active non-Sysadmin holder of a continuity-sensitive permission produces the required warning and explicit confirmation.
- [ ] Band Admin can assign only server-approved roles.
- [ ] Band Admin cannot set `isSysAdmin`.
- [ ] Band Admin cannot assign any role containing protected, non-delegable, or unheld permissions.
- [ ] Band Admin cannot edit Permission, Role, or RolePermission topology.
- [ ] Band Admin cannot target a protected user through edit, reset, deletion, or impersonation.
- [ ] Band Admin can only soft-delete/deactivate users; hard deletion remains unavailable.
- [ ] Band Admin cannot view raw audit logs.
- [ ] A user can retrieve and rotate only their own calendar subscription URL; Band Admin cannot retrieve another user's token.
- [ ] Unknown tokens and tokens belonging to deactivated users cannot retrieve a personalized calendar.
- [ ] Direct file downloads enforce visibility while authorized large/range downloads continue to stream.
- [ ] Band Admin cannot access Server Health, raw Settings, Hosting Mode, raw audit logs, or debug/test surfaces.
- [ ] Anonymous users can access Practice Tools.
- [ ] Sysadmin retains full intended access.

### Session and role-composition cases

- [ ] Equal-count role changes refresh correctly.
- [ ] Removing a role clears cached grants.
- [ ] Changing `isSysAdmin` refreshes or invalidates the session.
- [ ] Role-permission revocation affects active sessions.
- [ ] Deleted/deactivated users lose access.
- [ ] Public signup rejects or ignores `roleId`.
- [ ] Actual-Sysadmin RolePermission changes can compose an arbitrary safe role without role-name or seeded-role dependencies.
- [ ] Seeded roles remain mutable defaults and startup does not overwrite customized grants.

### UI consistency cases

- [ ] Every backstage route has explicit capability metadata.
- [ ] Navigation visibility and page access agree.
- [ ] Direct URL navigation cannot reveal an unauthorized page.
- [ ] Server calls remain protected when UI checks are bypassed.
- [ ] Delegated-admin user-role selectors show only assignable roles.

Phase completion evidence:

- Test suite:
- Manual verification:
- Security review:
- Commit/PR:

## Post-hardening Band Admin rollout checklist

This checklist is intentionally deferred and does not define completion of the current platform-hardening effort.

- [x] All product decisions above are resolved.
- [ ] Workflow containment is complete; physical deletion may remain deferred.
- [ ] P0 findings are fixed and adversarial tests pass before the role is assigned to anyone.
- [ ] Current production role and permission matrices are exported and archived.
- [ ] An actual Sysadmin manually creates Band Admin through the role and RolePermission pages.
- [ ] The role starts from a snapshot of the current Moderator grants, then receives only individually approved additions.
- [ ] Band Admin is initially assigned to a test account.
- [ ] Positive band-operation smoke test passes.
- [ ] Negative protected/system-operation smoke test passes.
- [ ] Session grant and revocation tests pass in the deployed environment.
- [ ] Logs contain no credentials or reset/access tokens.
- [ ] Production diagnostics expose no raw environment secrets.
- [ ] Final access matrix and operator documentation are published.

## Progress log

Add one row for each completed or materially changed work item.

| Date       | Work item | Change                                                                                                                                                                                    | Verification                                                                                    | Commit/PR         |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| 2026-09-10 | Audit     | Initial hardening and Band Admin rollout plan documented                                                                                                                                  | Static audit; configured local DB inspected read-only                                           | —                 |
| 2026-09-10 | Decisions | Recorded tenant, peer administration, impersonation, custom role, soft-delete, password-reset, audit, and Practice Tools decisions                                                        | All product decisions resolved                                                                  | —                 |
| 2026-09-10 | BA-T001   | Added the isolated authorization test harness, seven persona builders, forged DB3 request builders, process-local persistence, and enforced non-empty Vitest runs                         | `yarn test:auth`; `yarn test`; `yarn tsc --noEmit`; focused ESLint                              | —                 |
| 2026-09-10 | Scope     | Inventoried complete removal of the unused workflow vertical slice; later policy narrows the readiness requirement to containment and defers destructive cleanup                           | Inventory covers UI, server, permissions, settings, schema, migration, and verification         | —                 |
| 2026-09-10 | BA-M001   | Replaced split permission declarations with one canonical registry and generated runtime, ordering, public, protected, continuity, and database metadata views                            | `yarn test:auth`; `yarn test` (86 passed); `yarn tsc --noEmit`; focused ESLint; `yarn build`    | see gh issue #668 |
| 2026-09-10 | BA-U002   | Split profile, role, lifecycle, reset, superuser, and impersonation operations; added permission-envelope delegation, continuity acknowledgement, and actual-Sysadmin topology boundaries | `yarn test:auth`; `yarn test` (100 passed); `yarn tsc --noEmit`; focused ESLint; `yarn build`   | see gh issue #668 |
| 2026-09-10 | BA-U003   | Restricted emergency password-reset URL generation to actual Sysadmins and removed credential-bearing reset audit payloads                                                                | `yarn test:auth`; `yarn test` (104 passed); `yarn tsc --noEmit`; focused ESLint; `yarn build`   | see gh issue #668 |
| 2026-09-10 | BA-U004   | Restricted impersonation to actual Sysadmins, constrained protected targets, preserved original-actor attribution, and removed sensitive mutation results                                  | `yarn test:auth`; `yarn test` (114 passed); `yarn tsc --noEmit`; focused ESLint; `yarn build`   | see gh issue #668 |
| 2026-09-10 | BA-U005   | Hardened signup and one-time Sysadmin bootstrap, made built-in role lookup fail closed, and added atomic audited default/public role reassignment                                           | `yarn test:auth`; `yarn test` (139 passed); `yarn tsc --noEmit`; focused ESLint; `yarn build`   | see gh issue #668 |
| 2026-09-10 | Decisions | Narrowed completion to safe platform support; deferred exact Band Admin composition/assignment and workflow deletion; resolved user creation, login identity, public-file, calendar-token, and settings-split policy | Document review against current code paths and agreed product direction                         | —                 |
| 2026-09-10 | BA-U006   | Closed delegated User creation and generic authentication-field writes; added redacted actual-Sysadmin email correction with session revocation; required verified, conflict-safe Google email linking | `yarn test` (161 passed); `yarn tsc --noEmit`; focused ESLint; `yarn build`                 | —                 |

## Deferred ideas

These are not required for the initial Band Admin rollout unless a product decision brings them into scope:

- Custom role authoring by Band Admin with a server-owned grantable-permission subset.
- Target-limited impersonation for non-protected users.
- A redacted, band-facing audit log, if the current Sysadmin-only decision is revisited.
- Verified self-service email changes and explicit authenticated Google account linking.
- Complete physical removal of the contained workflow feature, including its schema and deployed database objects.
- Optional recommended Band Admin seed/template support; production authorization must remain independent of it.
- Multi-band tenancy within one database.
- Consolidating the two superuser mechanisms (`User.isSysAdmin` and `Permission.sysadmin`) into one model.

## Audit limitations

The initial audit traced source code and inspected the configured local database without modifying it. It did not actively exploit a deployed service or perform browser/runtime penetration testing. The high-risk paths above should be confirmed with regression tests as they are repaired, and the final implementation should receive a focused authorization review before production rollout.
