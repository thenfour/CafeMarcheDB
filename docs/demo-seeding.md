# Reset and launch the demo

The demo is a repeatable manual-testing database on the localization/multiband
schema. Production seeding remains access-control initialization only.

From the repository root:

```sh
yarn demo:reset
yarn demo:dev
```

Open `http://localhost:10455/backstage`. For the built application, use
`yarn demo:build` followed by `yarn demo:start` instead of `yarn demo:dev`.
Stop the running demo before resetting its database.
Demo commands use `.next-demo` so an existing normal development server does not
overwrite the built demo. Set `DEMO_PORT` to choose a different port when needed.

The commands use the local connection in `DATABASE_URL`, replacing its database
name with `cmdb_demo`. They do not modify environment files. To choose another
local server/database, set `DEMO_DATABASE_URL` in your shell or `.env.local`:

```powershell
$env:DEMO_DATABASE_URL = 'mysql://USER:PASSWORD@127.0.0.1:3306/cmdb_demo_manual'
$env:DEMO_PORT = '10457'
yarn demo:reset
yarn demo:dev
```

Both reset and launch use the same target. Only local MySQL connections and names
`cmdb_demo` or `cmdb_demo_<suffix>` are accepted. The target must differ from the
application's `DATABASE_URL`. Reset replays the checked-in Prisma migrations,
initializes permissions/roles/locales, and replaces the empty historical band
scaffold with the requested demo bands. Sample assets live under
`temp/demo-assets/<database-name>`; launch sets `FILE_UPLOAD_PATH` accordingly.
Existing application data and uploads are not used by the demo.

## Generator options

```sh
yarn demo:reset --bands 3 --members-per-band 12 --songs-per-band 20 --events-per-band 10 --seed 42 --date 2026-10-08 --locales en-US,fr-BE,nl-BE
yarn demo:reset --help
```

Options also accept `--name=value`. Invalid/unknown/duplicate options are rejected
before database creation or reset.

| Option | Default | Range/meaning |
| --- | --- | --- |
| `--bands` | `2` | 1–10 bands |
| `--members-per-band` | `8` | 3–50, including each band's manager and the shared person |
| `--songs-per-band` | `6` | 0–100 songs |
| `--events-per-band` | `5` | 0–30 events |
| `--locales` | `en-US,fr-BE,nl-BE` | Distinct supported tags; English is required |
| `--seed` | `104` | 0–2147483647; stable public identities, tempos, instruments and attendance choices |
| `--date` | Today in UTC | Real `YYYY-MM-DD`; first event seven days before, subsequent events weekly after |

With the same options and reference date, reset recreates the same authored
content, relationships and public identities. Password hashes, access-control
foundation identities and bookkeeping timestamps are freshly generated.
Reset removes manual database edits. Launch does not reseed.

## Accounts and content

All demo accounts use password **`Demo1234!`**. Email addresses are sample sign-in
identifiers; no external identity provider or email delivery is needed.

| Account | Purpose |
| --- | --- |
| `admin@demo.invalid` | Platform administrator; no implicit band membership |
| `shared@demo.invalid` | Alex Shared: Band Admin in River Fanfare, Normal Users in other bands |
| `manager1@demo.invalid` | River Fanfare manager; belongs only to band 1 |
| `manager2@demo.invalid` | Harbour Brass manager; belongs only to band 2 |
| `member1-1@demo.invalid` | Ordinary River Fanfare member; belongs only to band 1 |
| `member2-1@demo.invalid` | Ordinary Harbour Brass member; belongs only to band 2 |

Additional bands use `manager<N>@demo.invalid`; other members use
`member<BAND>-<NUMBER>@demo.invalid`. With more than three members, the final
member in each band has Limited Users access. The platform administrator is an
extra person; member counts refer to memberships, including Alex in every band.

River Fanfare and Harbour Brass have different titles/colors and separate
members, instruments, tags, wiki pages, menus, songs, files and events. Odd-numbered
bands enable all requested locales. Even-numbered bands omit French, demonstrating
locale availability and fallback. Shared instruments/tags and event/attendance
catalogs contain English, French and Dutch labels where requested.

River's French trumpet label overrides the shared value with **Cornet de la
fanfare**. Its French trumpet description is explicitly blank. Drums intentionally
has no Dutch name, demonstrating per-string fallback. Band catalog rows inherit
shared metadata; each band also has a hidden, local song tag.

