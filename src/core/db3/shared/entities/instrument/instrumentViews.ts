import type { ClientOf, DtoOf } from "../../core/db3View";
import { instrumentDashboardView, instrumentFunctionalGroupDashboardView } from "../../references/dashboardReferences";
import { bandInstrumentView } from "./bandInstrumentContracts";

export { bandInstrumentView as instrumentEditorView,
    bandInstrumentGroupView as instrumentFunctionalGroupEditorView } from "./bandInstrumentContracts";

export const instrumentFunctionalGroupListView = instrumentFunctionalGroupDashboardView;
export type InstrumentFunctionalGroupListItem = ClientOf<typeof instrumentFunctionalGroupListView>;
export type InstrumentEditorClient = ClientOf<typeof bandInstrumentView>;
export type InstrumentEditorFunctionalGroup = InstrumentEditorClient["functionalGroup"];
export type InstrumentFunctionalGroupDashboardDto = DtoOf<typeof instrumentFunctionalGroupDashboardView>;
export type InstrumentDashboardDto = DtoOf<typeof instrumentDashboardView>;
export type InstrumentDashboardClient = ClientOf<typeof instrumentDashboardView>;
