# Unit tests

Run the complete unit suite from the repository root with:

```powershell
yarn test --reporter=dot
```

The `yarn test` script owns the reliable process layout for the pinned Vitest
0.25 release. Node tests run together without the worker pool. Each jsdom test
file runs in a fresh process, preventing React, Emotion, and MUI module state
from crossing jsdom environments. This avoids both observed failure modes: the
Windows worker-pool crash and the shared-worker DOM contamination.

A focused run uses the same runner and accepts one or more files or directories:

```powershell
yarn test tests/example.test.ts --reporter=dot
```

Do not pass `--threads=false` or other worker/environment overrides; the wrapper
owns those details. `--runInBand` is a Jest option and is not valid here.

## React and DOM tests

Any test that imports `react-dom` must start with:

```ts
// @vitest-environment jsdom
```

Use the `window` and `document` supplied by that environment. Do not construct a
second `JSDOM` instance or replace those globals manually. Emotion determines
its browser behavior when its module is first loaded; loading UI code in the
Node environment can cache a null Emotion context and make unrelated later MUI
tests fail at `cache.registered`.

Create DOM containers in `beforeEach`, unmount every React root in `afterEach`,
and restore any global descriptors, fake timers, or event listeners changed by
the test. `tests/testEnvironment.test.ts` enforces the environment boundary.

Some authorization tests intentionally exercise rejected requests and write the
expected errors to stderr. Judge the run by its final Vitest summary and exit
code, not by the presence of those messages.

## Migration reference specifications

The localization/multiband migration temporarily preserves disabled feature
tests as line-commented source. A wholly disabled file starts with
`// MIGRATION_DEFERRED_TEST` and contains only comments and `export {};`.
The runner verifies source checksums and the inventory, rejects executable code
under that marker, and reports those files separately from executed tests.
Selecting only preserved specifications fails because no executable tests ran.
Partially preserved files continue to run their active cases normally.

Use `yarn migration:status` to inspect pending features and `yarn migration:verify`
to check preservation. `yarn migration:check` is the final migration completion
gate and intentionally fails until restoration/retirement evidence is recorded.
See the [preservation procedure](localization-multitenancy/13-feature-preservation.md).
