// one could argue "why is dashboard stuff in db3"?
// but db3 has basically 2 layers: the core ORM-like layer, and an application-specific
// layer that understands the CMDB schema.

import type { TAnyModel } from "@/shared/rootroot";
import { Prisma } from "db";
import {
    DB3ReferenceStore,
    defineReferenceContract,
    reference,
    type DB3ReferenceProvider,
} from "../core/db3Hydration";
import {
    deriveViewContract,
    type DB3DerivedViewContract,
} from "../core/db3ViewContract";
import type { AnyDB3Table } from "../db3core";
import {
    xEventAttendance,
    xEventStatus,
    xEventTag,
    xEventType,
} from "../schema/event";
import {
    xFileTag,
} from "../schema/file";
import {
    xInstrument,
    xInstrumentFunctionalGroup,
    xInstrumentTag,
} from "../schema/instrument";
import { PermissionForVisibilityArgs } from "../schema/prismArgs";
import {
    xSongCreditType,
    xSongTag,
} from "../schema/song";
import { xPermission } from "../schema/user";

// dashboard provider provides "hydrated" objects, not raw db rows
// (e.g. ColorPaletteEntry rather than `string`).
// use the actual db3 view mechanism to do this;  it means prisma select -> dto schema -> hydration with xTable column metadata


const dashboardEventTypeSelection = Prisma.validator<Prisma.EventTypeDefaultArgs>()({
    select: {
        id: true,
        isDeleted: true,
        description: true,
        color: true,
        sortOrder: true,
        iconName: true,
        text: true,
        significance: true,
    },
});

const dashboardEventStatusSelection = Prisma.validator<Prisma.EventStatusDefaultArgs>()({
    select: {
        id: true,
        isDeleted: true,
        description: true,
        color: true,
        sortOrder: true,
        iconName: true,
        label: true,
        significance: true,
    },
});

const dashboardEventTagSelection = Prisma.validator<Prisma.EventTagDefaultArgs>()({
    select: {
        id: true,
        description: true,
        color: true,
        sortOrder: true,
        text: true,
        significance: true,
        visibleOnFrontpage: true,
    },
});

const dashboardEventAttendanceSelection = Prisma.validator<Prisma.EventAttendanceDefaultArgs>()({
    select: {
        id: true,
        text: true,
        description: true,
        iconName: true,
        color: true,
        sortOrder: true,
        isDeleted: true,
        strength: true,
        personalText: true,
        pastText: true,
        pastPersonalText: true,
        isActive: true,
    },
});

const dashboardFileTagSelection = Prisma.validator<Prisma.FileTagDefaultArgs>()({
    select: {
        id: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
    },
});

const dashboardInstrumentFunctionalGroupSelection = Prisma.validator<
    Prisma.InstrumentFunctionalGroupDefaultArgs
>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        sortOrder: true,
        color: true,
    },
});

const dashboardInstrumentTagSelection = Prisma.validator<Prisma.InstrumentTagDefaultArgs>()({
    select: {
        id: true,
        text: true,
        description: true,
        sortOrder: true,
        color: true,
        significance: true,
    },
});

const dashboardSongTagSelection = Prisma.validator<Prisma.SongTagDefaultArgs>()({
    select: {
        id: true,
        text: true,
        description: true,
        sortOrder: true,
        color: true,
        significance: true,
        indicator: true,
        indicatorCssClass: true,
        group: true,
    },
});

const dashboardSongCreditTypeSelection = Prisma.validator<Prisma.SongCreditTypeDefaultArgs>()({
    select: {
        id: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
    },
});

const dashboardInstrumentTransportSelection = Prisma.validator<Prisma.InstrumentDefaultArgs>()({
    select: {
        id: true,
        name: true,
        description: true,
        autoAssignFileLeafRegex: true,
        sortOrder: true,
        functionalGroupId: true,
        instrumentTags: {
            select: {
                id: true,
                instrumentId: true,
                tagId: true,
            },
        },
    },
});

const dashboardInstrumentSelection = Prisma.validator<Prisma.InstrumentDefaultArgs>()({
    select: {
        ...dashboardInstrumentTransportSelection.select,
        functionalGroup: {
            select: { publicId: true },
        },
    },
});

// These projections and conversions are private details of the dashboard
// provider. DB3 views see only dashboardReferenceContract's per-entity output
// types; another provider may construct completely different values.
export const dashboardPermissionResource = deriveViewContract(
    xPermission,
    PermissionForVisibilityArgs,
);
export const dashboardEventTypeResource = deriveViewContract(
    xEventType,
    dashboardEventTypeSelection,
);
export const dashboardEventStatusResource = deriveViewContract(
    xEventStatus,
    dashboardEventStatusSelection,
);
export const dashboardEventTagResource = deriveViewContract(
    xEventTag,
    dashboardEventTagSelection,
);
export const dashboardEventAttendanceResource = deriveViewContract(
    xEventAttendance,
    dashboardEventAttendanceSelection,
);
export const dashboardFileTagResource = deriveViewContract(
    xFileTag,
    dashboardFileTagSelection,
);
export const dashboardInstrumentFunctionalGroupResource = deriveViewContract(
    xInstrumentFunctionalGroup,
    dashboardInstrumentFunctionalGroupSelection,
);
export const dashboardInstrumentTagResource = deriveViewContract(
    xInstrumentTag,
    dashboardInstrumentTagSelection,
);
export const dashboardSongTagResource = deriveViewContract(
    xSongTag,
    dashboardSongTagSelection,
);
export const dashboardSongCreditTypeResource = deriveViewContract(
    xSongCreditType,
    dashboardSongCreditTypeSelection,
);

