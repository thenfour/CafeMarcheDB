# Releases and deployment

Releases and deployments are both manual.
GitHub Actions builds and publishes a product version;
Uberspace installation chooses when and which version to install.
Pushing a branch or tag does not start this workflow or deploy anything.

## Product and version

`package.json` is the authority:

```json
{
  "version": "3.0.0",
  "cmdb": { "product": "cafemarche" }
}
```

| Product        | Application                                  |
| -------------- | -------------------------------------------- |
| `cafemarche`   | Cafe Marche application with custom features |
| `single-band`  | Privately hosted instance for one band       |
| `multi-tenant` | Sign-up website serving multiple bands       |

Initially `main` identifies `cafemarche`. When creating another product branch, change its `cmdb.product` and keep the workflow and release scripts on that branch. Branch names are unrestricted; the product identifier is stable across branch renames. Versions advance independently for each product. Several servers can install the same product version.

Both building and deployment read the product from the checkout's `package.json`. There is no separate product setting in deployment environment files. Changing to another product branch changes which product's releases the upgrader offers; the selected release's manifest and source package must still match that product.

Use SemVer: `3.0.0`, `3.0.1`, `3.1.0-rc.1`. The deployed `v2.03` remains a
historical release; the new series starts at `3.0.0`.
A version in a development checkout describes that checkout's declared version;
the published manifest identifies the exact released commit.

GitHub Releases requires a tag. Publishing derives it automatically,
for example `cafemarche-v3.0.0`. There is no manual tagging step and no rolling
`latest` tag. The product/version pair cannot be reused for a different commit.
An already published release cannot be overwritten by these tools, including on a workflow rerun.

## Publish manually

1. Set the product/version in `package.json`, commit all release changes, and push the branch.
2. Open **Actions > Release > Run workflow**, choose that branch, and start the workflow.
3. Wait for a successful workflow and the corresponding entry in **Releases**.

The workflow must first be present on the repository's default branch for the **Run workflow** button to appear. It checks out the selected event's exact commit, tests the tooling, builds the application in the Uberspace-compatible container, exercises native image/password dependencies, and publishes the archive, checksum, and manifest. All asset uploads finish before the draft becomes a published release. A failed upload leaves a draft; rerunning the same commit can replace its incomplete draft assets and finish publication. If fixing the failure changes the commit after a tag/draft was created, bump the package version.

The workflow normally uses GitHub's built-in token with `contents: write`; no production SSH credentials are used. If repository policy prevents this permission, an administrator must allow it. GitHub can also reject creating a tag/release on a non-default branch whose workflow files differ from the default branch. For that case, configure the optional Actions secret `RELEASE_TOKEN` with repository **Contents: write** and **Workflows: write** permissions. This workflow uses it in place of the built-in token when present. Keep publishing restricted to trusted repository branches.

Release assets are:

```text
cmdb_cafemarche_3.0.0.tar.gz
cmdb_cafemarche_3.0.0.tar.gz.sha256
cmdb_cafemarche_3.0.0.manifest.json
```

The manifest records the product, version, full commit, source branch ref, build time, runtime profile, artifact name, and SHA256. The archive contains `.next/`, including its original `cmdb-build.json`, but excludes `.next/cache`. Application source, dependencies and Prisma migrations are obtained from the manifest's exact commit during deployment. `files_to_deploy.txt` belongs to the old `deploy.sh` path; the new release archive has a fixed `.next/` contract.

## Build environment

The initial profile is `uberspace7-node18`:

| Component    | Build requirement         |
| ------------ | ------------------------- |
| Architecture | Linux x86_64 / Node `x64` |
| libc         | glibc 2.17                |
| Node         | 18.20.8                   |
| Yarn         | 1.22.22                   |

`scripts/release/Dockerfile` pins a CentOS 7-based PyPA manylinux2014 image by digest. It installs the Node project's **unofficial-builds** glibc-217 binary and Yarn using pinned download checksums. This Node distribution is a community compatibility build, distinct from the standard nodejs.org Linux binary. It matches the supplied host baseline; it does not replace Uberspace's installed Node.