Each band has a local SVG score and a playable two-second WAV sample, File tag,
instrument/member associations, and same-slug `score`/`recording` Custom Links.
When songs are present, the first song owns these associations and pins the
recording. Song credits retain shared-person authorship.

Events have UTC spans, segments, setlists, invited/not-invited memberships,
yes/maybe/no/unanswered attendance, and activity records. The fourth event is
cancelled when present. Each event owns a separate canonical
`EventDescription/<event-public-id>` wiki page. Welcome pages stay independent.
Wiki revisions use authored multilingual text and have
band-local tags; separate `welcome`, `bienvenue` and `welkom` pages exist for the
enabled languages. Wiki bodies and song/event names retain their existing
multilingual text contract rather than acquiring an invented translation model.

## Manual walkthrough

1. Sign in as `shared@demo.invalid`. Initially the selector is **Account and
   platform**; select River Fanfare explicitly. The home page displays its name,
   welcome content and links to supported demo surfaces.
2. Open your profile and the instrument catalog. Add `routeLocale=fr-BE` to the
   URL while retaining `bandPublicId`. Check the French shell labels and trumpet
   override. Use `routeLocale=nl-BE` to see Dutch labels and the Drums fallback.
3. Switch to Harbour Brass. The title, branding and membership change; French
   is unavailable here. Alex's band role is ordinary rather than administrative.
4. As Alex, inspect Harbour's wiki at `/backstage/wiki/welcome` with that band's
   query parameters. Current content is available under ordinary page-read
   permission; revision history retains its separate grant. A manager can also
   edit the page. `/score?bandPublicId=<id>` and `/recording?bandPublicId=<id>`
   serve local sample files. Direct `/api/files/download/<stored-leaf>` URLs
   also require that explicit band context.
5. Sign in as `member1-1@demo.invalid`. Only River appears in the selector;
   manually supplying Harbour's band ID must not reveal its member content.
6. As Alex, use the member directory's name search and open your profile. Edit
   your shared name/phone, then switch bands: the shared values follow you.
   Change instruments/default instrument in River and check that Harbour's
   assignments stay unchanged. River's French options include its trumpet override.
7. As `manager1@demo.invalid`, open another River member's profile. Change their
   instruments/tags or band role. Their shared name/phone editor is unavailable
   because band management does not grant shared-account maintenance. Clearing
   the role applies new-member defaults; the person retains access to their own
   profile while other-member reads require the appropriate grant.
8. Deactivate an ordinary River membership. Recovery requires `recover_users`
   separately; the default band manager lacks it. Use `admin@demo.invalid` to
   recover the membership at `/backstage/recoverMembers` with River selected.
   The shared account, retained assignments and other memberships stay intact.
9. Open Events with River selected. Check the Relevant/All/Past concerts presets,
   type/status/tag/date facets, text search, URL reload, sorting and export. Use
   `--events-per-band=30` at reset to exercise load-more. Switch to French for
   localized labels, then Harbour for separate event results. Event detail and
   editing remain deferred.
10. Clear band selection and check that member/event data disappears. Stop the site,
   repeat reset with the same options/date, and launch again to restore the fixture.

Seeded rows do not establish restoration of their pages. Event search is active;
event detail/creation/editing, general song/file screens, uploads, custom sidebar
delivery, publication and wiki search retain their migration restrictions. The
supported profile/catalog/wiki/settings and Custom Link paths remain available.
Alex reads Harbour's current welcome content without gaining revision-history
permission. The same fixtures support subsequent workflow restoration.

## Verification

```sh
yarn test tests/demoConfig.test.ts --reporter=dot
```

Native generator tests require an explicitly disposable local database name
`cmdb_demo_test_<hex>` and reset it several times:

```powershell
$env:DEMO_TEST_DATABASE_URL = 'mysql://USER:PASSWORD@127.0.0.1:3306/cmdb_demo_test_a104'
yarn test tests/demoSeeding.mysql.test.ts --reporter=dot
```

They verify actual login hashes/aliases, band grants, locale boundaries, relation
ownership, asset bytes, repeat resets and custom/zero-content options. These tests
are skipped when that environment variable is absent.
