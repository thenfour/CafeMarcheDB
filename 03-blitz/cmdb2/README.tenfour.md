<pre>


based on the blitz tutorial; created using the CLI
npm install <google passport stuff>
blitz install material-ui
.env.local file edited

</pre>

# tech & rationale

  * blitz-js: because it seems to provide the full-stack dev in a single place (raw react/express won't without hacking like 7jam), conventional, targets specifically things like dashboards (otoh Next.js loves to demonstrate simple blogs). So if i go with learning next.js, i would be learning the mechanics of next which blitz lets me ignore, while having to reinvent many of the wheels that blitz provides.
    * in particular, the blitz RPC, auth, and db are all pretty much invaluable here.
  * do NOT use react-admin; it has too many limitations and you end up customizing everything. it's literally easier to just build your own based off MUI
  * material-ui because it's conventional and the datagrid has everything i need
  * google-oauth via passport
  * prisma ORM - default
  * tailwind css + emotion engine because it's the default, though i don't really use its features
  * using markdown editing, and the simplest flexible light engine is markdown-it. NOT using wysiwyg, because
    * almost all are riddled with weird behaviors, bugs, dubious support lifetimes or paywalls
    * the ones which feel comfortable enough to use are so complex i don't want to put the effort

# permissions vs. roles

by default Blitz wants to just assign string-based roles to users, and pages specify which role(s) are allowed to access.
that's a bit rigid for my tastes and i think exact permissions will need to evolve a bit over time.

therefore i added ROLES, and PERMISSIONS. Roles are assigned multiple permissions.

Permissions are what the code is trying to do.
Roles are groupings of these.

So for example, user has role "ADMIN". They try to access a user mgmt page which requests permission "CAN_EDIT_USERS".
if ADMIN has permission CAN_EDIT_USERS, then they pass.

so this is obvious and clear and simple.

it gets fuzzy only because Blitz wants to still call permissions "ROLES". So you'll see things like,

    Page.authenticate = { role: ["CAN_EDIT_USERS"] };

And the point is: don't be confused by the use of the token `role` here. It's a permission, NOT a role.

** UPDATE: OK this is not really correct; there's a bug in Blitz where `Page.authenticate` only works when it's a boolean. Amazingly critical bug tbh.

So we just don't use it.

Instead i just make some custom functions to perform authorization.

````
useAuthorization   // for client-side authorization
  which flows to CMAuthorize
resolver.authorize // for securing db queries on the server
  which eventually flows to CMDBRolesIsAuthorized -> CMAuthorize
CMDBAuthorizeOrThrow   // for other server side auth
````

# db mutation mess

yes each mutation for every model has a .ts file. ugh. well that's the nature of blitz; it's tempting to unify them
into a single file, but `resolver.pipe` does the validation itself for typesafety, and disassembling that will be messy (not really the idea huh),
plus it adds an additional layer of protocol on our grid code that everything will need to support... a layer of inflexibility that
is probably not appropriate for all scenarios.

all for combining 3 files into 1. so let's just not.

### Securing pages:
````
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";

...

const isAuthorized = useAuthorization("DashboardLayout2", Permission.can_edit_users);
````
### Securing queries & mutations:

We can't actually change the parameters sent to `resolver.authorize`, because the type is kinda hardcoded in the blitz code. But it's a required call in the `resolver` call chain
in order to obtain the authorized context object. So in the call chain do

````
    resolver.authorize(Permission.login), // assert that the user can log in (basic permission to obtain authorized context)
````

And then the mutation/query code should narrow the authorization further with standard logic and calls to `CMDBAuthorizeOrThrow` or similar.


# changes, activities

* db changes get logged in the `changes` table. call from (almost all) mutations. see schema for details. the point is a kind of shoddy backup / diagnostic tool. these can be grouped into logical operation, associated with user.

* logical activities are logged in `activity` table. call from client code. point of this is for analytics for site usage and user ops. most of these will cascade into the `changes` table but not necessarily, and certainly with less detail. Changes to this table itself are not logged in `changes` because it's redundant.



# dev note: DYNAMIC_SERVER_USAGE {name: 'Rendering Suspense fallback...', digest: 'DYNAMIC_SERVER_USAGE', message: 'DYNAMIC_SERVER_USAGE'}

this is a very weird error because thingsn appear fine, then you hit F5 and this error happens. Then it feels like it never goes away.

seems like it happens often when I add `useQuery()` or `useMutation()` or other server calls to a component. You need the correct hierarchy of `<Suspense>`. Similar with other things like `<ThemeProvider>`, you can't put `useQuery()` in the same component as the `<Suspense>`.


# prisma commands / procedures:

there are 3 things to think about:

  1. `prisma.schema`, the schema source file
  1. `migrations`, actual .sql files which are generated by prisma in order to synchronize db state. may or may not be in sync with `prisma.schema` or the `database`.
  1. `database`, the database itself.

---


  * `blitz prisma format && blitz prisma generate && blitz prisma db push` dev environment when schema changes to do everything. Because this does not generate a migration file, it will almost always induce a full clobber when running `migrate` -- it considers the database as "drifted".
  * `blitz prisma migrate dev --name <migration_name>` very often clobbers database, but not always. creates a migration based off your `schema.prisma` file. can also be run without specifying name on the CLI (and it will ask you).
  * `blitz prisma migrate dev --create-only` to generate the migration file without clobbering the db.
  * `blitz prisma migrate deploy` makes sure the db is in sync with latest migrations (apply migrations from git to a database), never clobbers data.
    * also for applying new migrations to prod db
  * `blitz prisma migrate reset` forcibly/destructively resets your db from 0

So, `db push` will apply schema changes without creating migration files,which is convenient for dev process and prototyping. But the downside is that it guarantees that `migrate` will want to clobber the database as it's "drifted". Absolutely positively never do this in production.

`migrate dev` does a lot of stuff, create the migration file from `schema.prisma` and apply necessary migrations to update the database, clobbering if there's anything dirty. Never do this in production.

`migrate deploy` never clobbers and only aims to apply migrations to the db.


To get `db seed` to work,

1. changes needed to be made to `package.json`. `ts-node` is the command; on my windows machine it must be invoked via `npx ts-node`. And i get typescript errors unless i add the `module:CommonJS` option ([see here](https://github.com/prisma/prisma/discussions/12752))

````
  "prisma": {
    "schema": "db/schema.prisma",
    "seed": "npx ts-node --compiler-options {\"module\":\"CommonJS\"} ./db/seeds.ts"
  },
````

2. `npm i -D ts-node typescript @types/node` to make `ts-node` available
3. `chmod +x ./db/seeds.ts`




---

  * generate first migration from existing db (squash all migrations). this is "baselining" and explained [here](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/baselining)
  * [customize a migration](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/customizing-migrations) (like adding a new required field with no default)
    * it's not magic; just run `blitz prisma migrate dev --create-only` to create the migration, edit the SQL manually, then apply it like normal (as if you just `git pull`ed the migration for example) via `prisma migrate dev`

## to completely reset the db in dev (before ever deploying)

  - delete the `db.db` sqlite file
  - delete migrations
  - `blitz prisma migrate dev`
  - `blitz prisma db seed` MAY be necessary. or maybe not?

# special URLs:

  * http://localhost:10455/auth/stopImpersonating
  * http://localhost:10455/auth/logout

  * Also: `import { Routes } from "@blitzjs/next";` has all your `BlitzPage` in an accessible object.
  * Also see `blitz routes` from cmd line



# hotkeys on client

  * <kbd>alt+9</kbd> to show/hide admin controls. some site configuration settings can be configured directly on the site itself via these special controls.


# initial site setup

  * edit `.env.local`
  * initial db setup?
  * seeding ?
  * create roles, be sure to specify a default for new users


# user login/signup/accounts/google

  * anyone can create an account, and they will be assigned to a default role.
  * you can have multiple identification methods: email/password can work fine, and if you have a googleId it can also be used simultaneously.
  * sign in with google will create your default account for you
    * if you already have a password-based account, it can automatically be logged-in with google auth
    * if you signed up with a google account, you won't have an initial password. you may reset it though to be able to log in via password.

# Email & forgot password

So far I have avoided this website sending emails because email is messy and suggests further things like notifications. I want to save that for a future (maybe) project.

It means "forgot password" is not really possible, and must be therefore done by an admin via a one-time "reset password" link.

# circular import dependency detection

in any project, especially when it's a lot of prototyping and evolving semantics, circular dependencies can cause unpredictable problems.

`madge` or `dpdm` are tools to statically detect them, but i couldn't get either to work with this project.

Obvious way is to just build / lint the project with:

````
.eslintrc.js:

    rules: {
        "import/no-cycle": "error",
    },

````

this works well, but makes linting take like 5 minutes.

there is then [`skott`](https://www.npmjs.com/package/skott) which seems very comfy and quality.

````
skott --showCircularDependencies
````

will show clearly on the command line.

# Logging

  * `\src\pages\api\rpc\[[...blitz]].ts` configures RPC logging and contains `rpcHandler({onError: console.log})` but i don't quite understand the idea here behind the `console.log`. Verbosity is also set here and is important because verbose means logging all RPC input & output payloads.
  * `src\blitz-server.ts` configures the main logger.
  * See: https://blitzjs.com/docs/logging and https://blitzjs-com-git-siddhsuresh-blitz-rpc-verbose-blitzjs.vercel.app/docs/rpc-config#blitz-rpc-logging

  * TODO:
    * log to file?
    * viewing logs?
    * clearing / splitting logs etc

# DB3 components

````

    <EditFieldsDialogButton>
    renders a "edit" button; when clicked, a dialog is rendered to edit a db3 table spec object.

    <DB3EditRowButton> -- quite possibly a dupe of another ....

    <ChoiceEditCell>
    renders a value
    clicking reveals a dialog to select other values.
    used for visibility controls, tags fields.

    <DB3EditObjectDialog> & <DB3EditObject2Dialog>

    <DB3RowViewer>
    simple rendering of db3 name/value columns

````

# how: build / deployment?

  * `npm run lint`
  * `npm run build`

  * `blitz build` - builds for prod [docs](https://blitzjs.com/docs/cli-build)
  * `blitz start` - starts prod server [docs](https://blitzjs.com/docs/cli-start)

  * things i need to work out:
    * debugging prod? - will i be able to breakpoint? inspect much at all?
      * we can enable inspection directly on the GUI via `<InspectObject src={eventInfo} />`
    * updating prod database (how do migrations work)
    * logging: viewing
    * certainly more admin tools would be needed
      * inspecting activity / changes etc