`package.json` deliberately resolves `sodium-native` to 3.3.0. Its bundled
Linux binary supports glibc 2.17; the 3.4.x binaries require a newer glibc and
fall back to a source build that cannot currently fetch its archived libsodium
source. Keep this pin until a password-library upgrade is validated in the
release container.

GitHub's checkout/setup actions execute on Ubuntu.
The application build executes in the container, so those actions do not need
to run their own modern Node binaries against glibc 2.17.
The builder checks its actual runtime before building.

- Deployment requires the same Node major, at least the build's Node patch and
- glibc versions,
- matching architecture,
- and the pinned Yarn version.

A future runtime upgrade requires an intentional update of the profile and builder.

The workflow supplies placeholder database/session/base-URL settings for
compilation. Production configuration stays on each server. The build is
intended to compile without connecting to a production database;
if future pages need data during compilation, supply a disposable build
database rather than production access.

Client-specific browser values must
also be considered: Next.js freezes `NEXT_PUBLIC_*` values at build time.

For local investigation with Docker, use a **separate clean Linux checkout** without Windows `node_modules` or production `.env.local` files:

```sh
docker build --tag cmdb-release --file scripts/release/Dockerfile scripts/release
docker run --rm --volume "$PWD:/workspace" \
  --env DATABASE_URL=mysql://build:build@127.0.0.1:3306/cmdb_build \
  --env SESSION_SECRET_KEY=cmdb-build-placeholder-not-a-runtime-secret \
  cmdb-release node scripts/build.mjs
docker run --rm --volume "$PWD:/workspace" \
  cmdb-release node scripts/package-release.mjs --package-only
```

`--package-only` writes `dist/` and does not contact GitHub. Publishing normally happens through the manual Actions workflow. A Windows-built or stale `.next` directory is refused by the release tooling.

## Configure a target

In the server's checkout, create or edit the ignored `.env.deploy.local`. Keep the target's configuration here so checking out another source commit cannot change it:

```dotenv
SERVICE=cmdb
DB_NAME=tenfour_cmdb
BACKUP_DIR=~/backups
RELEASES_TO_SHOW=10
# Required for a private repository; contents-read access is sufficient.
# GITHUB_TOKEN=...
```

Use unquoted `KEY=value` entries. For these target settings, existing process environment takes precedence, followed by the local file, then `.env.deploy`. The upgrade command creates a missing local file from the base defaults during a normal invocation; dry runs do not create it. Existing local files are never overwritten. A leftover `PRODUCT` entry in an environment file or process environment is ignored; `package.json` is the product authority.

Keep application settings, including `DATABASE_URL`, in the existing `.env.local` / service configuration. `DB_NAME` must identify the same database used by the application and migrations. `mysqldump` uses the server's existing MySQL credentials configuration. Private repositories also require working Git credentials for the source fetch; the asset API token does not automatically configure Git.

### One-time Sysadmin recovery

Ordinary signup never grants Sysadmin. To enable a one-time sysadmin recovery path,
configure both application environment values:

```dotenv
CMDB_ADMIN_BOOTSTRAP_EMAIL=admin@example.com
CMDB_ADMIN_BOOTSTRAP_SECRET=<at-least-32-character-random-secret>
```

Use a cryptographically random secret; for example, `openssl rand -hex 32` produces a suitable 64-character value. The target account must already exist, be active, and be signed in with the exact configured email. Visit `/auth/admin-bootstrap` and submit the secret. The route is deliberately absent from site navigation and renders no recovery content for other accounts, but the route name is not a security boundary.

The server rechecks the authenticated database user and credential, stores only the credential's SHA-256 hash in `AdminBootstrapClaim`, grants `User.isSysAdmin`, invalidates the user's other sessions, and refreshes the current session. A hash can be claimed only once, including if the same secret is later restored in the environment. Remove the two values after recovery, or rotate the secret to prepare a new one-time recovery credential. Changing or removing the configured email revokes eligibility for an unclaimed credential.

## Install manually

Inspect an exact release first:

```sh
node scripts/upgrade.mjs --version 3.0.0 --dry-run
```

