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
    xInstrumentTag,
} from "../../schema/instrument";
import {
    InstrumentTagAssociationNaturalOrderBy,
} from "../../schema/prismArgs";
import { graft } from "../common/viewCommon";

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

// tag -------------------------------------
const instrumentTagSelection = Prisma.validator<Prisma.InstrumentTagDefaultArgs>()({
    select: {
        publicId: true,
        text: true,
        description: true,
        sortOrder: true,
        color: true,
        significance: true,
    },
});

const instrumentTagViewContract = deriveViewContract(xInstrumentTag, instrumentTagSelection);
export const instrumentTagEditorView = defineCrudView({
    viewID: "InstrumentTag_Editor",
    entity: xInstrumentTag,
    operations: { create: true, update: true, delete: true },
    dtoSchema: instrumentTagViewContract.dtoSchema,
    hydrate: instrumentTagViewContract.hydrate,
    selection: instrumentTagViewContract.prismaSelection,
});

// instrument -------------------------------------
const instrumentEditorTransportSelection = Prisma.validator<Prisma.InstrumentDefaultArgs>()({
    select: {
        id: true,
        name: true,
        description: true,
        autoAssignFileLeafRegex: true,
        sortOrder: true,
        functionalGroupId: true,
        instrumentTags: {
            select: {
                publicId: true,
                tagId: true,
                // tag: gets grafted via reference provider
            },
            orderBy: InstrumentTagAssociationNaturalOrderBy,
        },
    },
});

const instrumentEditorSelection = Prisma.validator<Prisma.InstrumentDefaultArgs>()(
    graft(instrumentEditorTransportSelection, {
        select: {
            // The server uses this relation to project functionalGroupId to its
            // public identity. The normalized client relation comes from the
            // dashboard reference provider instead of crossing the view DTO.
            functionalGroup: {
                select: { publicId: true },
            },
            instrumentTags: {
                select: {
                    // The relation is projection support. The client receives the
                    // normalized tag from the reference provider.
                    tag: { select: { publicId: true } },
                },
            },
        },
    })
);

const instrumentViewContract = deriveViewContract(
    xInstrument,
    instrumentEditorSelection,
    {
        transportSelection: instrumentEditorTransportSelection,
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
export type InstrumentTagEditorClient = ClientOf<typeof instrumentTagEditorView>;
export type InstrumentEditorClient = ClientOf<typeof instrumentEditorView>;
export type InstrumentEditorFunctionalGroup = InstrumentEditorClient["functionalGroup"];
export type InstrumentEditorTagAssociation = InstrumentEditorClient["instrumentTags"][number];
export type InstrumentFunctionalGroupDashboardDto = DtoOf<typeof instrumentFunctionalGroupDashboardView>;
export type InstrumentDashboardDto = DtoOf<typeof instrumentDashboardView>;
export type InstrumentDashboardClient = ClientOf<typeof instrumentDashboardView>;
