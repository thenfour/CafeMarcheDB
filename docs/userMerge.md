# Shared-account merge

Account merging combines two shared `User` accounts and their `BandUser` records
across every band. The existing profile action and the platform account grid open
the same dialog. Select the other account, choose Main and Retiring, review the
aggregate report, then accept it. Swapping or clearing a participant invalidates
the report. Main must be active; Retiring may be inactive.

The policies are fixed, versioned rules. There are no per-field decisions or
implicit privilege combinations. Analysis risk scores are advisory and do not
authorize a merge.

## Authority and request boundary

Search, merge-specific analysis, preview and commit require fresh `merge_users`
and `manage_global_users` authority from an active, unmerged account.
Impersonation and either participant being the operator are prohibited. A
delegated platform operator must cover both targets' active global-role and
every membership's band-role grants with their global delegation envelope.
Sysadmin may manage protected administrators. Selected-band grants cannot
authorize an account-wide merge.

Requests use two distinct User public identities. They contain presentation
preferences, and commits also contain the report's opaque confirmation. Band
scope, numeric identities and client-supplied policy decisions are rejected.
GlobalRole labels resolve globally; membership labels resolve within their own
band. Dependency summaries and reports disclose aggregate counts rather than
credentials, linked content or private settings. The ordinary Mass Analysis
reader retains its separate Sysadmin requirement.

## Fixed policies

| Owner | Result |
| --- | --- |
| Shared profile | Keep Main's public identity, contact fields, global role, administrator flag and account preferences, including blanks/defaults. Discard Retiring's account settings and release its Wiki editing locks. |
| Sign-in | Transfer email and Google identities. Keep Main's password when present, otherwise Retiring's password. A result without a usable sign-in method is blocked. Revoke both accounts' sessions, impersonation sessions started by either, and reset tokens. Keep Main's calendar subscription; revoke Retiring's. |
| Shared band membership | Keep Main's membership identity, role, active/inactive state and preferences. Move or discard Retiring's dependent records by the policies below, discard overlapping preferences and deactivate its membership. |
| Retiring-only membership | Reparent the existing membership to Main, preserving public identity, state, preferences and dependent records. Clear its band role. A separate role assignment may be necessary; inactive memberships and retired bands stay inactive. |
| Event responses | In each shared band, Main's entire response wins, including blank comments. Transfer missing responses and advance their revisions. Report overlap/comment loss as counts only. |
| Segment attendance | Apply Main-wins independently per segment, including unset answers. Transfer missing answers and ensure the parent Event response exists and advances its revision. Preserve original editor attribution. |
| Instruments | Union associations in shared bands; Main keeps its default instrument. Imported associations are nonprimary. Retiring-only memberships retain their instrument defaults. Multiple primary instruments on Main block the merge. |
| Member tags | In shared bands retain Main's tags and discard Retiring-only tags. An imported membership retains its own tags. |
| Credits and Files | Union distinct Song credits, removing exact duplicates. Transfer uploaded Files, including deleted/private rows, and deduplicate membership File tags within each band. |
| Authored content | Transfer current creators of Songs, Events, gallery items, Custom Links, menu links, Wiki pages, plans and plan groups, including deleted records. |
| Historical attribution | Keep historical User/editor references unchanged. Retiring's account and overlapping membership rows remain available for attribution. |
| Serialized plan references | Block retirement if any plan JSON still references Retiring's public identity or cannot be read safely. No plan contents are disclosed. |

Retiring cannot itself have received previous merges. The report warns when the
merge removes the last ordinary holder of a continuity-sensitive global or band
permission. Accepting that report acknowledges the consequences.

## Confirmation and transactions

Preview and commit prepare the same policies from freshly authorized snapshots.
An HMAC binds the operator, direction, policy version, participants, memberships,
grants and relevant private records. The secret and private state stay on the
server; no confirmation is persisted on User. Changes to hidden values can
invalidate review even when all displayed counts remain unchanged.

Commit rebuilds the plan inside one Serializable transaction, validates the
confirmation and blockers, applies the policies, retires the account, and records
one aggregate audit entry. Audit failure rolls back the complete merge. A changed
review or transaction conflict requires a fresh preview. A repeated or concurrent
commit cannot duplicate effects or audits: an already merged participant is
rejected by fresh eligibility, rather than returning a saved confirmation result.

The dialog locks selection and confirmation while a request is pending. Failed
commits discard the report. Failed authorization hides cached results. Changes
to profile, band, route locale, ordered preferences, presentation revision or
actor close the dialog and discard late replies.

## Verification

Use the repository test wrapper:

```powershell
yarn test tests/userMergePolicies.test.ts tests/authorization/userMerge.test.ts tests/userMergePicker.test.ts --reporter=dot
node scripts/test-user-merge-mysql.cjs
```

The native runner requires a local MySQL connection, creates a uniquely named
disposable database, runs the repository wrapper and drops only its own database.
Coverage includes both bands, exact retained values, private/deleted records,
credentials, grant revocation, stale reports, rollback, replay and concurrency.
The canonical migration [plan](localization-multitenancy/04-implementation-plan.md)
records complete-suite and built-browser evidence and the remaining A1/B gates.
