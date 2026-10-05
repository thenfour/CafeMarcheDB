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

## Coding guidelines

- Use strict typescript typing. Types are used to help understand code's intent, meaning, disambiguation.
  Using general types such as `TAnyModel`, `Record<string,unknown>` should be accompanied
  with a brief comment justifying the decision.
- Type casts (`x as T`, especially `as any`) must be given a brief comment
  justifying why stronger typing was either chosen, or impossible.
- Comments should use brief, simple English, sometimes with illustrative examples.
- Prefer `import` at the top of file; avoid inline `import()` syntax unless absolutely necessary.
- Prefer clean new-looking code rather than legacy fallbacks.
- Keep each function at one level of abstraction. Orchestration should read
  like a story using semantic operations; isolate sub-routines and semantic code chunks
  behind clearly named helpers.
- Extract helpers around meaningful concepts, with clear inputs and outputs.

## Task scope

- If you encounter obvious trivial errors during your main task, fix them and report
  them.
- If you happen to encounter errors which are not trivial, report it
- If you encounter unit tests which are redundant or obsolete, you may remove them;
  report this.