export const dashboardLeafReferenceContract = defineReferenceContract({
    permission: reference(xPermission)<ReturnType<typeof dashboardPermissionResource.hydrate>>(),
    eventType: reference(xEventType)<ReturnType<typeof dashboardEventTypeResource.hydrate>>(),
    eventStatus: reference(xEventStatus)<ReturnType<typeof dashboardEventStatusResource.hydrate>>(),
    eventTag: reference(xEventTag)<ReturnType<typeof dashboardEventTagResource.hydrate>>(),
    eventAttendance: reference(xEventAttendance)<ReturnType<typeof dashboardEventAttendanceResource.hydrate>>(),
    fileTag: reference(xFileTag)<ReturnType<typeof dashboardFileTagResource.hydrate>>(),
    instrumentFunctionalGroup: reference(xInstrumentFunctionalGroup)<
        ReturnType<typeof dashboardInstrumentFunctionalGroupResource.hydrate>
    >(),
    instrumentTag: reference(xInstrumentTag)<ReturnType<typeof dashboardInstrumentTagResource.hydrate>>(),
    songTag: reference(xSongTag)<ReturnType<typeof dashboardSongTagResource.hydrate>>(),
    songCreditType: reference(xSongCreditType)<ReturnType<typeof dashboardSongCreditTypeResource.hydrate>>(),
});

export const dashboardInstrumentResource = deriveViewContract(
    xInstrument,
    dashboardInstrumentSelection,
    {
        transportSelection: dashboardInstrumentTransportSelection,
        references: dashboardLeafReferenceContract,
    },
);

export const dashboardReferenceContract = defineReferenceContract({
    ...dashboardLeafReferenceContract.definitions,
    instrument: reference(xInstrument)<ReturnType<typeof dashboardInstrumentResource.hydrate>>(),
});

export type DashboardReferenceContract = typeof dashboardReferenceContract;
export type DashboardReferenceStore = DB3ReferenceStore<DashboardReferenceContract>;

type ResourceDto<TResource> = TResource extends DB3DerivedViewContract<
    any,
    any,
    any,
    any
> ? Parameters<TResource["hydrate"]>[0] : never;

export interface DashboardReferenceInput {
    permission?: readonly ResourceDto<typeof dashboardPermissionResource>[];
    eventType?: readonly ResourceDto<typeof dashboardEventTypeResource>[];
    eventStatus?: readonly ResourceDto<typeof dashboardEventStatusResource>[];
    eventTag?: readonly ResourceDto<typeof dashboardEventTagResource>[];
    eventAttendance?: readonly ResourceDto<typeof dashboardEventAttendanceResource>[];
    fileTag?: readonly ResourceDto<typeof dashboardFileTagResource>[];
    instrumentFunctionalGroup?: readonly ResourceDto<
        typeof dashboardInstrumentFunctionalGroupResource
    >[];
    instrumentTag?: readonly ResourceDto<typeof dashboardInstrumentTagResource>[];
    songTag?: readonly ResourceDto<typeof dashboardSongTagResource>[];
    songCreditType?: readonly ResourceDto<typeof dashboardSongCreditTypeResource>[];
    instrument?: readonly ResourceDto<typeof dashboardInstrumentResource>[];
}

export function createDashboardReferenceStore(): DashboardReferenceStore {
    return new DB3ReferenceStore(dashboardReferenceContract);
}

function registerResource(
    store: DashboardReferenceStore,
    entity: AnyDB3Table,
    resource: DB3DerivedViewContract<any, any, any, any>,
    rows: readonly TAnyModel[] | undefined,
): void {
    if (!rows) return;
    const provider = store as DB3ReferenceProvider<any>;
    const values = rows.map(row => resource.hydrate(
        resource.dtoSchema.parse(row),
        provider,
    ));
    const writableStore = store as DB3ReferenceStore<any>;
    writableStore.register(
        entity,
        values,
        (value: TAnyModel) => entity.getIdentity(value),
    );
}

/** Populates leaf resources first so provider-defined compound values can use them. */
export function registerDashboardReferences(
    store: DashboardReferenceStore,
    input: DashboardReferenceInput,
): void {
    registerResource(store, xPermission, dashboardPermissionResource, input.permission);
    registerResource(store, xEventType, dashboardEventTypeResource, input.eventType);
    registerResource(store, xEventStatus, dashboardEventStatusResource, input.eventStatus);
    registerResource(store, xEventTag, dashboardEventTagResource, input.eventTag);
    registerResource(store, xEventAttendance, dashboardEventAttendanceResource, input.eventAttendance);
    registerResource(store, xFileTag, dashboardFileTagResource, input.fileTag);
    registerResource(
        store,
        xInstrumentFunctionalGroup,
        dashboardInstrumentFunctionalGroupResource,
        input.instrumentFunctionalGroup,
    );
    registerResource(store, xInstrumentTag, dashboardInstrumentTagResource, input.instrumentTag);
    registerResource(store, xSongTag, dashboardSongTagResource, input.songTag);
    registerResource(store, xSongCreditType, dashboardSongCreditTypeResource, input.songCreditType);
    registerResource(store, xInstrument, dashboardInstrumentResource, input.instrument);
}
