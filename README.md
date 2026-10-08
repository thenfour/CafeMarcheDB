# CMDB

Management dashboard designed for bands, with a lot of extras.

https://github.com/thenfour/CafeMarcheDB

See [Releases and deployment](docs/deployment.md) for manual GitHub Actions releases and instance upgrades.

For a repeatable local database with multilingual, multiband content, see
[Reset and launch the demo](docs/demo-seeding.md): `yarn demo:reset`, then `yarn demo:dev`.

Q: Why use `yarn demo:dev` and not just `yarn dev` ? `demo:dev` wraps dev server with a few things that provide continuity with `demo:reset`:

| | `yarn dev` | `yarn demo:dev` |
|---|---|---|
| Database | Normal `DATABASE_URL` | `DEMO_DATABASE_URL`, or `cmdb_demo` on the same server |
| Uploaded files | Configured upload directory | `temp/demo-assets/<database-name>` |
| Build cache | `.next` | `.next-demo` |
| Port | `10455` | `DEMO_PORT`, defaulting to `10455` |

## Main features

* Wiki documentation system
  * Namespaces for organization
  * Revision tracking and version diffing
  * Exclusive locking
  * Markdown editing integrating site objects (links to other wiki pages, events)
* Ical
* Song database
* User management
* Instrument management
* File management
* Event management
  * Multi-segments
  * Attendance breakdowns
* Setlist creation and management tools
* Rehearsal planning tools
* Media player
* Frontpage support
  * Gallery editing with image editing support
  * Agenda customization
* Analytics

## Notes

* Built on blitz.js
