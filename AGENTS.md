# Repository agent notes

## Unit-test procedure

- Run focused tests with `yarn test <test paths> --reporter=dot`.
- Run the complete suite with `yarn test --reporter=dot`.
- Do not pass `--threads=false` or invoke `vitest run` directly. The repository
  runner batches Node tests and gives each jsdom file a fresh process, avoiding
  both Vitest 0.25's Windows worker crash and shared DOM-module contamination.
- Do not pass Jest's unsupported `--runInBand` option.
- React DOM tests must begin with `// @vitest-environment jsdom`, use the
  environment's `window` and `document`, and unmount roots in `afterEach`.
- Expected authorization rejections write to stderr. Use the final summary and
  exit code to decide whether the run passed.

See `docs/testing.md` for the rationale and full conventions.
