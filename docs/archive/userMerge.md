# Merge users

The profile's **Merge with another user** action selects a second account and a
Main account. A plain report explains the fixed policies and their aggregate
effects. The only commitment decision is to accept the complete report or cancel.

`merge_users` grants access to the approved identity fields and organization-wide
aggregate merge report. It does not grant access to response contents, sign-in
identifiers, credentials or detailed activity. The new protected, non-delegable
permission is initially granted to the designated Sysadmin role. Sysadmins can
explicitly grant it to other trusted roles. Delegated operators must be able to
manage both accounts within their permission envelope. Deactivated participants
additionally require `recover_users`. Operators cannot merge their own account or
operate from an impersonated session.

## Version 1 policies

- Main retains its ID, UID, name, contact details, role, Sysadmin status, profile
  values and preferences, including blanks and defaults. Retiring's stored
  preferences are removed. Role continuity consequences appear in the report.
- All email and Google sign-in methods move to Main. Main's password wins when
  present; otherwise Retiring's password is transferred. All email aliases share
  the resulting password. A result without a usable sign-in method is blocked.
- Both accounts' sessions and reset tokens are revoked, including impersonation
  sessions originating from either account. Main's calendar subscription remains;
  Retiring's subscription is invalidated.
- Event responses missing from Main transfer. For overlaps, Main's entire stored
  event response wins, including blank comments, unset instruments and invitation
  overrides. Segment attendance applies that rule independently per segment.
  Transferred attendance advances calendar response revisions.
- Distinct song credits transfer. Exact `(songId, typeId, year, comment)` duplicates
  are removed, including duplicates within Retiring. Different comments or years
  remain separate credits. Existing Main-only duplicates are preserved.
- Main's user tags remain; Retiring-only memberships are discarded. User tags
  affect invitations and expected attendance.
- Distinct instruments combine. Main's primary selection remains; imported
  instruments are non-primary. Duplicate or multiple-primary instruments on Main
  block the merge until corrected.
- Uploaded files and distinct file/person tags transfer; duplicate person tags
  are removed. Current creator attribution transfers for songs, events, gallery
  items, custom links, menu links, wiki pages, setlist plans and plan groups.
  Deactivated content is included without restoring it.
- Activity actors, workflow logs, wiki revision authors and historical last-editor
  fields keep their original identity. The retired profile points to Main.
  Consequently historical contribution queries by the original actor ID retain
  that attribution. Wiki editing locks held by Retiring are released.
- Retiring must have no workflow default/current/last assignments. Stored setlist
  plans must contain no embedded user references to Retiring. Unreadable plans
  block the merge because their references cannot be established. These are
  explicit version-1 eligibility limits, not silent omissions.
- Main must be active. Neither participant may already be retired by a merge.
  Retiring cannot itself have received prior merges in this version. Additional
  accounts may still be merged into the same active Main.

The report distinguishes all overlaps from overlaps with different stored values.
A discarded-comment count includes only non-empty retiring comments that differ
from Main's comment. No individual response, comment, plan or sign-in identifier
is returned. Counts are derived from the same decisions that execute the writes.

## Code organization

`src/auth/server/userMerge/policies.ts` declares execution order and policy version.
Each module in `policies/` owns its reads, decisions, aggregate report and apply
step. Detailed review state and apply closures remain server-side. A schema
coverage test requires every foreign key to User to have exactly one declared
policy. Embedded JSON references are covered separately.

Preview and commit prepare the same policies. An HMAC using `SESSION_SECRET_KEY`
binds confirmation to the actor, direction, policy version, relevant hidden state
and report. A commit rechecks fresh authorization and rebuilds the plan inside a
serializable transaction. A changed plan requires a new preview. Policy writes,
credential revocation, retirement metadata and aggregate audit record commit
together. An exact repeat confirmation returns the completed result.

`mergedIntoUserId` and `mergedAt` are server-owned fields.
Generic writes cannot alter them; normal reactivation and credential maintenance
reject merged accounts. Live association writers reject retired user references.
There is no application undo operation. The original user row and historical audit
actors remain, but discarded conflicting responses are not recoverable through
the merge UI.

## Deployment and verification

Apply `20260914120000_user_merge` through normal Prisma migration deployment and
regenerate the Prisma client before starting the application.

- `yarn test tests/userMergePolicies.test.ts tests/authorization/userMerge.test.ts --threads=false`
- `node scripts/test-user-merge-mysql.cjs`

The MySQL runner creates and removes a uniquely named disposable database on the
configured local server. It never clears the application database. Integration
tests cover actual uniqueness, transaction rollback, stale previews, concurrent
commits, credentials, response revisions, auditing and idempotent retries. They
are skipped by ordinary test runs unless a disposable test URL is supplied.