This downloads to a temporary directory and verifies the product/version, runtime compatibility, source package metadata, tag commit, archive checksum, archive paths and embedded build metadata. It does not change the checkout, service, or database. It does not test database migration compatibility or start the application.

Install that version:

```sh
node scripts/upgrade.mjs --version 3.0.0
```

Or run `node scripts/upgrade.mjs` to choose from recent releases for the product identified by the checkout's `package.json`, including prereleases. Other products and old `v2.xx` releases are excluded. Exact version lookup works even when the release is older than the displayed list. Empty input cancels; there is no automatic choice of the latest version. Installation requires typing the displayed `product/version` in an interactive terminal, even with `--version`.

After confirmation the upgrader:

1. Acquires a target-local deployment lock and fetches the selected tag, verifying its source commit and package metadata.
2. Stops the configured Supervisor service and backs up its database.
3. Checks out the exact release commit in detached HEAD state and installs its frozen Yarn dependencies.
4. Preserves the previous `.next` directory under `dist/upgrade-.../previous-next` and installs the verified build. Old chunks cannot survive extraction into the new directory.
5. Generates Prisma for the server, applies the selected commit's migrations, and starts the service using Supervisor.
6. Records product/version, source commit, status, checksums and recovery locations in ignored `.cmdb-deployment.json`.

The checkout remains detached at the installed version. Subsequent upgrades use explicit release tags; **do not run `git pull` as part of normal upgrades**. `yarn blitz` resolves the CLI from that release's local dependencies. Native dependencies remain installed/generated on the target; the app is not compiled there.

Keep each independent application installation's database separate. Selecting another version does not reverse migrations or guarantee that a different branch's migration history can be applied. Plan database compatibility explicitly when switching histories or rolling back code.

## First deployment from v2.03

After the new tooling has been committed and pushed, manually publish `cafemarche/3.0.0` from Actions. On the existing server, update its current branch once with `git pull --ff-only` to obtain this upgrader, and pin its settings in `.env.deploy.local` as above. Preserve the existing application's `.env.local`, uploads and Supervisor configuration.

Run the `3.0.0` dry run, inspect the selected commit and product, then run the install command. Verify the application and Supervisor logs after installation; a successful Supervisor start alone is not an application health check. No repeat bootstrap pull is needed for later releases.

The initial installation has no deployment record. The new record's `previousCheckoutCommit` describes the checkout immediately before installation, which may already contain the bootstrap tooling; it must not be mistaken for the old deployed v2.03 build. Historical releases/tags remain available through the old procedure, but are not mixed into the new product/version picker.

## Failures and recovery

Failures during downloading, verification or source fetch happen before stopping the service. Once installation starts, the upgrader records failures with backup and recovery paths. It does **not** blindly restart after a dependency or migration failure, because source, dependencies and database state may already have changed. Inspect Supervisor status and logs, then choose a consistent source/build/database recovery or correct the issue and manually retry. No automatic database rollback is attempted. Retained build and SQL backups are not automatically pruned.

`.cmdb-deployment.lock` prevents concurrent upgrades. Normal completion or exceptions release it. If the process was forcibly killed, check that no upgrade is running before removing the stale lock file. The existing deployment record and backup locations help diagnose interrupted installations.

## Tooling checks

```sh
node scripts/test-release.mjs
```

These dependency-free Node tests exercise real Git checkouts and tar archives, product/version validation, private-asset API behavior, draft publication and retry, corrupt downloads, selected-commit installation, target-setting preservation, and failures before/during installation. Database/service commands are simulated in those tests. The Actions run adds the Linux app build and native dependency checks; an actual Uberspace installation still needs manual verification.

References: [GitHub Releases API](https://docs.github.com/en/rest/releases/releases#create-a-release), [manual workflow execution](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [Node unofficial builds](https://github.com/nodejs/unofficial-builds), [manylinux2014](https://github.com/pypa/manylinux#manylinux2014-centos-7-based-glibc-217), [Next.js environment variables](https://nextjs.org/docs/14/pages/building-your-application/configuring/environment-variables).
