# Preserving features during application recovery

Temporary isolation must preserve the original implementation and behavioral
tests as searchable source. A smaller replacement does not establish feature
parity. This applies to partial removals as well as deleted modules.

Search the reference blocks with:

```powershell
rg -n '^// MIGRATION_RESTORE:' src shared db tests
yarn migration:status
```

Each block has a stable feature ID, the full source commit, original path and
line range, the reason for isolation, restoration and verification criteria,
and a SHA256 checksum. The original source is prefixed with line comments,
including its imports and existing comments. Line endings and trailing spaces
are normalized; source statements are retained. Small modules are preserved in
full. Larger shared files preserve the affected statements and surrounding
context, covering every removed line in the audited pending code changes.

Keep references at their original paths or beside the active replacement.
Do not recreate a deleted RPC endpoint merely to store reference code, or add a
`.ts` file that would shadow an active `.tsx` replacement. The preserved
primary-instrument RPC is beside the membership command, for example.

The [reference inventory](feature-restoration.json) records each block
independently. `yarn migration:verify` checks the inventory, source ranges,
checksums, and deferred test isolation. Deleting a file/block or changing its
content fails this check. The normal test runner performs the same check before
running tests. Neither compiler exclusions nor TypeScript suppressions are used.

## Current restoration obligations

| Feature ID | Behavior to recover or verify |
| --- | --- |
| `directory-search` | Multi-value tag/role/instrument filter operators, presets, URL state, contact-search permissions, CSV export and their pagination interactions. |
| `member-profile` | Reachable attendance, credits and wiki tabs; permitted account controls; profile activity recording; supported tab URLs. |
| `role-administration` | GlobalRole/BandRole editors, permission matrix, designations, account assignment, protected grants and continuity safeguards. |
| `account-merge` | Candidate search, picker, preview and confirmation; policy-specific transfers/deduplication, credentials, sessions, rollback, stale-preview and concurrency guarantees. |
| `account-analysis` | Authorized dependency counts, risk summaries and two-account comparisons. |
| `dashboard-content` | Relevant events, calendar, announcements/wiki, custom navigation and the required reference catalogs. |
| `global-search` | Shell search, authorized domain readers, keyboard behavior, selected-band links and cache isolation. |
| `markdown-editing` | Inline edit/cancel/save/save-and-close, authorization, feedback and refresh against explicit translation scope and locale. |
| `settings-editors` | Existing settings/branding workflows through typed hives, including time-zone reanchoring and cache invalidation. Replaced storage APIs are historical references. |
| `catalog-help` | Song-tag help Markdown alongside the migrated editor. Its rendering call is restored; browser verification remains pending. |
| `demo-seeding` | Useful sample content generators on the target schema, or an explicitly approved retirement decision for each omitted capability. |

These are recovery obligations, not instructions to uncomment obsolete Prisma
relations or restore the old authorization model. Existing migrated membership,
catalog, settings, authorization and bootstrap behavior stays active. Where a
capability already has an equivalent replacement, record the matching tests and
browser evidence instead of creating another implementation.

## Preserved test specifications

A wholly disabled test file starts with `// MIGRATION_DEFERRED_TEST` and contains
only comments and `export {};`. The test runner verifies this with the TypeScript
parser before omitting it from execution. An import, test call, re-export or other
executable statement fails the check. The runner reports these files as deferred
specifications; it does not count them as passing tests. Selecting only deferred
files exits unsuccessfully because no executable tests ran.

Partially affected test files retain their active tests, with removed cases
preserved in reference blocks. The current RPC-unavailability tests remain useful
during isolation; they do not replace the preserved functional specifications.
When restoring a workflow, adapt its old specifications to the target model and
make them executable again. Retain the jsdom directive and normal cleanup rules
when reactivating a DOM test.

## Completion rule

`yarn migration:check` is the final B completion gate. It verifies preservation
and fails while any feature is pending. A0 and A1 may have pending features;
their existing build/browser/workflow requirements still apply.

For each restored feature, implement and verify its complete behavior, then
remove its reference blocks and inventory entries, set its feature status to
`restored`, and record concrete test/browser evidence in `evidence`. A `retired`
status additionally requires `retirementApproval` recording the user's explicit
decision. The inventory retains the feature and decision after its temporary
source references are removed. An agent must not infer retirement approval from
a smaller replacement or from permission to isolate a feature.
Delete reference-only modules when their replacements are verified. Reactivated
test files must remove the deferred-test marker and contain executable tests.

The settings-editor recovery adds five references from `14c644c1`: both obsolete
pages, the generic settings descriptor/view, and its old table-authorization
assertion. The registered editor does not close `settings-editors`: logo/text-color
and upload controls, legacy clipboard accounting, and built-browser verification
remain obligations. Existing reference blocks and deferred specifications remain
intact.

The shared-person selector/editor cleanup adds fourteen references from
`15d112e0`. They preserve the obsolete account assignment selections/descriptors,
editor, grid columns, unreachable profile/directory renderers and enrichment, and
affected command/identity/transport specifications. Active transport checks now
use BandUser associations, and the shared account command has an executable
owner-update regression. The invitation tag-assignment read dependency remains
temporary, with writes disabled. Profile/directory restoration obligations stay
pending; this cleanup does not establish full workflow parity.

The event participant reader now replaces the unused `xUserWithInstrument`
descriptor with a named BandUser view and typed attendance participant model.
The descriptor's original implementation remains in the existing shared-person
references. Membership instruments, tags, primary defaults and display metadata
have executable native/DOM coverage and development-browser RPC evidence.
This adds no feature deferral or closure; full event response/invitation payload
and member-profile recovery obligations remain pending.

The checker detects missing references and inconsistent closure records. Review
must still establish that the recorded evidence proves parity and that a
retirement decision was actually authorized.

## Audit scope

The initial audit covered source/test removals from the October migration history
through `ab71102f`, including `7f9b1224` and `7bcbca62`, plus the pending Role/merge
isolation changes based on `ab71102f`. Every removed line in all 67 pending code
and test files is covered by a preserved source range. The audit also recovered
earlier Markdown/settings behavior and specifications, demo generators, profile
routes, dashboard readers/home content and the shell search mount.

Changes with equivalent active owners do not create separate deferrals. In
`7bcbca62`, role delegation and continuity logic moved to
`db3BandMemberPolicy.ts`, and the warning UI moved to
`BandMemberContinuityWarning.tsx`; those implementations remain executable.
Instrument, instrument-group, song-tag and member-tag/instrument contracts have
migrated implementations and focused/native coverage. The song-tag help content
omission was found and corrected during this audit.

Automatic startup backfills were replaced by deployment SQL migrations. They
must not be reintroduced as application startup behavior. The preserved seed
code is a reference for optional sample-content generation, not permission to
replay historical production transformations or recreate the old schema.

Future isolation must add its source references, behavioral specifications and
inventory entries in the same change. This audit is a baseline for continued
recovery, not permission for later undocumented removals.
