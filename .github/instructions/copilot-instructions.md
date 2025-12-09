# CafeMarcheDB - GitHub Copilot Instructions

CafeMarcheDB is a web application for managing a music community, built with Blitz.js (React/Next.js + Prisma ORM), TypeScript, and Material-UI. It handles events, users, songs, setlists, and calendar integration for a musical group.

These rules guide any AI coding agent contributing to this repository. Always conform to this style guide when making any changes.

Code must read like a story that makes design intent obvious.

## Story-First Structure

- Reflect every product description directly in code structure. If a feature has three sections, expose three clearly named components or functions.
- Favor readability over brevity. Expand logic so that each step telegraphs why it exists.
- Keep parent modules high-level by composing focused helpers/components rather than embedding sprawling logic.

## Algorithms Live in Helpers

- Never inline even "small" formulas inside loops, JSX, or conditionals. Wrap them in descriptive functions such as `ApplyGammaCorrection`, `WithinDistance`, or `AverageColorRgb255`.
- When extending existing logic, introduce a new helper and call it rather than stuffing the algorithm into the current block.
- Reuse existing utilities whenever they already express the operation.

## Naming Expectations

- Use descriptive, intent-revealing identifiers. Length is not a concern; ambiguity is.
- Reserve short names (e.g., `i`, `x`, `y`) for tiny local scopes like loop indices.
- Components/classes are nouns; functions that act are verbs.

## Magic Numbers Become Constants

- Do not bury raw numbers or heuristic values. Declare named constants near the top of the file or within a dedicated config module.
- Document how a constant was derived or tuned so future readers understand its origin.

## Components and Modularity

- Each component/function/class should own a single responsibility.
- Adding a feature means creating a new component or helper, not appending JSX or logic into an existing "god" block.
- Compose the page or tool out of smaller, obviously named pieces (e.g., `ImageManipulationControls`, `ImageExportControls`).

## Error Handling Discipline

- Avoid redundant checks when callees already guard a condition.
- Let real bugs surface. Do not swallow exceptions or return arbitrary fallback values.
- Assertions are acceptable to document assumptions; generic catch-alls are not.

## Strong Typing and Validation

- Preserve strict typing. Do not cast to `any`, `unknown`, `void*`, etc., to silence errors.
- When dealing with uncertain external data, add explicit runtime validation (e.g., Zod schemas) instead of unsafe casts.

## Units, Ranges, and Intent

- Embed units in names, such as `colorRgb01`, `durationMs`, or `ampDb`.
- Helpers and props should signal the value’s domain in their names and documentation.

## Document Unusual Decisions

- If a design deviates from the obvious approach, leave a brief comment explaining why so the story stays clear.

## Change Etiquette

- When editing existing files, keep the top-level flow descriptive and offload new work into new helpers/components.
- Never introduce fresh algorithms inline within pre-existing loops or conditionals.
- Keep the codebase incremental and refactor-friendly; resist the urge to lump unrelated behavior together.

## Duplication and modularity

- **Do not repeat algorithms or processing steps in multiple places.**
  - If an operation (e.g. multi-step image processing) is already implemented in a function, new code must **reuse that function or a shared helper**, not reimplement the steps in the caller.
  - If the caller needs access to intermediate results (e.g. step 1 / step 2 images), refactor the processing function to return a richer result object instead of duplicating the algorithm inline.

  ```ts
  // Prefer this:
  const result = processImage(input);
  return <>
    <ImageViewer bitmap={result.finalImage} />
    <ImageViewer bitmap={result.step1Image} />
    <ImageViewer bitmap={result.step2Image} />
  </>;

  // NOT this:
  const finalImage = processImage(input);
  const step1Image = /* repeat step 1 logic here */;
  const step2Image = /* repeat step 2 logic here */;
````

* When you detect similar logic in two or more places, **extract a shared utility**.

  * Move the common behavior into a helper (e.g. `applyProcessingSteps`, `processImageSteps`) and call it from both locations.
  * Keep the core algorithm “tight and centralized” so it can be maintained in one place.

* **Reuse utilities instead of duplicating even short expressions.**

  * If there is (or should be) a helper for a pattern (e.g. averaging, float comparison with epsilon, clamping, distance computation), use or create that helper and reuse it consistently.
  * Example utilities: `average`, `withinDistance`, `floatEquals`, `clamp`, `lerp`, conversions, date/time helpers, etc.

