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
`CMDB_HOSTING_MODE=CafeMarche`; hosting mode is not a setting. Blank titles and
asset URLs remain intentional. Favicon and logo use registered band URL settings;
the restored logo key is `siteCustomization.logoUrl`, with the existing URL
validation and branding write permission. No global setting storage or database
column is added; optional primary text color remains deferred.

Branding upload tools set a draft and preserve separate save/cancel/reset. Local
Files are public and belong to the explicit selected band; their download URLs
carry that band's public ID. Original image bytes are retained, including SVG/ICO,
while the shared upload owner records available image metadata. Pasted/dropped
URLs remain direct URLs without new File records. Successful uploads remain in
Files after cancel/reset or a failed publication save. Scope changes cancel client
uploads and discard late completions. Page bootstrap explicitly refreshes branding
so an immediate save/reload sees committed settings across server bundles; the
loader retains its last-known-good behavior after refresh errors.

Timezone reads use trusted band ownership and the caller's database transaction.
Changing/resetting timezone reanchors only that band's all-day segments and event
bounds atomically, including DST; timed segments/other bands are unaffected. The
separate versioned UTC-conversion command requires `--band=<public-id>`; schema
migration itself does not convert date-time versions.

`LocalizedMarkdown` keeps resolved display text separate from exact stored editor
values. Its caller supplies scope, edit locale and attachment policy; existing band
chrome uses `BandLocalizedMarkdown`, with an enabled writing language chosen from
the full preference list. Changing the selector starts that exact locale's draft.
Missing overrides start empty without copying fallback text. Saving empty text
creates a blank override; explicitly using inherited content removes only that
key/locale/scope row. Cancel sends no write, failed saves keep the draft, and a
post-commit refresh failure has separate feedback. Context changes discard late
read/save/upload completions; grant and availability refreshes preserve drafts
while disabling unauthorized writes.

The static-string owner validates registered keys and each key's schema/format.
Exact reads and writes refresh authority inside Serializable transactions. Band
writes require an explicit selected band and `manage_band_localization`; platform
writes require `manage_global_localization`. Sets require an enabled locale;
existing unavailable overrides can still be removed. Storage, person-authored
audits and resets are atomic, and unchanged values create no extra audit. Existing
band help uses public attachments through the restored Markdown editor; global
editors disable band attachments explicitly.

Optional Wiki help uses a registered Markdown definition's `wikiPagePath`
association, starting with `WikiWelcomePage_Markdown` for `welcome`. Values belong
to the selected band's localized-string scope and resolve independently of the
Wiki revision. Other pages can register their own help keys/path associations.
Unregistered pages receive no injected help. Arbitrary `WikiPage_<slug>_Markdown`
setting keys remain removed; production-copy inventory must account for existing
help content when mapping it to registered keys. Broader translation management
and complete translation coverage remain part of B.
