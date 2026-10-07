# Localization and multiband design

Agents: do not modify this file.

---

this is largely to catalog decisions, rationale, in order to form a cohesive and linear
plan towards prod. not every detailed decision needs to be made, but we need to have
enough in place to know the architecture so we can establish the right base / concepts
and not paint ourselves into a corner.

# some things

-  🟣 terminology: not "tenant"; use "band".

# localization design

-  ✅ deduction / `useLocale`
   -  ✅ with fallback mechanism (fallback to english -> any available)
-  ✅routing
   -  ✅with locale (`/b/fr-FR/my-band/` or `/fr-FR/b/my-band/` or `/b/my-band/fr-FR`)
   -  ✅without locale (tenants with 1 lang, or default lang)
-  ✅lang switching (route to equiv url in other language)
   -  ✅component to switch on backstage
-  ✅seeding: once a storage format and import mechanism is established, this becomes clear.
-  ✅wiki content / descriptions / event titles / song titles
   -  song titles: use aliases; no localizations.
   -  descriptions: no translation. users can fallback to multilingual.
   -  same with wiki
-  ✅ical support: which locale do we deliver in? users will need to get a setting for this.
   -  see `createCalendar` -- we hardcode `language: "EN",`.
-  ✅efficient delivery/resolution/transport: initially we will just deliver the whole catalog.
   will need to take metrics to decide if & what action is needed to optimize.
-  ❓editor
   -  ❓inspection of string resolution, fallbacks
   -  should be usable for db maintenance quick lookups / text search
   -  ❓export / import
   -  ❓who has access? is this page per-band or global?
-  ❓content storage & expression
   -  ✅database content (instruments, attendance options, tags) - db string registry for dynamic strings
   -  ✅built-in site chrome (menu links, page content) - also in the db.
   -  ✅branding (page titles, ...) - also in the db.
   -  ❓big calendar currently hardcodes nl-BE
   -  ❓zod validation errors often are hard-coded like `password: z.string().min(1, { message: "Password is required" }),`

## multi-tenancy and inheritance

Different tenants will want to put different content for example in page headers etc.
It suggests a db model with unique over

-  `stringKey`
-  `localeId`
-  `bandId`

