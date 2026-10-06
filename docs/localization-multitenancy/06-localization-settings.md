# Localization and settings foundations

Implemented 2026-10-06, phase 2 of
[the implementation plan](04-implementation-plan.md). This records the shared
contracts, their initial server/client consumers, and focused validation. Domain
DTO hydration and localized entity writers follow in phase 3; application
recovery follows in phase 4.

## Preferences, string resolution, and formatting

`localePreferences.ts` preserves the explicit route tag, ordered browser tags,
and `en-US` system fallback. Tags are canonicalized and duplicates removed.
Malformed route preferences fail validation; malformed browser entries are
ignored. SSR obtains browser preferences from `Accept-Language`, including
quality ordering. The client supplies `navigator.languages` and reacts to
`languagechange`. The transport accepts a route preference now; full portal
route extraction remains phase 5.

`stringResolution.ts` chooses scope before language. Any stored band override for
the string blocks global values and registered defaults, including when all of
the overrides belong to disabled or deleted locales. Within the chosen scope,
selection tries route exact/language match, then each browser exact/language
match, then `en-US`, then any eligible translation. Language-match and last-resort
ties use canonical tag order, independent of database ordering.

Platform requests admit active global locales. Band requests constrain both
stored global and band candidates to that band's enabled, active locales. The
queries retain unavailable rows so override existence still prevents global
fallback. An intentional empty translation remains a value. Static registered
English defaults provide a virtual English candidate when there is no eligible
stored English global value and no band override, including an empty locale
table. They do not restore global meaning underneath a band override.

Resolution details include text, selected locale, scope, source, requested tag,
and reason. Missing text is `null`, distinct from `""`. Inherited catalog fields
use the same resolver: a null local string identity inherits; an empty custom
identity remains custom and untranslated. It cannot silently inherit global
content.

Privileged `getStaticTranslation` reads an explicit key, locale, and global/band
scope without fallbacks, including stored values excluded from presentation.
The server also exposes batch resolution and exact lookup for dynamic strings
whose identities came from an authorized entity read. There is no public endpoint
that accepts arbitrary dynamic string IDs. Phase 3 must wire those helpers into
DB3 reads and hydration together with entity ownership checks.

`formattingLocale` independently selects a formatter-supported tag from the same
preferences. It needs no translation or database locale row. The dashboard
presentation contract now carries `localePreferences` and `formattingLocale`.
Plain-text and Markdown keys derive from registry formats. Plain text uses ICU
MessageFormat with required, typed parameters; plural grammar uses the selected
translation's language while number/date formatting uses `formattingLocale`.
Markdown does not interpolate parameters. Typed getters and React components
share these contracts. Unloaded catalogs and unavailable translations have
explicit loading/error behavior; they do not silently return empty strings.

## Delivery and refresh

`loadPresentationData` refreshes authorization and reads the complete static
catalog and settings snapshot inside one repeatable-read transaction. The initial
presentation is delivered through `_app` for SSR and through `getPresentationData`
for client changes. Dashboard delivery uses the same catalog/settings contracts.
Language preferences do not select authorization scope or grants.

The catalog currently contains **83 registered keys**. The native two-band fixture
measured **13,170 UTF-8 bytes** for the catalog, including resolution details and
context metadata. This is a reproducible fixture measurement, not a production
dashboard measurement or a reason to introduce bundles yet.

Catalog fingerprints include band, full ordered preferences, relevant locale
availability, membership/grants, registered defaults, and stored values/revisions.
Server reads are fresh. Client queries use a request nonce and retain no previous
scope data while loading. Once the provider leaves its initial SSR context, that
snapshot cannot reappear on a later switch back. This avoids band A → B → A
reviving stale grants, strings, or settings.

Successful settings writes invalidate queries and notify the current tab and
other tabs through a storage marker. Focus and language changes refresh the
presentation as well. `invalidatePresentation` is the shared refresh boundary;
future translation, locale-availability, membership, and grant writers must call
it when introduced in phases 3/5/6. Those editing surfaces do not exist yet.

## Four typed settings hives

Each registry defines defaults, value validation, and per-key capabilities.
There is no implicit inheritance between hives.

| Hive | Owner selected on the server | Default capability | Storage |
| --- | --- | --- | --- |
| `global` | Platform | Public registered reads; `manage_global_settings` writes | Serialized JSON in text |
| `band` | Authorized selected band | Public registered reads; `manage_band_settings` writes | Serialized JSON in text |
| `user` | Current active person | Authenticated self reads/writes | Native Prisma JSON |
| `bandUser` | Current active membership in the selected band | Membership self reads/writes | Native Prisma JSON |

Branding/calendar-brand keys require `manage_site_branding`; timezone uses
`manage_band_settings`. Development text palettes require sysadmin read access,
and the maximum-upload-size setting requires `manage_files` read access.
Restricted values are omitted from snapshots rather than merely hidden by UI.
Unknown registry keys cannot be delivered or written; unrelated existing rows
remain intact. `calendar.locale` is a membership preference with canonical tag
validation and an `en-US` default; it does not require a locale row.

