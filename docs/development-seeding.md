# Development database seeding

Reset the normal development database, then launch the application with VS Code
F5 or `yarn dev`:

```sh
yarn blitz prisma migrate reset
```

Prisma runs `scripts/seed.cjs` automatically after replaying migrations. The seed
uses the normal `DATABASE_URL` and `FILE_UPLOAD_PATH`, loading the same development
environment files as the application. The reset removes database edits; seeding
does not clear the upload directory. Generated files have unique `seed-` names.
Production mode initializes access-control foundations only.

## Sizes and content

Edit the small configuration in `db/seeding/config.ts` to change the development
dataset. Defaults restore the old sizes and event window:

| Setting | Default | Meaning |
| --- | --- | --- |
| Bands | 2 | Café Marché and Harbour Brass |
| Users | 80 | Total people, including the named and demo accounts |
| Songs | 100 | Distributed across bands |
| Wiki pages | 30 | Distributed across bands, plus welcome and event-description pages |
| Months before now | 40 | Event history |
| Months after now | 6 | Upcoming events |

Each band has approximately five random events per month and weekly Thursday
rehearsals at 20:00 in Europe/Brussels. Dates use one captured reference time per
run. All-day spans and aggregate event bounds use the application's current date
helpers, including cancelled-segment handling. Random events retain zero to four
segments, TBD dates, mixed timing, variable attendance, zero to two setlists,
song repetitions, dividers and optional descriptions/files.

Account creation and band join dates vary across the history window; membership
dates follow account creation. Directory Join Date sorting and the "Joined this
band" footer both use membership creation. Events are created before their
scheduled start, wiki revisions follow page creation, and file creation precedes
upload. Bands predate their memberships, sign-in methods follow account creation,
and attendance records follow membership and event creation. These dates use the
captured reference time rather than insertion time.

Fixed catalogs restore 23 instruments and functional groups, seven song tags,
three file tags, two event tags, five statuses, four event types, four attendance
options, three credit types, three member tags and six wiki tags. Platform rows
are created once. Each band references them through its own catalogs, retaining
null properties for inheritance. Bands also have local instruments/song tags
and selected property/string overrides. Removed song-tag significance is
represented by the current tag metadata rather than an obsolete column.

Shared localized strings include English and selected French/Dutch translations.
Untranslated strings fall back through the application's locale rules. Café
Marché overrides the shared French trumpet name with “Cornet de la fanfare” and
its description with an intentional blank. Harbour omits French from its enabled
locales and inherits shared catalog labels. Song/event names and wiki bodies keep
their existing multilingual text contract.

Songs retain random names, descriptions, aliases, optional tempos/year/duration,
tags, credits and files. Wiki pages have namespaces, tags and chronological
revision histories with the latest revision marked current. Activity keeps the
old concentrated-user layers, variable client metadata and recent history, with
references confined to the action's band.

Files contain actual SVG, WAV, PDF or text bytes. Metadata, deletion state, tags,
member/instrument associations and song/event associations vary. External-link
examples point back to their hosted download route with explicit band context.
Each band also has active `score` and `recording` Custom Links, and the first song
has a pinned sample recording.

## Accounts

All seeded accounts support password sign-in with **`Demo1234!`**.

| Email | Access |
| --- | --- |
| `admin@demo.invalid` | Platform administrator |
| `shared@demo.invalid` | Alex Shared; Band Admin in Café Marché, ordinary role in other bands |
| `manager1@demo.invalid` | First-band manager |
| `manager2@demo.invalid` | Second-band manager |
| `member1-1@demo.invalid` | Ordinary first-band member |
| `member2-1@demo.invalid` | Ordinary second-band member |

The original Carl (`carlco@gmail.com`), Peter (`peter@gmail.com`) and Guido
(`guido@gmail.com`) accounts retain development Google bootstrap aliases and
platform administration. They also support the sample password and belong to all
seeded bands. Other members have random names and band-specific roles,
instruments and tags, with additional email aliases on some accounts.

After signing in, select a band explicitly. Open `score` or `recording` with
`bandPublicId=<selected-band-public-id>` to load its sample assets. The existing
isolated [demo commands](demo-seeding.md) remain a separate small fixture workflow.

## Verification

The native test resets an explicitly disposable local database before seeding a
smaller dataset. Set `DEVELOPMENT_SEED_TEST_DATABASE_URL` to a local MySQL
connection whose database is named `cmdb_seed_test_<hex>`, then run:

```sh
yarn test tests/developmentSeeding.mysql.test.ts --reporter=dot
```

It checks catalog inheritance, localized overrides, login hashes/aliases,
band ownership, event bounds, file bytes, wiki revisions, activity references
and rejection of accidental reseeding. It skips when the variable is absent.
