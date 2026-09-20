# improvements to db3

github issues:

-  [#519 use publicId on clientside instead of raw db id](https://github.com/thenfour/CafeMarcheDB/issues/519)
-  [#697 introduce entity/view/hydrate for better design, automation, typesafety](https://github.com/thenfour/CafeMarcheDB/issues/697)
-  [#698 xTable to strengthen typesafety](https://github.com/thenfour/CafeMarcheDB/issues/698)

## motivators / impetus:

-  a new policy to make clientside information more opaque to database internals
   means using uuid-ish `publicId` for client-facing entity identification, rather
   than raw numeric monotonic `id`.
-  that introduces a lot of changes to db3 core code, and pressures the design around
   hydration at the client-side (for example converting between id and publicId,
   across association tables -- there's always a translation step)
-  at the same time we have messy legacy `enrich*` functions (e.g. `enrichSong`),
   which represent adhoc spotty dto-to-rich-client-object transformations.
-  therefore, we want to centralize this dto-to-client transformation as a core
   feature of db3
-  as part of that introduction, we will split awkward `xTable` objects into
   -  entity schemas (via `defineEntity()`) which for the moment basically just
      attach to `xTable`, and serve as table-wide metadata/policy holders
      (view-agnostic!) and the collection of columns with their column-level metadata.
   -  views, which eliminate the need for duplicated `xTable` for different payload
      shapes. Views can decide which shape gets queried, and how it gets hydrated
      to client-facing code.
   -  hydration is a view responsibility and can return arbitrary objects for client
      use; good examples of the direction are:
      -  `EventSongListContent` which is a class object passed to callers
      -  `hydrateEventDateRange` which hides sparse columns into a structured
         semantic object

## roadmap (living document)

-  complete design around setlists
   -  draft/edit model system: the relation between
      -  hydrated objects,
      -  editable drafts (including new items),
      -  mutation command payload
   -  transactional write
-  entity/view/hydration work
-  `publicId` migration for all client-facing entities
   -  [x] `instrumentFunctionalGroup`
   -  [ ] ... todo: catalog

# Design decisions / intentions / policies / principles

...