The server decodes text JSON once and validates native JSON without interpreting
strings as another JSON document. Missing rows use registry defaults. Valid blank
strings and `false` survive. Zero and null are not reset signals: a future
registry that permits them must preserve them too. Invalid stored types fail
validation instead of becoming defaults. Reset explicitly deletes the owned row.

Single and bulk mutations accept strict registered commands and a band-selection
hint. Client-supplied owner IDs are rejected. Authorization is refreshed inside
the serializable mutation transaction, and the entire batch is validated before
any writes. Audit records and timezone-derived event updates share that
transaction. Repeating an unchanged value leaves its row revision and audit
history intact. Branding caches are cleared after commit.

The client hooks provide synchronous typed reads, capabilities, set, reset, and
refetch after presentation delivery. They support all four hives and are covered
through real React provider/control tests.

## Adapted consumers and temporary restrictions

Branding reads selected-band JSON settings with registry defaults and validation.
Known-good cache entries include trusted band identity and host. Production
Café Marché must configure `CMDB_HOSTING_MODE=CafeMarche`; other hosting modes use
the existing default branding. Removed logo/text-color schema fields are not
restored. Blank title values remain intentional.

Timezone reads are fresh and band-scoped. Configured-band resolution now uses
the caller's database/transaction as well, fixing a transaction-boundary error
found while preserving the UTC-storage rehearsal. Changing or resetting a band's timezone
reanchors that band's all-day segments and recalculates its event bounds in the
same transaction, including DST-length changes. Timed segments and other bands
are excluded. Calendar settings consumption uses the four-hive snapshot and
membership locale; the calendar's broader domain adaptation remains phases 3–4.

`LocalizedMarkdown` now renders resolved Markdown and is read-only. Its obsolete
inline editor/write path was removed in phase 2 because it relied on the removed
settings model; phase 6 supplies the replacement scoped editor. Generic DB3
setting mutations now reject writes to all four hives. Phase 3 must adapt their
editors to the registered command API rather than bypassing key validation.

Obsolete user-settings and setting-authorization tests tied to removed helper
APIs, unrestricted raw setting writes, and permissive invalid-value defaulting
were replaced by server, React, and native-storage coverage. Timezone read/write
and native transaction tests now exercise registered band settings, explicit
reset, typed JSON, mixed bounds, rollback, and DST. The old pre-band fixture's
generic-setting hook cases were retired. Its versioned UTC-storage rehearsal and
the pure legacy calendar-date decoding checks remain. Broader maintenance-tool
multiband adaptation follows with domain recovery. The nine independent
attendance-classification tests were retained in
`eventAttendanceClassification.test.ts`. The repository runner now discovers
`.test.tsx` as well as `.test.ts`, fixing a trivial omission encountered while
adding React coverage.

## Validation

Focused command:

```powershell
yarn test tests/localizationResolution.test.ts tests/localizationSettings.test.ts tests/userSettingsContext.test.tsx tests/brandLoading.test.ts tests/brandingLifecycle.test.ts tests/authorization/multibandAuthorization.test.ts tests/authorization/permissionRegistry.test.ts tests/authorization/permissionSet.test.ts tests/testEnvironment.test.ts tests/eventAttendanceClassification.test.ts tests/datetime/bandTimeZoneLoading.test.ts tests/datetime/bandTimeZoneWrites.test.ts tests/datetime/bandTimePolicy.test.ts --reporter=dot
```

Native command, against a private disposable database only:

```powershell
yarn test tests/localizationSettings.mysql.test.ts tests/datetime/bandPolicy.mysql.test.ts --reporter=dot
```

The native fixture requires `CMDB_PHASE2_TEST_DATABASE_URL`, rejects ordinary
database names/hosts/ports, and rolls each fixture back. Validation used an
isolated MariaDB 10.11.9 instance and a fresh target-schema database, which was
removed afterward. No existing application database was changed.

Results:

- **169 focused tests passed across 13 files**, including isolated React tests.
- **10 native tests passed across two files** using real relations, JSON storage,
  audits, transactions, and event bounds. The private server was shut down after
  validation.
- ESLint passed for all **58 changed/new code files**, and `git diff --check`
  passed.
- `yarn typecheck` still fails with **716 diagnostics**, versus **759** at the
  start. The new localization/settings modules, adapted branding/timezone/date
  services, and phase-2 tests have no diagnostics. Remaining errors include
  removed domain models, descriptors, DTOs, and old editor contracts.
- An additional `tests/datetime/eventDateConsumers.test.ts` run was blocked in
  all four timezone probes before its 49 assertions: the existing dashboard DB3
  selection still requests removed `UserTag.significance`. This descriptor
  adaptation belongs in phase 3; the test remains in place.

Application builds, the full repository suite, and interactive application
acceptance remain phase 4 work; passing focused tests does not establish a usable
migrated application.

## Next execution step

Start phase 3 with the representative band-instrument vertical slice: global
opt-in/inheritance, custom instruments, localized names, functional groups,
authorized list/detail reads, forms, and transactional mutations. Apply these
shared localization and settings contracts there before adapting the remaining
DB3 domains.
