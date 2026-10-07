# Localization and settings contracts

These are the shared server/client contracts. Delivery status, unfinished editors,
and temporary restrictions belong to the [implementation plan](04-implementation-plan.md).

## String resolution and formatting

`localePreferences.ts` preserves route preference, ordered browser tags, and the
`en-US` system fallback. Canonicalize tags and deduplicate. Malformed route tags
fail validation; malformed browser entries are ignored. SSR uses quality-ordered
`Accept-Language`; clients use `navigator.languages` and react to `languagechange`.
Full portal route extraction follows restoration.

`stringResolution.ts` chooses scope before language. **Any stored band override
blocks global values and registry defaults**, even when every override belongs to
a disabled/deleted locale. Within the selected scope, try route exact/language
match, each browser exact/language match in order, `en-US`, then any eligible value.
Language-match and final ties use canonical tag order rather than database order.

Platform candidates use active global locales. In band context, both global and
band candidates must use that band's enabled active locales. Unavailable rows
remain visible to override-existence detection. Empty text is a value; missing
text is `null`. Static English defaults supply a virtual candidate when no
eligible global English value exists and no band override exists, including an
empty locale table. Defaults never restore global meaning beneath a band override.

A null inherited field identity uses its source identity. A custom identity with
no translation stays untranslated rather than falling back to the source. Each
resolved field carries text, selected locale, scope, source, requested tag, and
reason. Independent fields may resolve to different languages on one page.

`lookupStaticTranslation` reads an exact key/locale/scope without fallback,
including values excluded from presentation. Its standalone editor RPC is deferred.
Dynamic exact/batch lookup uses identities obtained from authorized entity reads;
there is no public arbitrary-string-ID lookup endpoint. DB3 integrates resolution
with entity ownership and field projection.

`formattingLocale` independently selects a formatter-supported preference; it
requires no database locale row or translation. Presentation carries both the
full `localePreferences` and `formattingLocale`. Registry formats distinguish
plain text from Markdown. ICU plain text has typed required parameters: plural
grammar uses translation language, while numbers/dates use formatting locale.
Markdown never interpolates. Typed getters/components report unavailable or
unloaded text explicitly rather than silently returning empty strings.

## Delivery and refresh

`loadPresentationData` refreshes authorization and reads the complete static
catalog/settings snapshot in RepeatableRead. `_app` supplies SSR presentation;
`getPresentationData` handles client changes; dashboard delivery uses the same
contracts. An optional band public ID selects validated band context; omission/null
loads platform/account presentation. Language never selects a band or grants.
Keep whole-catalog delivery until measured costs justify a different strategy.

Fingerprints cover band, full preferences, locale availability, membership/grants,
registry defaults, and stored values/revisions. Client queries use a refresh nonce
and do not retain another scope's data while loading. After leaving the initial
SSR context, switching back cannot revive that snapshot. Settings writes invalidate
queries and notify other tabs through a storage marker; focus/language changes
also refresh. `invalidatePresentation` is the common boundary for membership,
grant, translation, and locale-availability writers as well.

## Typed settings

Registries define defaults, validation, and per-key capabilities. Hives are
independent and have no implicit inheritance.

| Hive | Owner selected by server | Default read/write policy |
| --- | --- | --- |
| `global` | Platform | Public registered reads; `manage_global_settings` writes. |
| `band` | Authorized selected band | Public registered reads; `manage_band_settings` writes. |
| `user` | Current active person | Authenticated self reads/writes. |
| `bandUser` | Current active selected membership | Membership self reads/writes. |

Branding/calendar-brand writes use `manage_site_branding`; timezone writes use
`manage_band_settings`. Development text palettes require sysadmin reads; the
upload-size setting requires `manage_files` reads. Restricted values are omitted
from snapshots. Unknown registry keys cannot be delivered or written; unrelated
stored rows remain intact. Membership `calendar.locale` validates canonical tags,
defaults to `en-US`, and requires no database locale row.

All values use native Prisma JSON. Validate directly, without reparsing strings.
Missing rows use defaults; valid blank strings and `false` survive. Zero/null also
remain values when a registry permits them. Invalid stored types fail validation.
Reset explicitly deletes the owned row. The follow-up SQL converts former text
columns while preserving the documents encoded by the data migration.

Strict single/bulk commands accept an optional band public ID, required for
band/membership writes. Person/membership owner IDs come from authorization, not
client payloads. Refresh grants inside Serializable execution and validate the
whole batch before writes. Audits and timezone-derived updates share the
transaction. Unchanged values preserve revisions/audit history. Branding caches
clear after commit. Hooks provide synchronous typed reads, capabilities, set,
reset, and refetch once presentation has loaded.

Generic DB3 mutations reject all settings-hive writes. Editors use the registered
command API so they cannot bypass key validation or per-key authorization.

The registered editor reads only the current authorized presentation snapshot.
Scope selection is explicit; account/membership IDs never come from the form or
clipboard. Each field exposes its saved/default source, validates against its
registry schema, and offers separate save, cancel and reset actions. A context
switch discards the previous account/band draft; a refresh retains unsaved edits
while updating untouched fields. Failed writes retain the draft.

Clipboard export contains visible `{ key, value }` entries for one scope. Import
validates every entry, edit capability and duplicate key before submitting one
batch to the registered API. Pasted owner IDs, unregistered keys, and legacy
`{ name, value }` documents are rejected. A pending clipboard read is abandoned
when its scope changes. Successful writes await presentation invalidation; server
authorization remains authoritative if permissions change during editing.

## Branding, timezone, and Markdown consumers

Branding reads selected-band settings with registry defaults/validation. Cache
identity includes trusted band and host. Café Marché production configures
`CMDB_HOSTING_MODE=CafeMarche`; other modes retain their default branding. Removed
logo/text-color schema fields are not recreated; blank titles are intentional.

Timezone reads take a trusted numeric band ID from authorization/loaded events and
the caller's database/transaction. The versioned UTC conversion command requires
`--band=<public-id>` and converts only that band. Changing/resetting timezone
reanchors that band's all-day segments and recomputes event bounds in the same
transaction, including DST changes. Timed segments and other bands are unaffected.
Calendar consumers use the settings snapshot and membership locale.

`LocalizedMarkdown` renders resolved Markdown read-only. Scoped editing replaces
the removed legacy inline write path after restoration.