But that's not possible because `bandId`
[can't be null](https://www.prisma.io/docs/orm/v7/reference/prisma-schema-reference#unique-1).
So it seems like we need 2 tables for static strings:

```prisma
model Locale {
   id         Int
   publicId   String @unique @db.Char(16)
   nameString DynamicLocalizedString, // its name is also a localized string in the dynamic string table
   langCode   String @db.VarChar(8)
   regionCode String @db.VarChar(8)
}

model StaticLocalizedString {
   // while you may not ever need to see publicId on the client, better to just
   // use publicId from the get go. small overhead to take care of something inevitable.
   publicId  String @unique @db.Char(16)
   stringKey String // sync static registry.
   localeId  Int
   locale       Locale @relation(...)

   // put BOTH here in order to provide an indexable string + a long (non-indexed) string.
   // this does NOT determine whether it's markdown / plaintext / other formats.
   indexedValue String? @db.VarChar(768)
   blobValue    String? @db.MediumText

   @@unique([stringKey, localeId])
}

model BandStaticLocalizedString {
   publicId  String @unique @db.Char(16)
   stringKey String // sync static registry.
   localeId  Int
   locale       Locale @relation(...)
   bandId    Int

   @@unique([stringKey, localeId, bandId])
}
```

Chrome string lookups will search both and use override app logic.

This has an impact on the string editor too: it should be usable globally, and
per-band.

Dynamic string keys (tags, localized per-band db content) will need separate table,
to catalog the strings and associate values with them.

## content storage

🟣Store all strings in a small number of database tables

-  avoids table explosion and creating multiple tables for every new table or column
-  if the editor is going to operate on all strings the same way, and the logic is going
   to be unified for all locales/strings/domains, then simpler to make a single db
   table than relations everywhere.
-  assumes that all domains have the same string behavior. "song tag" names won't somehow
   have a different model shape than "metronome page title".

This avoids creating "string domain providers" for every individual table; it all
comes from a single source.

**Existing string fields**

❌Tempting to keep existing string fields as a kind of visual aide for diagnostics or so,
but it places a burden. All those strings need to be migrated to their respective
localized string tables. They can also drift from the real text should it change
(because we won't create a frontend for changing it), and new items won't have it.

```prisma
// as-is:
model SongTag {
   name        String
   description String
}

// to-be:
model SongTag {
   nameId        Int
   // to fetch values, you need to traverse DynamicLocalizedString -> DynamicLocalizedStringValue
   name          DynamicLocalizedString @relation(...)
   descriptionId Int
   description   DynamicLocalizedString @relation(...)
}
```

We will conceptually fork `GenericStringField` with a new `LocalizedStringField`
which will handle a lot of the machinery:

-  SQL generation over relations
-  Querying
-  Hydration can invoke resolution logic.

## code API

**database models with localized names/descriptions**

db3 `xTable` fields can now be localized strings (`LocalizedStringField`),
which hydrate by invoking the logic to transform into a single `string`.

```ts
// or more realistically;
const args = Prisma.validator<EventStatus>()({
    select: {
        id: true,
        name: true, // same select syntax as before; previously fetched a string, now fetches an object.
        description: true,
    }
});

const contract = deriveViewContract(xEventStatus, args);

const view = defineView({..., hydrate: contract.hydrate});

const items = queryView(...view);
// items contains the name/description/etc localized resolved strings.

```

**raw string access**

```ts
// must be able to fetch a specific locale as well; the editor will need that, or unit tests.
const loc = useLocale({})

// gets the string, no params
// NB: synchronous!
// NB: this fetches by static string key, not dynamic strings.
const str = loc.getString("common.button.ok")
const str = loc.getString({ key: "common.button.ok", params: [x, y, z] }) // with params
const str = loc.getString("common.button.ok", [x, y, z]) // this might be worth supporting if the pattern is common.
const str = loc.getStringDetail("common.button.ok") // returns a detailed struct with inspection info.

// i am thinking to be explicit about how the string is used as well, so there's less
// risk of mismatching markdown & raw.
//
// type error if that string is not a markdown string in the registry.
const md = await loc.getMarkdown("common.generalConfirm.description")
// type error if that string is not a plain string.
const str = await loc.getMarkdown("common.generalConfirm.ok")
```

**react**

Plus some components:

```jsx
return <LocString id="common.button.ok" /> // type error if wrong format

return <LocMarkdown id="common.welcomeMessage" />

// ❌while tempting to support adhoc string definitions, such as:
return <LocMarkdown pattern="hello my name is {name}" params={{ name: "james" }} />
// it turns this component into a gateway to the registry, untyped, and overall
// faking something which weakens the design. Avoid; if a unit test needs it
// then use API not react components.
```

**`useLocale()`**

```tsx
getString(key)

// options like whether fallbacks are allowed or not,
// parameters for substitutions
getString(options)
getMarkdown(...)
getStringDetail()
getMarkdownDetail()

// return a list of locales relevant to the specified context.
// global = for admins, returns all languages the application supports
// band = uses the band context; bands support their own subset set of languages
getRelevantLocales(context: "global" | "band");

```

## efficient string resolution: CLIENT

The issue above is that every string fetch - which may be hundreds on a page -
is a server round trip, so that's just not going to work.

Would be great to deliver a resolved string batch for a single transfer, and
quick client-side lookups. Or better: send it along from `gSSP`. But it's not really
possible to know which strings are needed.

This is an optimization question; i anticipate site chrome will actually be small
so just:

-  keep the cached revision in session data
-  when necessary, deliver a resolved **complete** version

## editing UX for site chrome

Our existing <kbd>ALT+9</kbd> to enter an editing mode makes sense; it would be
specifically for editing site chrome. A single-string editor modal
dialog is necessary here. And a link to the main string editing surface, navigated
to the relevant string.

## editing UX for database-housed items like tags / attendance options / types

The UX for editing strings should feel consistent between chrome / db options / etc.
good for users, and good for not having to duplicate code / components.

should balance functionality with being bulky.

```
events.search.filter.reset <-- string key
[en]  [fr] ([nl])               <-- small chips representing relevant languages;
                                    populated are highlighted. selected is outlined.
<text or markdown editor here>
```

Considering "blank" is a valid value, there should be an on/off switch as well.

## string lookup priority / fallbacks

There are multiple dimensions of prioritization:

-  scope
   -  band
   -  global
-  locale requested
   -  language specified explicitly in URL
   -  user's `navigator` language
   -  system fallback language
   -  any language with a translation (last-resort)
-  lang-region match strength
   -  `fr-FR` may not be available. but if `fr-BE` is available, serve it
      rather than a fallback `en-US`

There may be different prio for different string namespaces. Site chrome may allow
falling back to global; band-specific entities probably should not.

Though, maybe that should be done in a structural way. For exmaple if a band overrides
`songTag.name`, should it fall back to a global translation?

-  if yes, then no special rule is needed.
-  if no, then it sounds like this `songTag` should just be owned by the band
   _and not have a global translation_; no special case needed.

Let's not do special rules per string. If a band overrides a translation, never fall back to global.
The band did that to change meaning; letting a global fallback through would be a
conflict.

Falling back to "available translation" is good. Whether band or locale
wins is probably debatable (show band-specific french to a dutch speaker, or show
the global dutch string?)

1. requested lang-region at band scope
2. requested lang at band scope
3. fallback locale (en-US) at band scope
4. any locale at band scope
5. requested lang-region at global scope (at this point the band has no overrides for this string)
6. requested lang at global scope
7. fallback locale (en-US) at global scope
8. any locale at global scope

One thing is very important: the logic must be centralized in a way that's testable,
readable, maintainable, and can be easily tweaked.

## localized catalog queries: agreed V1

**Agreed 2026-10-06:** a localized field participates in DB3 queries as if its
resolved text were its only string value. Use the established per-string
resolution rules, trusted band, full ordered language preferences, and enabled
locales. Search the value the user will see; other translations and global text
suppressed by a band override do not contribute matches. Blank text remains a
value, and missing text remains missing.

Quicksearch, autocomplete, field filters, ordering, counts, pagination, and
presentation must use that same resolved value. Preserve DB3's existing token
and filter behavior through shared field operations. Locale-aware ordering uses
`formattingLocale` with a stable public-ID tie-breaker; `formattingLocale` does
not replace per-string resolution. Existing nonlocalized string behavior remains
the reference for matching semantics.

These per-band catalogs are expected to be small. V1 therefore uses shared
**server-side in-memory** resolution, filtering, ordering, counting, and
pagination. Load authorized band rows and their field dependencies, resolve
them in a batch, then apply DB3 field operations before counting and slicing the
result. Database ownership and visibility constraints still apply. SQL/Prisma
optimization is deferred and must preserve the same field and query contracts.

This belongs in DB3 fields and shared execution, so other catalogs receive its
query, reference, form, and grid support through their declarations. Ordinary
validation and CRUD must reuse DB3; custom commands remain appropriate for
richer domain operations. The instrument/group slice needs design acceptance
and a second-catalog reuse check before broader rollout. See the
[phase-3 plan](04-implementation-plan.md#phase-3-db3-fields-xtables-and-views) and
[design acceptance criteria](07-db3-band-instruments.md#design-acceptance-criteria).

**Agreed follow-up:** coherent multi-read execution follows the resolved query
strategy, independently of band ownership. Transactional field preparation is a
`FieldBase` operation overridden by localized fields; shared server execution
supplies the transaction-bound persistence service. Field-specific validation
and transformations stay on the field.

Instruments, functional groups, and song tags use the dashboard's existing
reference store and arrive through `getDashboardData`. Derived display hydration
supplies effective values to shared chips/details and editor reference providers.
Only richer workflow data such as global opt-in choices needs a local request.
CRUD consumers refresh dashboard references explicitly; automatic invalidation
in `useDB3Command` is deferred for this working V1.

## string keys

**namespace-like structure**; think vs code settings

-  `common.actions.save`
-  `events.editor.intro`
-  `events.attendance.comment.dialog.title`
-  `multi.word.tokens.areCamelCase`

**object IDs will NOT be in keys**

Database entity strings have dynamic (synthesized if needed) keys if needed.

**interpolation** format:

[ICU MessageFormat through FormatJS/react-intl](https://formatjs.github.io/docs/intl-messageformat/)

-  ✅does this work in markdown? it doesn't need to. this is only for interpolation,
   which would be more for UI elements and messages in dialogs; markdown never contains
   substitutions.

❓❓❓ self-references. Like, `Are you sure you want to {common.actions.cancel}`?
because that requires another level of resolution. Need to look deeper into this
format.

**Static registry**

Static / site chrome strings are in a static typed registry.

```ts
const staticStrings = declareStaticStringRegistry({
   "common.actions.save": staticString("Save", "plaintext", Indexed),
   "common.actions.cancel": staticString("Cancel", "plaintext", Indexed),
   "events.editor.intro": staticString("xyz", "markdown", NonIndexed),
})
```

**custom/dynamic string keys**

Dynamic strings like
tags are dynamically "registered" in `DynamicTranslatedStrings` which acts like
a dynamic registry. DB entities reference in a normal relational way.

These records will likely mimic exactly those of the static registry.

Certainly there will need to be some kind of modular provider system no matter what,
to be able to present strings.

**Band strings like BandSongTag**

`BandSongTag` is an override of a global `SongTag`, or a custom band songtag. Bands
can effectively rename global stuff with their own localized text.

Their "registry entry" is _also_ in `DynamicLocalizedString`; there's no need for
a separate band identity registry because they take the same shape. Band translations
are stored separately in `BandDynamicLocalizedStringValue`.

# multi-tenancy design

-  ✅root pages -- likely we should avoid the mistake we made by embedding CM homepage in the app;
   our marketing landing page should likely not be the same application as the actual
   backstage. On the other hand, we want a login option directly on the front page...
-  ❓band mgmt pages
-  ✅database concepts
-  ❓decisions about scoping: band vs user vs global vs hybrid.
   -  ❓instrument sets
   -  ❓cross-band references? markdown is simple but what about song credits?
   -  ❓tags, statuses, attendance options
   -  ❓locales to support (not all bands want to expose ALL globally supported locales)
-  ✅routing scenarios to support:
   -  ✅single standalone tenant (configurable root or /backstage/)
   -  ✅multi-tenant (/b/bandid/page.tsx)
-  ✅merge users needs policies for cross-band users
   -  ✅ conceptually, it will be the same as existing but for each band between
      both users, plus any global things; i'd wait till db is complete before designing this
      as it's not a driving force but rather the other way around.

## permissions / roles

-  `User.globalRoleId` selects a nullable global role; `BandUser.bandRoleId`
   selects a nullable membership role. Only the designated sysadmin role becomes
   global in the data migration; all other existing roles become band roles.
-  Permissions remain in one static registry. `GlobalRolePermission` and
   `BandRolePermission` retain the existing grants for their migrated roles.
-  Both role definitions and permission matrices are platform-owned in V1.
   `BandRole` has no `bandId`; a band assigns an existing role to a membership
   rather than defining its own permission matrix.
-  Phase 1 of [04-implementation-plan.md](04-implementation-plan.md) separates
   platform and active-band authorization, including public/pending behavior and
   shared-account versus membership management. New capabilities and approved
   grants belong in a follow-up migration, not the completed data migration.

## entity scoping (tags / instrument sets...)

Catalog of exsiting models. 🔵 = receives bandid; 🔴 = needs larger rework

Concepts/rationale:

-  feature behaviors are owned by the platform.
-  Band-configurables are for band-specific vocabulary building and cataloging, generally not for behavior-driving.
-  Let the platform be opinionated

-  Auth/session
   -  🟡`Role` - initially we will have indeed global vs. band roles, but not per-band mappings.
   -  🟡`Permission`
   -  🟡`RolePermission`
   -  `User`
   -  `Session`
   -  `Token`
   -  `UserSignInMethod`
   -  `AdminBootstrapClaim`
-  Analytics/diagnostics
   -  🔵`Action` = receives a bandID; feature reports are global so will be able
      to inspect usage by band
   -  `Change` = retain audit and change history; define band scope with multitenancy.
-  UserTag
   -  🔴`UserTag` - bands to get own sets (needed for invitations - board /
      majorette / diri...)
   -  `UserTagAssignment`
-  Settings
   -  `UserSetting`
   -  🟡`Setting` -> `GlobalSetting` and `BandSetting`, according to the key registry
   -  ✨`BandUserSetting` - membership preferences such as calendar locale
-  Songs
   -  🔵`Song`
   -  🟡`SongCreditType` - ideal: band gets own set. But it's overkill unless
      requested; V1=keep global.
   -  `SongCredit`
   -  🔴`SongTag` - bands to get own sets. Needed for things like majorettes / song
      list annotations.
   -  `SongTagAssociation`
-  Instruments
   -  🔴`Instrument` - bands to get own sets
   -  🔴`InstrumentFunctionalGroup` - bands to get own sets
   -  ❌ `InstrumentTag` - largely unused feature anyway; consider decommissioning
   -  ❌ `InstrumentTagAssociation`
   -  🔵`UserInstrument` - users have different instrument sets per band
-  Event
   -  🔵`Event`
   -  `EventSegment`
   -  🟡`EventType` - platform sets. why? because event type drives behaviors;
      band vocab is expressed through tags.
      for example "CM weekend" doesn't need to be an event type -- it should be
      "residency" or so with its special
      formatting, and let the event TAG specify CM Weekend.
   -  🟡`EventStatus` - not necessary. if bands already get own tags & types,
      status is not necessary because status drives app features.
   -  🔴`EventTag` - bands to get own sets
   -  `EventTagAssignment`
   -  `EventSongList`
   -  `EventSongListSong`
   -  `EventSongListDivider`
   -  🟡`EventAttendance` - bands to get own sets; platform opinion: yes & no only.
   -  `EventUserResponse`
   -  `EventSegmentUserResponse`
-  Files
   -  🔴`FileTag` - bands to get own sets
   -  `FileTagAssignment`
   -  🔵`File`
   -  `FileUserTag`
   -  `FileSongTag`
   -  `FileEventTag`
   -  `FileInstrumentTag`
   -  `FileWikiPageTag`
-  Café Marché specific
   -  `FrontpageGalleryItem`
-  Backstage Configuration
   -  🔵`CustomLink`
   -  `CustomLinkVisit`
   -  🔵`MenuLink`
-  Wiki
   -  🔵`WikiPage`
   -  `WikiPageRevision`
   -  🔴`WikiPageTag` - bands to get own sets
   -  `WikiPageTagAssignment`
-  Setlist planning
   -  🔵`SetlistPlanGroup`
   -  🔵`SetlistPlan`

In order to put into perspective what these options mean.

-  🔵 is simple Band-owned content. songs, events. no platform given options, no cross-band mixing.
-  🔴 are pre-configured or otherwise band-configurable but with some kind of global understanding.
   -  a band getting its own set of instruments
   -  a band getting its own set of attendance options
   -  a band getting its own set of wiki page tags

Band-owned is unambiguous.

❌But pre-configured choices is not certain and i need to consider the UX for configuring,
seeting, defaults, what server-wide behaviors are important. For example, file tags
have things like `recordings` or `partitions` which are used by respective tabs.
If we allow a band to have their own tags, they need to make sure they continue to
have these 2 special globally-understood ones that drive behavior.

❌One option is to retire the "tag significance" in order to allow tags to be truly
visual markers or search filters, and not drive fundamental behavior. But i don't like
having to add that extra effort, which comes with its own concerns (how would you
then designate partition vs. recording? it means a 2nd tag-like system?)

❌Another thing is: V1 versus long-term. It's good to consider the possibilities,
and leave space for growth, but not commit to the ideal design right off the bat.
So for example, role-perm matrices may not need to be band-configurable initially.

Scenarios to think about:

### 🟡 `Role`

-  global permission table (because that's what code sees)
-  global role table (with no band assignment; users have 1 global role)
-  band role table

seeding: when provisioning a band, that band's default roles get created.

that creates a literal copy of roles and the matrix.
**it means when permissions change, or roles / perms are added, bands will be stale.**

We could already start accounting for that with a revision or "has been overridden"
flag, but we're getting into hierarchical role defs which ... either do it right or
don't do it at all.

🟣➡️ V1 we have platform-owned role definitions. No per-band roles or matrices.
Users have per-band roles, and a single global role. But that role set is fixed,
and the permissions therein.

### 🔴 `UserTag`, 🔴 `SongTag`, 🔴 `EventTag`, 🔴 `FileTag`, 🔴 `WikiPageTag`

There are different ways to conceptualize global-catalog vs. band-catalog
for tags / instruments etc. Basically, "which tags do we show in the selector".

-  global catalog: opt-in? opt-out? show all?
-  band catalog: items among global catalog, or keep separate

❌One simple way is to consider global & band catalogs separately. No inheritance,
and existing design is basically untouched.

-  model `GlobalUserTag` (id, name...) -- replaces existing `UserTag`
-  model `BandUserTag` (id, bandId, name...) -- tags shown _in addition_ to the global catalog
-  model `BandUserTagAssignment` (id, bandUserTagId)
-  model `BandGlobalUserTagAssignment` (id, bandId, globalUserTagId) -- replaces existing `UserTagAssignment`

This has issues:

-  bands can't order things in a sensible way
-  lock ourselves into a design regarding optin/optout/customizations/overrides.

🟣We need to carefully select our global tag set as well.

The other model is one where the band's tag catalog relates to the global catalog,
with a kind of inheritance behavior. Sounds complicated but it's pretty simple.

i mean there's going to be some small central function that converts 2 lists
into 1. whether that applies overrides or not is not really an architectural breakpoint.

🟣 i'm leaning towards

-  model `GlobalUserTag` (id, name...) -- replaces existing `UserTag`
-  model `BandUserTag` (id, bandId, nullable globalUserTagId, ...) -- overrides,
   including flags like `hidden` (opt-out), style overrides, or if `globalUserTagId` is
   null, then totally custom.
-  model `BandUserTagAssignment` (id, bandId, bandUserId, bandUserTagId) -- replaces existing `UserTagAssignment`

The tags available to a band are the union of the global catalog and the `banduserTag`
catalog, where related ones get inheritance.

And maybe most importantly: only need 1 association table. When a band user gets
assigned a tag, that tag is brought into `BandUserTag` with no overrides.

This design works, keeps room for future behaviors without migration nightmares,
and uses a mechanism that will work for all tags-like fields.

It can also work for instruments & instrument groups, importantly.

### Tags & localization scenario

❌Finally, together with localization - the one where we use related tables - we get:

-  model `GlobalUserTag` (id, color, sortOrder)
-  model `BandUserTag` (id, bandId, nullable globalUserTagId, ...)
-  model `BandGlobalUserTagAssignment` (id, bandId, globalUserTagId)
-  model `GlobalUserTagName` (id, value, locale)
-  model `GlobalUserTagDescription` (id, value, locale)
-  model `BandUserTagName` (id, value, locale)
-  model `BandUserTagDescription` (id, value, locale)

❌That uses separate name & description tables, so the code is sensible and doesn't need to be
customized for every entity. And resolves issues where name has a translation but
description doesn't.

❌That's pretty disgusting really - a table for every string column. Could be reduced
by adding complexity.

🟣But could be eliminated if we use a single string source. like

```prisma
model SongTag {
   id       Int    @id @default(autoincrement())
   publicId String @unique @db.Char(16)

   nameStringId Int
   nameString   DynamicLocalizedString @relation(fields: [nameStringId], references: [id], onDelete: Restrict)

   descriptionStringId Int
   descriptionString   DynamicLocalizedString @relation(fields: [descriptionStringId], references: [id], onDelete: Restrict)

   ...
}

// for database-housed strings (not in a fixed keyed registry like site chrome)
// strings need their own id. this should mirror the string registry layout.
model DynamicLocalizedString {
   id, key, defaultValue, format, descriptionMarkdown
}

model DynamicLocalizedStringValue {
   id                    Int
   stringId              Int // fk
   stringKey             String
   localeId              Int
   value                 String    @db.MediumText // or  varchar(768)?
   songTagsByName        SongTag[]
   songTagsByDescription SongTag[]
}
```

### 🔴 `Instrument` & 🔴 `InstrumentFunctionalGroup` - bands to get own sets

_groups_ are a bit tricky because it's a detail and groups will be confused
having to configure that up-front. When setting up a band make it clear that you
can select an instrument set, and can change later if you need.

Bands absolutely need to be able to specify their own, so similar to tags: global
catalog, band catalog.

The biggest difference here is that the tags entities see the whole global catalog,
whereas with instruments, the band opts into the set. There will be a lot more
instruments and relevant instrument visibility is important for the attentance checking
tabs.

I would be careful with `InstrumentFunctionalGroup` customization; it's pretty unclear
how it is meant to be used and therefore we should probably keep tighter control.
The whole `InstrumentFunctionalGroup` system is probably not really needed by most
bands.

So, we should find a way for bands to basically ignore it if they want.

Proposal: Allow `null` instrument functional group, the frontend synthesizes one
that effectively places each custom instrument in its own group. That matches typical
usage. But it can't be customized then and specifying that is weird. Seems unnecessary.

Bands likely want to specify ordering as well as instrument/group sets. And
supporting instrument groups that are essential / non-essential.

This suggests supporting band-specific functional groups but just don't expose it
much.

Proposal: same as other entities: band can create own. New instruments quietly
create its own functional group.

🟣 instrument mgmt page needed with above UX.

So as-is:

-  model `InstrumentFunctionalGroup`
-  model `Instrument`
-  model `UserInstrument`

to-be:

-  model `GlobalInstrumentFunctionalGroup`
-  model `BandInstrumentFunctionalGroup`
-  model `GlobalInstrument`
-  model `BandInstrument` - overrides global instrument; relates to BAND fn group
-  model `BandUserInstrument`

And again: `BandInstrument` can be custom or override. Including the functional group.
But that column can't just be `nullable globalInstrumentFunctionalGroupId`, it
needs to point to `BandInstrumentFunctionalGroup`.

So similar to a user being assigned a tag creates a `BandUserTag` record, creating
a new `BandUserInstrument` can cascade: `BandInstrument` is created, and it must
relate to `BandInstrumentFunctionalGroup`, so these records will get created
with no overrides.

🟣 for unit testing, these logics should be functional and testable with abstract
inputs and outputs so unit tests don't need actual db ops.

## ensembles

when provisioning a band, we'll need a wizard to pick the ensemble type. probably
copy these from dorico/finale

not needed for establish v1 though.

# merge users function

The ability to merge users needs to continue, but can remain server-wide and
a sysadmin-only action. The use case remains important: users accidentally
create multiple accounts.

But a merge action must be platform-wide. Which is fine because the use case
is likely platform-wide (users did not clearly remember their credentials for
band A, but then accidentally created an account for band B).

Scenario is also likely that users create multiple accounts, for each band.
In all cases, likely scenarios in a multi-band installation involve cross-band
account-wide merging.

In order to do this per-band, it would be a matter of duplicating the multiple
signin method mechanism but for band membership. Which is complex and totally
unneeded.

## routing

we need to basically be able to dynamically rewrite/route everthing
currently under backstage, to band-specific contexts

should aim to support the rewriting system and in single-tenant mode, there's literally
just 1 band in the db, and there will likely be some logic to hide multi-teant features
like "my bands" page or "switch to band...", create band...

-  `http://cafemarche.be/backstage` -- this would just be the app rooted at /backstage. not rooted at root with some configured root url.

No locale provided is supported; route rewriting makes this trivial; `useLocale`
will do the resolution automatically.

-  `http://backstage.slashkick.be/`
-  `http://backstage.slashkick.be/nl-BE`
-  `http://backstage.slashkick.be/nl-BE/event/s2pYvV00rwg101bN/ceremony-at-the-pavilion-limited-tickets/info`
-  `http://platform.be/nl-BE/pricing`
-  `http://platform.be/nl-BE/b/iF6l5a5gSDsfzClY`
-  `http://platform.be/nl-BE/b/iF6l5a5gSDsfzClY/event/s2pYvV00rwg101bN/ceremony-at-the-pavilion-limited-tickets/info`

Middleware can handle delegating/rewriting to a different internal route,
modify headers etc. So the middleware can pass the requested
bandid / locale to the internally selected route.

Middleware cannot run database queries. So if decisions about "default locale" are
needed, it needs to be configured in `.env` or so. This is probably why Next's `i18n`
configuration is in `next.config.js`. As I prefer to configure these things in
the database, i will **remove Next `i18n` config**, and do all routing myself.

And as default locale decisions would require database queries, it becomes actually
simpler to directly support no-locale-provided URLs which is actually handy for
sharing links. Therefore

`http://platform.be/b/iF6l5a5gSDsfzClY`

is a directly-supported URL, not redirected to a chosen locale. Basically it makes
locale decisions (translations, formatting) based on the user's navigator preference.
So it's actually preferred.

Sharing URLs should probably use this page.

We should likely migrate existing Next `router` usage to a home-built wrapper with
methods expressing these policies.

🟣 `useCmdbRouter()` to wrap `useRouter()`

## band mgmt features

Once the above is actually mechanically in place, features to build out actual
management over them...

-  create band
-  my bands / your global profile
-  band switcher
-  band mgmt overview (decommission, branding...)
-  ❓ (to be seen)
-  site chrome / band settings / band locales / band localization editor

## global mgmt features

-  ❓server admin stuff.
-  to be seen how `backstageRoutes` maps to band-owned vs. global.

## public global features

Pages like pricing etc should likely be in CMDB, even though it feels like we're recreating
the earlier mistake of placing the Café Marché homepage in the app. But here, the
landing page is really part of the app functionality, including login/signup,
direct quick access to your profile/etc.

-  signup / login
-  tour/features
-  pricing
-  your portal / your user settings...
-  legal / privacy / contact / about

## Sign-up process

-  actual signup would be largely the same as now.
-  but you would not be a member of any band. you would need to be invited or create a band.

**joining a band**

-  creating a band
-  invitations
-  requesting? that's how CMDB works but the platform probably shouldn't work like that.

## Custom URLs

custom URLs are useful for centralizing band's resources. but a big band ID gibberish
sorta clobbers the purpose.

-  What you want is `https://myband.be/welcome`
-  but will actually get `https://myband.be/b/iF6l5a5gSDsfzClY/welcome`

which is actually just not useful to the band. it's possible that we can just
only offer this for single-tenant configurations.

the other would be to use slugs to identify band names but i don't like it that
much. people will want to change it which is troublesome, and also it causes issues
with collisions. and band names are not unique.

this app is not meant as a replacement for your band's central resources/communication/
etc. Menu links remain useful, but custom links maybe stay as-is, and for the moment
are just a bit less useful than before.

One thing is certain: band-owned custom links would be rooted at the band's root.

🟣 Conclusion: leave mostly as-is. Custom URLs will be band-owned, and rooted at
the band's portal root.

🟣 Conclusion: there will be no locale routing logic for custom URLs. they will resolve
but no logic taking action over the specified locale.

# Differences between site hosting modes

-  routing differences: elide the `/b/<bandid>` altogether
-  any time we display your list of bands, or specify which band, elision.
-  sign-up / login process probably takes you directly to the band homepage
-  ❓...much will be discovered along the way

# Settings

While i'm here let's plan the settings system. Likely this is going to be
delivered similar to localized strings. Need to consider authorization, where
config lives, hierarchy, etc.

```jsx

// the registries themselves also have registry-level auth maps.
const serverSettingsRegistry = defineSettingsRegistry({
    // where String can be an object providing zod schema, validation, serialization/etc.
    // this uses default auth which is restricted.
    "intl.defaultLocale" = defineSetting(String, "en-US"),
    // use authmaps similar to xTable to define per-setting auth for read/write
    "routing.hostingMode" = defineSetting(String, "en-US", settingAuthMapSysadmins),
});

const Component = () =>
{
   const settings = useSettings() // readonly properties over the static registry.

   // settings.meta.band.someString.datatype / etc

   // settings.global.hostingMode

   return <div>{settings.band.someString}</div>
}
```

### Datatypes

-  i guess we should just support JSON-serializable scalar values?
   -  string
   -  number
   -  Date
   -  i would not support

### Example hierarchy

-  Server settings
   -  hosting mode (though this must be in `.env`)
   -  how some controls are presented (inline vs. dialog etc)
-  Band Settings
   -  branding decisions like cal event prefix, titles, colors
   -  timezone
-  User settings
   -  ❓ even though i don't have any now, i could imagine this will be a thing
      with multi-tenancy. Add only when fonud necessary; 3 registries are enough.
-  User-band settings
   -  calendar subscription options

So far none of these show a hierarchical relation, and that's for the best. Users
want to be able to see settings in a list, not in multiple dimensions.

Contain and centralize logic such that this is not an issue to add later.

Band settings may get fallbacks/defaults, but not hierarchical in the "on/off/inherit"
sense.

### Authorization

Gate per setting; effectively a `visiblePermissionId` on every setting.

```prisma
model ServerSetting {
   key   String @id
   value String // json-serialize all values here
}

model BandUserSetting {
   key   String
   bandUserId ...
   value String // json-serialize all values here

   @@id([key, bandUserId])
}

model BandSetting {
   key   String
   bandId ...
   value String // json-serialize all values here

   @@id([key, bandId])
}
```

# TECH DEBT accumulating

-  base: full feature restoration
   -  localization
   -  band awareness and platform vs. band mgmt
   -  supporting routing
-  xTable should stop being used like a view
   -  only 1 xtable per db entity
-  find a way to auto-hydrate localized strings. the view would need a way to specify this.
