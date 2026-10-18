# Selection components

All CM selectors and DB3 selectors use the same presentation and interaction layer.

- `SelectionPicker` owns the dialog draft, search, checkbox/radio/action rows, creation state, Cancel and Apply.
- `SelectionField` owns the closed field and inline editing modes. `SelectionFieldFrame` and `SelectionEditButton` also serve the DB3 column editors. The Edit button belongs inside `CMChipContainer`.
- `SelectionSource` supplies option identity, accessible labels, domain rendering, and a `useOptions` hook. The hook reports loading, errors, retry, and optional creation. It must use a consistent set of hooks for the lifetime of a mounted picker.
- `renderChoice` owns the complete interactive item. Its context supplies the item, selected/disabled state, accessible label, and an interaction. `kind: "selection"` supplies single/multiple mode, native group name, value and `onActivate`; `kind: "action"` supplies `onActivate` and optional popup/expanded semantics. `interaction: null` explicitly requests display-only rendering for `AllWithDialog`. The field guards activation and owns the selection value; renderers own presentation and controls.
- CM and DB3 sources render choices as `CMChip`. Its `choice` prop uses a visually hidden native input inside the chip, preserving keyboard activation and radio navigation. Local sources use `ChoiceControl` around domain content by default and accept a complete `renderChoice` override.
- `SelectedAsDialogTrigger` shows only selected values, each acting as a native button that opens the full picker dialog. It omits the Edit button and shows a `Select…` action when empty. Readonly fields show passive values. Options are loaded when the dialog opens. Public `renderOption` still supplies content; custom `renderChoice` implementations must handle both interaction kinds.
- `makeAsyncSelectionSource` adapts immediate arrays and promise providers. It supports filtering, ignores obsolete requests, and preserves zero as a valid value.
- `makeLocalSelectionSource` adapts already-loaded choices and custom domain renderers, with the same label-based search. Visibility, attendance groups and icons use this adapter; Add User uses the DB3 source with caller filtering and user chips.
- `useDB3SelectionSource` adapts DB3 query hooks and schema metadata, including insertion permissions and model conversion. It does not render dialogs or implement selection state.

The public `CMSingleSelect`, `CMMultiSelect`, and their dialog exports adapt the existing callback APIs. `DB3SingleSelect`, `DB3MultiSelect`, and their dialogs adapt the schema APIs. The DB3 column editors supply sources too; tags keep association objects intact so additional association fields survive reselection.

Single pickers accept an activated option immediately by default. Explicit confirmation uses radio buttons and Apply. Multi pickers always edit a draft. Null or undefined is an explicit choice only when the adapter allows it; an initially unset required field has no selection.

Use `getOptionInfo().name` for readable labels when `renderOption` returns a custom component whose text cannot be inspected. Public `renderOption` callbacks still supply chip content. `renderValue` supplies passive values and dialog summaries; source `renderOption` supplies dialog row content. Dialog rows retain their shared checkbox/radio/action controls.

Use `/backstage/test/CMSelectTest` to compare the public APIs, display modes, nullability, asynchronous loading and DB3 creation. Keep picker layout and interaction changes in the shared components rather than copying them into an adapter.
