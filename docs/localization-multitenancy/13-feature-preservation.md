# Feature preservation

Isolation must retain searchable original implementation and behavioral tests,
including partial removals. A smaller replacement does not establish parity.
The [design](00-design%20notes.md#baselines-and-restoration-target) pins the
functional/UX reference to `f027830a9790` and the distinct production migration
source to `094a783a94b95ed4ec15089e9372763b7d59f66c`.

## Inventory and source procedure

[feature-restoration.json](feature-restoration.json) is the feature/status/evidence
inventory. The [plan](04-implementation-plan.md) owns priorities and current gates.
Do not duplicate feature tables or append per-slice histories here.

```powershell
rg -n '^// MIGRATION_RESTORE:' src shared db tests
yarn migration:status
yarn migration:verify
```

Add preservation in the same change as isolation. Each `MIGRATION_RESTORE` block
records a stable feature ID, full source commit, original path/range, reason,
restoration/verification criteria and SHA256. Comment the original source,
including imports/comments; normalize only line endings/trailing spaces. Preserve
small modules in full and affected statements/context in larger modules. Register
every block in the inventory. Keep blocks at the original path or beside their
replacement, without recreating an RPC endpoint or shadowing an active module.

A block's source commit identifies the archived code, not the parity baseline.
Compare reference pages/components/server owners/tests at `f027830a9790`, even
when behavior has no archived block. Do not rewrite headers, hashes or archived
source to make their commit match that baseline. Keep migrated implementations
and safe later fixes; never revive obsolete schema or startup backfills.

The checker validates inventory, source ranges/checksums and whole-file deferred
test isolation. The normal test runner invokes it too. Deferred specifications
must use the checked marker and contain only comments plus `export {}`. Preserved
specifications are outstanding executable-test obligations, not passing tests.

## Closing an obligation

Restore the reference workflow through its existing UI/query path. Record
reference behavior retained, schema-driven differences or approved exceptions,
executable regression coverage and built-browser evidence. Partial checkpoints
keep the obligation pending. The [A1 search exception](04-implementation-plan.md#localized-catalog-text-search-exception)
changes timing only; full localized-name matching stays pending after A1.

Once complete, remove its source blocks and reference entries, set status to
`restored`, and record concrete evidence. Delete reference-only modules and remove
deferred markers when executable tests return. Keep the feature's decision/evidence
record. Retirement additionally requires `retirementApproval` recording explicit
user approval; isolation or a reduced replacement never implies it.

The legacy per-page `WikiPage_<slug>_Markdown` setting injection is to be removed,
not revived as arbitrary setting keys. Its archived help behavior still needs
explicit accounting in the `markdown-editing` inventory entry before closure.

`yarn migration:verify` protects preservation, not functional parity. Review must
establish that evidence proves the reference behavior and retirement is authorized.
`yarn migration:check` is the final B gate and fails while any feature is pending;
A0/A1 may retain pending features under their separate acceptance requirements.
