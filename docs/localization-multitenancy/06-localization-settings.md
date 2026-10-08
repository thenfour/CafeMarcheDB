# Localization and settings contracts

Shared resolution and settings policy serves every domain. Delivery status belongs
to [the plan](04-implementation-plan.md); API shapes and registry entries belong to
[source](../../src/locale).

## String resolution and formatting

[localePreferences.ts](../../src/locale/shared/localePreferences.ts) preserves route
preference, ordered browser tags and `en-US` fallback. Canonicalize/deduplicate;
invalid route tags fail, invalid browser entries are ignored. SSR quality-orders
`Accept-Language`; clients use `navigator.languages` and react to language changes.

[stringResolution.ts](../../src/locale/shared/stringResolution.ts) chooses scope
before language. **Any stored band override blocks global values/defaults**, even
if all its locales are disabled/deleted. In that scope, try route exact/language
match, each browser exact/language match in order, `en-US`, then any eligible value.
Language/final ties use canonical tag order, not database order.

Platform candidates need active global locales; band context restricts both global
and band candidates to the band's enabled active locales. Keep unavailable rows
for override-existence detection. Empty text is a value; missing text is null.
Static English registry defaults are virtual candidates only when no eligible
global English value and no band override exists, even with an empty locale table.
They never restore global meaning below a band override.

A null inherited string identity uses the source identity. A custom identity with
no translation does not fall back to the source. Fields resolve independently and
carry language/scope/source/reason provenance. Exact editor lookup has no fallback
and may inspect unavailable values; dynamic lookup requires authorized entity
identities, never arbitrary public string-ID access.

`formattingLocale` independently selects a formatter-supported preference and
needs no locale database row or translation. Carry full preferences as well as
formatting locale. ICU plain text has typed parameters: plural grammar follows
translation language, numbers/dates follow formatting locale. Markdown does not
interpolate. Unloaded/unavailable text stays explicit rather than becoming empty.

## Delivery and refresh

[presentation.ts](../../src/locale/server/presentation.ts) refreshes authorization
and reads the full authorized static/settings snapshot in RepeatableRead. SSR,
client and dashboard delivery share the contract. Optional band identity selects
validated context; language never selects a band or grants. Retain whole-catalog
delivery until measurement justifies changing it. Dynamic strings resolve with
authorized entity reads.

Cache identity includes band, full language preferences, locale availability,
membership/grants, defaults and stored revisions. Formatting locale alone is
insufficient. Context switches must not display old data or revive an obsolete
SSR snapshot. Common presentation invalidation covers settings, membership,
grants, translations and locale availability, with cross-tab/focus/language refresh.
Same-context refresh preserves drafts while applying fresh grants; scope changes
clear drafts. A failed write retains edits; a post-commit refresh failure remains
distinct from a failed save.

## Typed settings

| Hive | Server-owned scope | Default policy |
| --- | --- | --- |
| `global` | Platform | Public registered reads; `manage_global_settings` writes. |
| `band` | Authorized selected band | Public registered reads; `manage_band_settings` writes. |
| `user` | Active current person | Authenticated self reads/writes. |
| `bandUser` | Active selected membership | Membership self reads/writes. |

Hives have no implicit inheritance. Registries own types, defaults and per-key
gates: branding uses `manage_site_branding`; timezone uses `manage_band_settings`;
developer palettes require Sysadmin reads; upload-size reads require `manage_files`.
Omit restricted/unknown keys from delivery; preserve unrelated stored rows.
Membership calendar locale defaults to `en-US` and needs no database locale row.

Values are native JSON, never reparsed strings. Missing rows use defaults; valid
blank/false/zero/null values survive. Invalid stored types fail. Reset deletes the
owned row. Registered commands require explicit band context for band/membership
writes and derive person/membership owners from authorization. Refresh grants in
Serializable execution; validate the complete batch before writes. Audits and
timezone-derived changes share the transaction; noops preserve revisions/history.
Generic DB3 settings writes remain rejected.

Editors use authorized snapshots, explicit scope, registry validation and separate
save/cancel/reset. Clipboard export contains visible `{ key, value }` entries for
one scope; import validates entries, capabilities and duplicates as one atomic
batch. Reject pasted owner IDs, unknown keys and legacy `{ name, value }` documents.
Abandon pending clipboard reads on scope changes; await invalidation after saves.
The developer text palette remains a global registered setting; color-map edits
remain source-export previews.

## Branding, timezone and Markdown

Branding uses selected-band settings with registry validation/defaults and cache
identity including trusted band/host. Café Marché deployment configures
`CMDB_HOSTING_MODE=CafeMarche`; hosting mode is not a setting. Blank titles remain
intentional; removed logo/text-color schema fields are not recreated.

Timezone reads use trusted band ownership and the caller's database transaction.
Changing/resetting timezone reanchors only that band's all-day segments and event
bounds atomically, including DST; timed segments/other bands are unaffected. The
separate versioned UTC-conversion command requires `--band=<public-id>`; schema
migration itself does not convert date-time versions.

`LocalizedMarkdown` renders resolved Markdown. Explicit scoped translation editing
and broader tooling follow restoration; retaining existing working chrome does not
require complete translation coverage.
