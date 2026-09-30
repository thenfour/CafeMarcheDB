import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView, type ClientOf, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import {
    dashboardReferenceContract,
    instrumentDashboardView,
    instrumentFunctionalGroupDashboardView,
} from "../../references/dashboardReferences";
import {
    xInstrument,
    xInstrumentFunctionalGroup,
} from "../../schema/instrument";

// functional group -------------------------------------
const instrumentFunctionalGroupSelection = Prisma.validator<Prisma.InstrumentFunctionalGroupDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        sortOrder: true,
        color: true,
    },
});

const instrumentFunctionalGroupViewContract = deriveViewContract(
    xInstrumentFunctionalGroup,
    instrumentFunctionalGroupSelection,
);

export const instrumentFunctionalGroupListView = defineView({
    viewID: "InstrumentFunctionalGroup_List",
    entity: xInstrumentFunctionalGroup,
    dtoSchema: instrumentFunctionalGroupViewContract.dtoSchema,
    hydrate: instrumentFunctionalGroupViewContract.hydrate,
    selection: instrumentFunctionalGroupViewContract.prismaSelection,
});

export const instrumentFunctionalGroupEditorView = defineCrudView({
    viewID: "InstrumentFunctionalGroup_Editor",
    entity: xInstrumentFunctionalGroup,
    operations: { create: true, update: true, delete: true },
    dtoSchema: instrumentFunctionalGroupViewContract.dtoSchema,
    hydrate: instrumentFunctionalGroupViewContract.hydrate,
    selection: instrumentFunctionalGroupViewContract.prismaSelection,
});

// instrument -------------------------------------
const instrumentEditorTransportSelection = Prisma.validator<Prisma.InstrumentDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        autoAssignFileLeafRegex: true,
        sortOrder: true,
        functionalGroupId: true,
    },
});

const instrumentViewContract = deriveViewContract(
    xInstrument,
    instrumentEditorTransportSelection,
    {
        references: dashboardReferenceContract,
    },
);

export const instrumentEditorView = defineCrudView({
    viewID: "Instrument_Editor",
    entity: xInstrument,
    operations: { create: true, update: true, delete: true },
    dtoSchema: instrumentViewContract.dtoSchema,
    hydrate: instrumentViewContract.hydrate,
    selection: instrumentViewContract.prismaSelection,
    references: instrumentViewContract.referenceContract,
});

export type InstrumentFunctionalGroupListItem = ClientOf<typeof instrumentFunctionalGroupListView>;
export type InstrumentEditorClient = ClientOf<typeof instrumentEditorView>;
export type InstrumentEditorFunctionalGroup = InstrumentEditorClient["functionalGroup"];
export type InstrumentFunctionalGroupDashboardDto = DtoOf<typeof instrumentFunctionalGroupDashboardView>;
export type InstrumentDashboardDto = DtoOf<typeof instrumentDashboardView>;
export type InstrumentDashboardClient = ClientOf<typeof instrumentDashboardView>;
